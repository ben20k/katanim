// Supabase Edge Function: sends order notification emails through Resend.
// Deploy:  supabase functions deploy send-order-email
// Secrets: supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Katanim <orders@yourdomain.com>" \
//                                MANAGER_EMAIL=manager@yourdomain.com SITE_URL=https://yourdomain.com
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Katanim <onboarding@resend.dev>';
const MANAGER_EMAIL = (Deno.env.get('MANAGER_EMAIL') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventName =
  | 'order_placed' | 'proof_submitted' | 'received'                       // triggered by customer
  | 'payment_verified' | 'payment_rejected' | 'shipped' | 'delivered' | 'cancelled'; // triggered by manager

// who may trigger the event, which order status it requires, and who receives it
const EVENTS: Record<EventName, { by: 'customer' | 'manager'; status: string; to: 'customer' | 'manager' }> = {
  order_placed:     { by: 'customer', status: 'pending_payment',  to: 'customer' },
  proof_submitted:  { by: 'customer', status: 'for_verification', to: 'manager' },
  received:         { by: 'customer', status: 'received',         to: 'manager' },
  payment_verified: { by: 'manager',  status: 'payment_verified', to: 'customer' },
  payment_rejected: { by: 'manager',  status: 'payment_rejected', to: 'customer' },
  shipped:          { by: 'manager',  status: 'shipped',          to: 'customer' },
  delivered:        { by: 'manager',  status: 'delivered',        to: 'customer' },
  cancelled:        { by: 'manager',  status: 'cancelled',        to: 'customer' },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const peso = (n: number) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { order_id, event } = (await req.json()) as { order_id: string; event: EventName };
    const rule = EVENTS[event];
    if (!order_id || !rule) return json({ error: 'Bad request' }, 400);

    // Act as the caller so RLS decides whether they may see this order.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: me } = await userClient.from('profiles').select('role').eq('id', caller.id).single();
    const isManager = me?.role === 'manager';
    if (rule.by === 'manager' && !isManager) return json({ error: 'Forbidden' }, 403);

    const { data: order } = await userClient
      .from('orders')
      .select('*, order_items(name, qty, unit_price, line_total), order_payments(amount, status, payment_methods(label))')
      .eq('id', order_id)
      .single();
    if (!order) return json({ error: 'Order not found' }, 404);
    if (rule.by === 'customer' && order.user_id !== caller.id) return json({ error: 'Forbidden' }, 403);
    if (order.status !== rule.status) return json({ error: 'Order status does not match event' }, 409);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: owner } = await admin.from('profiles').select('email, full_name').eq('id', order.user_id).single();
    const { data: lastComment } = await admin
      .from('order_comments').select('body').eq('order_id', order_id).eq('is_internal', false)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    const to = rule.to === 'customer' ? [owner?.email].filter(Boolean) as string[] : MANAGER_EMAIL;
    if (to.length === 0) return json({ skipped: 'No recipient configured' });

    const customerLink = `${SITE_URL}/orders/${order.id}`;
    const managerLink = `${SITE_URL}/manager/orders/${order.id}`;
    const name = esc(owner?.full_name || order.ship_name);

    const content: Record<EventName, { subject: string; heading: string; body: string; link: string; cta: string }> = {
      order_placed: {
        subject: `Order ${order.order_no} received – please complete payment`,
        heading: 'Thanks for your order!',
        body: `Hi ${name}, we've received your order. Please pay using the method you selected and upload your proof of payment on the order page.`,
        link: customerLink, cta: 'Pay & upload proof',
      },
      proof_submitted: {
        subject: `[Action needed] Proof of payment for ${order.order_no}`,
        heading: 'Payment proof uploaded',
        body: `${name} uploaded proof of payment for order ${order.order_no}. Please check the bank / GCash account and verify it.`,
        link: managerLink, cta: 'Review payment',
      },
      received: {
        subject: `${order.order_no} marked as received`,
        heading: 'Order received by customer',
        body: `${name} confirmed they received order ${order.order_no}.`,
        link: managerLink, cta: 'View order',
      },
      payment_verified: {
        subject: `Payment verified for ${order.order_no}`,
        heading: 'Payment verified ✅',
        body: `Hi ${name}, we've confirmed your payment. We're now preparing your order for shipping.`,
        link: customerLink, cta: 'View order',
      },
      payment_rejected: {
        subject: `We couldn't verify your payment for ${order.order_no}`,
        heading: 'Payment could not be verified',
        body: `Hi ${name}, we were not able to verify your payment.${lastComment?.body ? `<br><br><b>Note from our team:</b> ${esc(lastComment.body)}` : ''}<br><br>Please check the comment and upload a new proof of payment.`,
        link: customerLink, cta: 'Upload new proof',
      },
      shipped: {
        subject: `${order.order_no} has shipped`,
        heading: 'Your order is on the way 🚚',
        body: `Hi ${name}, your order has been handed to ${esc(order.courier || 'the courier')}.${order.tracking_no ? ` Tracking number: <b>${esc(order.tracking_no)}</b>.` : ''} Please press <b>Received</b> on the order page once it arrives.`,
        link: customerLink, cta: 'Track order',
      },
      delivered: {
        subject: `${order.order_no} was delivered`,
        heading: 'Delivered',
        body: `Hi ${name}, the courier reports your order as delivered. Please press <b>Received</b> on the order page to confirm.`,
        link: customerLink, cta: 'Confirm received',
      },
      cancelled: {
        subject: `${order.order_no} was cancelled`,
        heading: 'Order cancelled',
        body: `Hi ${name}, your order has been cancelled.${lastComment?.body ? `<br><br><b>Note:</b> ${esc(lastComment.body)}` : ''}`,
        link: customerLink, cta: 'View order',
      },
    };
    const c = content[event];

    const rows = (order.order_items ?? [])
      .map((i: any) => `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.qty}</td><td style="text-align:right">${peso(i.line_total)}</td></tr>`)
      .join('');

    const html = `
      <div style="background:#f6faf6;padding:24px 12px;font-family:Poppins,Arial,Helvetica,sans-serif;color:#1a2a1e">
      <div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #dfe9e1;border-radius:16px;overflow:hidden">
        <div style="padding:18px 24px;border-bottom:1px solid #dfe9e1">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px"><img src="${SITE_URL}/brand/katanim-emblem.png" width="48" height="48" alt="Katanim" style="display:block"></td>
            <td>
              <div style="font-weight:800;font-style:italic;font-size:22px;color:#00a651;line-height:1">KATANIM</div>
              <div style="font-weight:600;font-size:10px;letter-spacing:2px;color:#0b260f;margin-top:3px">MODERN AGRICULTURE</div>
            </td>
          </tr></table>
        </div>
        <div style="height:4px;background:linear-gradient(90deg,#065535 0 20%,#1a5fc0 20% 40%,#fde26a 40% 60%,#e37238 60% 80%,#5f3c14 80% 100%);background-color:#00a651"></div>
        <div style="padding:24px">
          <h2 style="margin-top:0;color:#0b260f">${c.heading}</h2>
          <p style="line-height:1.6">${c.body}</p>
          <p><b>Order:</b> ${esc(order.order_no)}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
            <tr><td style="padding:6px 0;border-top:1px solid #dfe9e1">Shipping</td><td style="text-align:right;border-top:1px solid #dfe9e1">${peso(order.shipping_fee)}</td></tr>
            <tr><td style="padding:6px 0"><b>Total</b></td><td style="text-align:right"><b>${peso(order.total)}</b></td></tr>
          </table>
          <p style="margin:28px 0"><a href="${c.link}" style="background:#007a3c;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">${c.cta}</a></p>
        </div>
        <div style="background:#0b260f;color:#d7ecdc;padding:16px 24px;font-size:12px">
          <span style="font-style:italic;color:#fde26a">So clean, so good.</span> &nbsp;·&nbsp; #Katanim<br>
          You're receiving this because of an order at Katanim Modern Agriculture.
        </div>
      </div>
      </div>`;

    // Send each event at most once per status change (stops repeat-trigger spam).
    const { data: entered } = await admin
      .from('order_status_history').select('created_at')
      .eq('order_id', order_id).eq('status', rule.status)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { error: dupErr } = await admin
      .from('notification_log')
      .insert({ order_id, event, status_at: entered?.created_at ?? order.updated_at });
    if (dupErr) {
      if (dupErr.code === '23505') return json({ skipped: 'Already sent' });
      throw dupErr;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject: c.subject, html }),
    });
    const out = await res.json();
    if (!res.ok) {
      console.error('Resend error', out);
      // let a later retry send it
      await admin.from('notification_log').delete().match({ order_id, event, status_at: entered?.created_at ?? order.updated_at });
      return json({ error: 'Email could not be sent' }, 502);
    }
    return json({ sent: true, id: out.id });
  } catch (e) {
    console.error(e);
    return json({ error: 'Internal error' }, 500);
  }
});

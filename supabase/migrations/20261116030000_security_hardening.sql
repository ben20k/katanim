-- =====================================================================
-- Security hardening (review of 2026-11-16)
--  S1  Unpaid orders could hoard stock and GCash capacity forever
--  S2  Manager emails/phones were readable by anyone
--  S3  GCash volumes (money received per account) were readable by anyone
--  S4  "revoke from anon" did not block functions (PUBLIC still had EXECUTE)
--  S5  Race: two simultaneous orders could both use the last of a GCash limit
--  S6  No size limits on comments / delivery details / reference numbers
--  S7  Notification emails could be re-triggered without limit
--  S8  Manager-uploadable SVGs and non-https image URLs
-- Requires 20261116020000_jnt_rate_card.sql (place_order below builds on it).
-- =====================================================================

-- ---------- S2: stop exposing manager profiles ----------------------
alter table public.order_comments add column if not exists from_staff boolean not null default false;
update public.order_comments c set from_staff = true
from public.profiles p where p.id = c.author_id and p.role = 'manager';

create or replace function public.set_comment_staff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.from_staff := exists (select 1 from public.profiles where id = new.author_id and role = 'manager');
  return new;
end $$;
drop trigger if exists order_comments_staff on public.order_comments;
create trigger order_comments_staff before insert on public.order_comments
  for each row execute function public.set_comment_staff();

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_manager());

-- ---------- S3: hide money figures from non-managers ----------------
create or replace function public.payment_method_capacity()
returns table (
  id uuid, type public.payment_type, label text, account_name text, account_number text,
  qr_url text, instructions text, daily_limit numeric, monthly_limit numeric,
  active boolean, sort integer,
  used_today numeric, used_month numeric, verified_month numeric, remaining numeric
)
language sql stable security definer set search_path = public as $$
  with usage as (
    select op.method_id,
      coalesce(sum(op.amount) filter (
        where (op.created_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date), 0) as used_today,
      coalesce(sum(op.amount) filter (
        where date_trunc('month', op.created_at at time zone 'Asia/Manila')
            = date_trunc('month', now() at time zone 'Asia/Manila')), 0) as used_month,
      coalesce(sum(op.amount) filter (
        where op.status = 'verified'
          and date_trunc('month', op.created_at at time zone 'Asia/Manila')
            = date_trunc('month', now() at time zone 'Asia/Manila')), 0) as verified_month
    from public.order_payments op
    join public.orders o on o.id = op.order_id
    where op.status <> 'rejected' and o.status <> 'cancelled'
    group by op.method_id
  ), me as (select public.is_manager() as mgr)
  select pm.id, pm.type, pm.label, pm.account_name, pm.account_number, pm.qr_url, pm.instructions,
         case when me.mgr then pm.daily_limit end,
         case when me.mgr then pm.monthly_limit end,
         pm.active, pm.sort,
         case when me.mgr then coalesce(u.used_today, 0) end,
         case when me.mgr then coalesce(u.used_month, 0) end,
         case when me.mgr then coalesce(u.verified_month, 0) end,
         least(
           case when pm.daily_limit   is null then null else greatest(pm.daily_limit   - coalesce(u.used_today, 0), 0) end,
           case when pm.monthly_limit is null then null else greatest(pm.monthly_limit - coalesce(u.used_month, 0), 0) end
         )
  from public.payment_methods pm
  cross join me
  left join usage u on u.method_id = pm.id
  where pm.active or me.mgr
  order by pm.sort, pm.label;
$$;

-- ---------- S6 / S8: size limits and URL checks (new rows) ----------
alter table public.order_comments  add constraint order_comments_body_len  check (length(body) <= 2000) not valid;
alter table public.order_payments  add constraint order_payments_ref_len   check (reference_no is null or length(reference_no) <= 100) not valid;
alter table public.profiles        add constraint profiles_name_len        check (full_name is null or length(full_name) <= 120) not valid;
alter table public.profiles        add constraint profiles_phone_len       check (phone is null or length(phone) <= 30) not valid;
alter table public.products        add constraint products_image_https     check (image_url is null or image_url ~* '^https://') not valid;
alter table public.payment_methods add constraint payment_methods_qr_https check (qr_url is null or qr_url ~* '^https://') not valid;

update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'public-assets';

-- keep sign-up from failing on very long names from the sign-up form
alter table public.profiles add column if not exists avatar_url text;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, avatar_url)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', '')), 120),
    left(new.raw_user_meta_data->>'phone', 30),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end $$;

-- ---------- S1: release stock from unpaid orders --------------------
alter table public.store_settings add column if not exists unpaid_cancel_hours integer default 48
  check (unpaid_cancel_hours is null or unpaid_cancel_hours between 1 and 720);

create or replace function public.restock_order(p_order_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.products p set stock = p.stock + oi.qty
  from public.order_items oi where oi.order_id = p_order_id and oi.product_id = p.id;
$$;

-- customer cancels their own unpaid order
create or replace function public.customer_cancel_order(p_order_id uuid)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.user_id is distinct from auth.uid() then raise exception 'Order not found'; end if;
  if v_order.status not in ('pending_payment', 'payment_rejected') then
    raise exception 'Only unpaid orders can be cancelled. Please message us about this order.';
  end if;
  if exists (select 1 from public.order_payments where order_id = p_order_id and status in ('submitted', 'verified')) then
    raise exception 'Part of your payment was already sent or verified. Please message us to cancel.';
  end if;
  perform public.restock_order(p_order_id);
  update public.orders set status = 'cancelled' where id = p_order_id;
  return 'cancelled';
end $$;

-- scheduled: cancel orders that never got any proof of payment
create or replace function public.cancel_expired_unpaid_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare v_hours integer; v_id uuid; v_count integer := 0;
begin
  select unpaid_cancel_hours into v_hours from public.store_settings where id = 1;
  if v_hours is null then return 0; end if;
  for v_id in
    select o.id from public.orders o
    where o.status = 'pending_payment'
      and o.created_at < now() - make_interval(hours => v_hours)
      and not exists (select 1 from public.order_payments op where op.order_id = o.id and op.status in ('submitted', 'verified'))
    for update skip locked
  loop
    perform public.restock_order(v_id);
    update public.orders set status = 'cancelled' where id = v_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- run it every hour with pg_cron (available on Supabase; skipped quietly elsewhere)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'katanim-cancel-unpaid';
  perform cron.schedule('katanim-cancel-unpaid', '7 * * * *', 'select public.cancel_expired_unpaid_orders()');
exception when others then
  raise notice 'pg_cron not available (%). Schedule public.cancel_expired_unpaid_orders() manually.', sqlerrm;
end $$;

-- ---------- S5 + S1 + S6: place_order ------------------------------
create or replace function public.place_order(p_items jsonb, p_shipping jsonb, p_payments jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_weight   numeric := 0;
  v_fee      numeric;
  v_total    numeric;
  v_item     jsonb;
  v_prod     public.products%rowtype;
  v_qty      integer;
  v_price    numeric;
  v_pay      jsonb;
  v_amount   numeric;
  v_pay_sum  numeric := 0;
  v_cap      record;
  v_types    integer;
begin
  if v_uid is null then raise exception 'Please sign in first'; end if;

  -- [S1] limit unpaid orders per customer so stock / GCash capacity can't be hoarded
  if (select count(*) from public.orders
      where user_id = v_uid and status in ('pending_payment', 'payment_rejected')) >= 3 then
    raise exception 'You already have 3 unpaid orders. Please pay for or cancel one before placing another.';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 50 or jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 10 then
    raise exception 'Too many items in one order';
  end if;
  -- [S6] input size limits
  if length(coalesce(p_shipping->>'name', '')) > 120 or length(coalesce(p_shipping->>'phone', '')) > 30
     or length(coalesce(p_shipping->>'address', '')) > 300 or length(coalesce(p_shipping->>'city', '')) > 100
     or length(coalesce(p_shipping->>'province', '')) > 100 or length(coalesce(p_shipping->>'region', '')) > 100
     or length(coalesce(p_shipping->>'zip', '')) > 10 or length(coalesce(p_shipping->>'notes', '')) > 500 then
    raise exception 'Some delivery details are too long';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if p_payments is null or jsonb_array_length(p_payments) = 0 then raise exception 'Please choose a payment method'; end if;
  if coalesce(trim(p_shipping->>'name'), '') = '' or coalesce(trim(p_shipping->>'phone'), '') = ''
     or coalesce(trim(p_shipping->>'address'), '') = '' or coalesce(trim(p_shipping->>'city'), '') = ''
     or coalesce(trim(p_shipping->>'region'), '') = '' then
    raise exception 'Please complete the delivery address';
  end if;

  insert into public.orders (user_id, ship_name, ship_phone, ship_address, ship_city,
                             ship_province, ship_region, ship_zip, notes)
  values (v_uid, trim(p_shipping->>'name'), trim(p_shipping->>'phone'), trim(p_shipping->>'address'),
          trim(p_shipping->>'city'), nullif(trim(p_shipping->>'province'), ''), p_shipping->>'region',
          nullif(trim(p_shipping->>'zip'), ''), nullif(trim(p_shipping->>'notes'), ''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty < 1 then raise exception 'Invalid quantity'; end if;

    select * into v_prod from public.products
    where id = (v_item->>'product_id')::uuid and active
    for update;
    if not found then raise exception 'A product in your cart is no longer available'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Only % left in stock for %', v_prod.stock, v_prod.name;
    end if;

    v_price := public.effective_price(v_prod);
    insert into public.order_items (order_id, product_id, name, unit, unit_price, qty, line_total)
    values (v_order_id, v_prod.id, v_prod.name, v_prod.unit, v_price, v_qty, v_price * v_qty);

    update public.products set stock = stock - v_qty where id = v_prod.id;
    v_subtotal := v_subtotal + v_price * v_qty;
    v_weight   := v_weight + v_prod.weight_kg * v_qty;
  end loop;

  v_fee := public.quote_shipping(p_shipping->>'region', v_weight, p_shipping->>'province');
  if v_fee is null then raise exception 'We do not ship to % yet', p_shipping->>'region'; end if;
  v_total := v_subtotal + v_fee;

  update public.orders
  set subtotal = v_subtotal, shipping_fee = v_fee, total = v_total, total_weight_kg = v_weight
  where id = v_order_id;

  -- payment splits
  if (select count(*) from jsonb_array_elements(p_payments)) <>
     (select count(distinct e->>'method_id') from jsonb_array_elements(p_payments) e) then
    raise exception 'Each payment account can only be used once per order';
  end if;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    v_amount := round((v_pay->>'amount')::numeric, 2);
    if v_amount is null or v_amount <= 0 then raise exception 'Invalid payment amount'; end if;

    -- [S5] lock the account row so two simultaneous orders can't both use the last of its limit
    perform 1 from public.payment_methods where id = (v_pay->>'method_id')::uuid for update;

    select * into v_cap from public.payment_method_capacity() c
    where c.id = (v_pay->>'method_id')::uuid and c.active;
    if not found then raise exception 'Selected payment method is not available'; end if;

    if v_cap.remaining is not null and v_amount > v_cap.remaining then
      raise exception '% can only receive ₱% more right now (transaction limit). Split the payment across another account.',
        v_cap.label, to_char(v_cap.remaining, 'FM999,999,990.00');
    end if;

    insert into public.order_payments (order_id, method_id, amount) values (v_order_id, v_cap.id, v_amount);
    v_pay_sum := v_pay_sum + v_amount;
  end loop;

  select count(distinct pm.type) into v_types
  from jsonb_array_elements(p_payments) e
  join public.payment_methods pm on pm.id = (e->>'method_id')::uuid;
  if jsonb_array_length(p_payments) > 1 and (v_types > 1 or exists (
       select 1 from jsonb_array_elements(p_payments) e
       join public.payment_methods pm on pm.id = (e->>'method_id')::uuid where pm.type <> 'gcash')) then
    raise exception 'Only GCash payments can be split across several accounts';
  end if;

  if abs(v_pay_sum - v_total) > 0.009 then
    raise exception 'Payment amounts (₱%) must add up to the order total (₱%)',
      to_char(v_pay_sum, 'FM999,999,990.00'), to_char(v_total, 'FM999,999,990.00');
  end if;

  return v_order_id;
end $$;

-- ---------- S7: one email per event per status change --------------
create table if not exists public.notification_log (
  order_id  uuid not null references public.orders(id) on delete cascade,
  event     text not null,
  status_at timestamptz not null,
  sent_at   timestamptz not null default now(),
  primary key (order_id, event, status_at)
);
alter table public.notification_log enable row level security;   -- no policies: Edge Function (service role) only

-- ---------- S4: really remove EXECUTE from anonymous visitors ------
-- Postgres grants EXECUTE to PUBLIC by default, so revoking from anon alone has no effect.
do $$
declare f text;
begin
  foreach f in array array[
    'public.place_order(jsonb, jsonb, jsonb)',
    'public.submit_payment_proof(uuid, text, text)',
    'public.manager_review_payment(uuid, boolean, text, boolean, text)',
    'public.manager_update_order(uuid, public.order_status, text, text)',
    'public.customer_mark_received(uuid)',
    'public.customer_cancel_order(uuid)',
    'public.payment_method_capacity()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- internal helpers: nobody calls these directly
  foreach f in array array[
    'public.restock_order(uuid)',
    'public.cancel_expired_unpaid_orders()',
    'public.set_comment_staff()',
    'public.handle_new_user()',
    'public.log_order_status()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage, formatDate, peso } from '../lib/format';
import { CAN_UPLOAD, ORDER_STATUS } from '../lib/status';
import { uploadProof, validateUpload } from '../lib/storage';
import { notify } from '../lib/notify';
import StatusBadge from '../components/StatusBadge.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import ProofViewer from '../components/ProofViewer.jsx';
import Comments from '../components/Comments.jsx';
import Spinner from '../components/Spinner.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export const ORDER_SELECT = `*,
  order_items(*),
  order_payments(*, payment_methods(id, type, label, account_name, account_number, qr_url, instructions)),
  order_comments(*, profiles(full_name, role)),
  order_status_history(*)`;

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single();
    if (err) setError(err.code === 'PGRST116' ? 'Order not found.' : err.message);
    setOrder(data);
  }, [id]);

  useEffect(() => {
    load();
    // live updates when the manager verifies / ships
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  async function markReceived() {
    if (!window.confirm('Confirm that you have received all items in this order?')) return;
    setBusy(true);
    const { error: err } = await supabase.rpc('customer_mark_received', { p_order_id: id });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    notify(id, 'received');
    load();
  }

  async function cancelOrder() {
    setBusy(true);
    const { error: err } = await supabase.rpc('customer_cancel_order', { p_order_id: id });
    setBusy(false);
    setCancelOpen(false);
    if (err) return setError(errorMessage(err));
    load();
  }

  if (!order && !error) return <Spinner />;
  if (!order) return <div className="container narrow"><div className="alert alert-error">{error}</div></div>;

  const st = ORDER_STATUS[order.status];
  const payments = [...(order.order_payments || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const canUpload = CAN_UPLOAD.includes(order.status);
  const managerComments = (order.order_comments || []).filter((c) => c.from_staff);
  const latestNote = managerComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  return (
    <div className="container">
      <Link to="/orders" className="small">← My orders</Link>
      <div className="page-head">
        <div>
          <h1>Order {order.order_no}</h1>
          <div className="muted small">Placed {formatDate(order.created_at)}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {params.get('new') && order.status === 'pending_payment' && (
        <div className="alert alert-success">Order placed! Complete your payment below and upload the proof.</div>
      )}

      <div className={`alert alert-${st?.tone === 'danger' ? 'error' : st?.tone === 'success' ? 'success' : 'info'}`}>
        <strong>Status: {st?.label}</strong> — {st?.help}
        {order.status === 'payment_rejected' && latestNote && (
          <div className="rejection-note">
            <strong>Comment from Katanim:</strong> {latestNote.body}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {['shipped', 'delivered'].includes(order.status) && (
        <div className="card received-card">
          <div>
            <strong>Got your package?</strong>
            <div className="muted small">
              {order.courier}
              {order.tracking_no && <> · Tracking no. <strong>{order.tracking_no}</strong></>}
            </div>
          </div>
          <button className="btn btn-primary" onClick={markReceived} disabled={busy}>
            Received
          </button>
        </div>
      )}

      {['pending_payment', 'payment_rejected'].includes(order.status) &&
        !payments.some((p) => ['submitted', 'verified'].includes(p.status)) && (
          <div className="row end cancel-row">
            <button className="btn btn-danger btn-sm" onClick={() => setCancelOpen(true)} disabled={busy}>
              Cancel order
            </button>
          </div>
        )}
      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        confirmLabel="Yes, cancel order"
        cancelLabel="Keep order"
        busy={busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={cancelOrder}
      >
        <p>The items go back on sale and you won't be able to pay for this order anymore. Unpaid orders are also cancelled automatically after 48 hours.</p>
      </ConfirmDialog>

      <div className="two-col">
        <div className="stack">
          <section className="card">
            <h3>Payment</h3>
            <p className="muted small">
              Pay each amount below by scanning the QR code or sending to the account, then upload a screenshot/receipt.
            </p>
            <div className="payments">
              {payments.map((p, idx) => (
                <PaymentBox
                  key={p.id}
                  payment={p}
                  index={idx + 1}
                  count={payments.length}
                  order={order}
                  canUpload={canUpload}
                  onDone={load}
                />
              ))}
            </div>
          </section>

          <Comments
            orderId={order.id}
            comments={order.order_comments}
            onChange={load}
            highlight={order.status === 'payment_rejected'}
          />
        </div>

        <aside className="stack">
          <section className="card">
            <h3>Items</h3>
            <ul className="summary-lines">
              {order.order_items.map((i) => (
                <li key={i.id}>
                  <span>{i.name} × {i.qty}</span>
                  <span>{peso(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <div className="row between"><span>Subtotal</span><span>{peso(order.subtotal)}</span></div>
            <div className="row between"><span>Shipping ({order.total_weight_kg} kg)</span><span>{peso(order.shipping_fee)}</span></div>
            <div className="row between total"><span>Total</span><span>{peso(order.total)}</span></div>
          </section>
          <section className="card">
            <h3>Deliver to</h3>
            <p className="small">
              <strong>{order.ship_name}</strong> · {order.ship_phone}
              <br />
              {order.ship_address}, {order.ship_city}
              {order.ship_province && `, ${order.ship_province}`}
              <br />
              {order.ship_region} {order.ship_zip}
            </p>
          </section>
          <section className="card">
            <h3>History</h3>
            <OrderTimeline history={order.order_status_history} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function PaymentBox({ payment, index, count, order, canUpload, onDone }) {
  const { user } = useAuth();
  const m = payment.payment_methods || {};
  const [file, setFile] = useState(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const needsProof = canUpload && ['awaiting_proof', 'rejected'].includes(payment.status);
  const canReplace = canUpload && payment.status === 'submitted';
  const [replacing, setReplacing] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const invalid = validateUpload(file, { allowPdf: true });
    if (invalid) return setError(invalid);
    setBusy(true);
    setError('');
    try {
      const path = await uploadProof(user.id, order.id, payment.id, file);
      const { data: newStatus, error: err } = await supabase.rpc('submit_payment_proof', {
        p_payment_id: payment.id,
        p_proof_path: path,
        p_reference: reference,
      });
      if (err) throw err;
      if (newStatus === 'for_verification' && order.status !== 'for_verification') notify(order.id, 'proof_submitted');
      setFile(null);
      setReference('');
      setReplacing(false);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`payment-box status-${payment.status}`}>
      <div className="payment-head">
        <div>
          <div className="eyebrow">{count > 1 ? `Payment ${index} of ${count}` : 'Payment'}</div>
          <strong>{m.label}</strong>
        </div>
        <div className="right">
          <div className="price">{peso(payment.amount)}</div>
          <StatusBadge status={payment.status} kind="payment" />
        </div>
      </div>

      {(needsProof || payment.status === 'awaiting_proof') && (
        <div className="pay-instructions">
          {m.qr_url ? (
            <a href={m.qr_url} target="_blank" rel="noreferrer" className="qr">
              <img src={m.qr_url} alt={`${m.label} QR code`} />
              <span className="muted small">Tap to enlarge</span>
            </a>
          ) : (
            <div className="qr qr-missing muted small">QR not available — send to the account below</div>
          )}
          <div className="small">
            <div><span className="muted">Account name:</span> <strong>{m.account_name}</strong></div>
            <div><span className="muted">Account no.:</span> <strong>{m.account_number}</strong></div>
            <div><span className="muted">Amount:</span> <strong>{peso(payment.amount)}</strong></div>
            {m.instructions && <p className="muted">{m.instructions}</p>}
          </div>
        </div>
      )}

      {payment.status === 'rejected' && payment.review_note && (
        <div className="alert alert-error small"><strong>Why it wasn't verified:</strong> {payment.review_note}</div>
      )}

      {payment.proof_path && (
        <div className="row small">
          <ProofViewer path={payment.proof_path} />
          {payment.reference_no && <span className="muted">Ref: {payment.reference_no}</span>}
          {payment.submitted_at && <span className="muted">Uploaded {formatDate(payment.submitted_at)}</span>}
          {canReplace && !replacing && (
            <button className="link" onClick={() => setReplacing(true)}>Replace proof</button>
          )}
        </div>
      )}

      {(needsProof || replacing) && (
        <form className="form upload-form" onSubmit={submit}>
          <label className="field">
            {payment.status === 'rejected' ? 'Upload a new proof of payment' : 'Upload proof of payment'}
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <label className="field">
            Reference no. (optional)
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. GCash ref 1234 567 890" />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" disabled={busy || !file}>{busy ? 'Uploading…' : 'Submit proof'}</button>
        </form>
      )}
    </div>
  );
}

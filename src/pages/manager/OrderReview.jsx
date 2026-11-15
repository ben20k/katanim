import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { errorMessage, formatDate, peso } from '../../lib/format';
import { ORDER_SELECT } from '../OrderDetail.jsx';
import { notify } from '../../lib/notify';
import StatusBadge from '../../components/StatusBadge.jsx';
import OrderTimeline from '../../components/OrderTimeline.jsx';
import ProofViewer from '../../components/ProofViewer.jsx';
import Comments from '../../components/Comments.jsx';
import Spinner from '../../components/Spinner.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

export default function OrderReview() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('orders')
      .select(`${ORDER_SELECT}, profiles(full_name, email, phone)`)
      .eq('id', id)
      .single();
    if (err) setError(err.message);
    setOrder(data);
    setTracking(data?.tracking_no || '');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(status) {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Stock will be returned to inventory.')) return;
    if (status === 'shipped' && !tracking.trim() && !window.confirm('Ship without a tracking number?')) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('manager_update_order', {
      p_order_id: id,
      p_status: status,
      p_tracking: tracking || null,
      p_note: note || null,
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    setNote('');
    notify(id, status);
    load();
  }

  if (!order && !error) return <Spinner />;
  if (!order) return <div className="alert alert-error">{error}</div>;

  const payments = [...order.order_payments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <>
      <Link to="/manager/orders" className="small">← All orders</Link>
      <div className="page-head">
        <div>
          <h1>{order.order_no}</h1>
          <div className="muted small">Placed {formatDate(order.created_at)}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="two-col">
        <div className="stack">
          <section className="card">
            <h3>Verify payment{payments.length > 1 ? `s (${payments.length} splits)` : ''}</h3>
            <p className="muted small">
              Check that each amount arrived in the account shown (bank / GCash app), then verify. If you cannot find it,
              reject with a comment — the customer sees it on their order page and by email.
            </p>
            {payments.map((p, idx) => (
              <ReviewPayment
                key={p.id}
                payment={p}
                index={idx + 1}
                count={payments.length}
                orderId={order.id}
                orderStatus={order.status}
                onDone={load}
              />
            ))}
          </section>

          <section className="card">
            <h3>Fulfilment</h3>
            <div className="form grid-2">
              <label className="field">
                Courier
                <input value={order.courier || 'J&T Express'} disabled />
              </label>
              <label className="field">
                Tracking number
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="J&T waybill no." />
              </label>
              <label className="field span-2">
                Note to customer (optional)
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="row wrap">
              <button className="btn btn-primary" disabled={busy || order.status !== 'payment_verified'} onClick={() => updateStatus('shipped')}>
                Mark as shipped
              </button>
              <button className="btn btn-outline" disabled={busy || order.status !== 'shipped'} onClick={() => updateStatus('delivered')}>
                Mark as delivered
              </button>
              <button
                className="btn btn-danger"
                disabled={busy || ['shipped', 'delivered', 'received', 'cancelled'].includes(order.status)}
                onClick={() => updateStatus('cancelled')}
              >
                Cancel order
              </button>
            </div>
            {order.status === 'received' && (
              <div className="alert alert-success">Customer confirmed receipt on {formatDate(order.received_at)}.</div>
            )}
          </section>

          <Comments orderId={order.id} comments={order.order_comments} onChange={load} />
        </div>

        <aside className="stack">
          <section className="card">
            <h3>Customer</h3>
            <p className="small">
              <strong>{order.profiles?.full_name}</strong>
              <br />
              {order.profiles?.email}
              <br />
              {order.profiles?.phone}
            </p>
            <h4>Ship to</h4>
            <p className="small">
              {order.ship_name} · {order.ship_phone}
              <br />
              {order.ship_address}, {order.ship_city}
              {order.ship_province && `, ${order.ship_province}`}
              <br />
              {order.ship_region} {order.ship_zip}
            </p>
            {order.notes && <p className="small"><strong>Notes:</strong> {order.notes}</p>}
          </section>
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
            <h3>History</h3>
            <OrderTimeline history={order.order_status_history} />
          </section>
        </aside>
      </div>
    </>
  );
}

const CLOSED = ['payment_verified', 'shipped', 'delivered', 'received', 'cancelled'];

function ReviewPayment({ payment, index, count, orderId, orderStatus, onDone }) {
  const m = payment.payment_methods || {};
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reference, setReference] = useState('');

  const hasProof = payment.status === 'submitted' && Boolean(payment.proof_path);
  const reviewable = !CLOSED.includes(orderStatus) && payment.status !== 'verified';

  async function review(approve, withoutProof = false) {
    if (!approve && !comment.trim()) return setError('Add a comment so the customer knows what to fix.');
    setBusy(true);
    setError('');
    const { data: newStatus, error: err } = await supabase.rpc('manager_review_payment', {
      p_payment_id: payment.id,
      p_approve: approve,
      p_comment: comment || null,
      p_without_proof: withoutProof,
      p_reference: withoutProof ? reference || null : null,
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    setComment('');
    setReference('');
    setConfirmOpen(false);
    if (newStatus === 'payment_verified') notify(orderId, 'payment_verified');
    if (newStatus === 'payment_rejected' && !approve) notify(orderId, 'payment_rejected');
    onDone();
  }

  // Verify: straight through when there is a proof, otherwise ask for confirmation first.
  function handleVerify() {
    setError('');
    if (hasProof) review(true);
    else setConfirmOpen(true);
  }

  return (
    <div className={`payment-box status-${payment.status}`}>
      <div className="payment-head">
        <div>
          <div className="eyebrow">{count > 1 ? `Payment ${index} of ${count}` : 'Payment'}</div>
          <strong>{m.label}</strong>
          <div className="muted small">{m.account_name} · {m.account_number}</div>
        </div>
        <div className="right">
          <div className="price">{peso(payment.amount)}</div>
          <StatusBadge status={payment.status} kind="payment" />
          {payment.verified_without_proof && <span className="badge badge-warn">Verified without proof</span>}
        </div>
      </div>

      {payment.proof_path ? (
        <div className="review-proof">
          <ProofViewer path={payment.proof_path} inline />
          <div className="small">
            <div><span className="muted">Reference no.:</span> <strong>{payment.reference_no || '—'}</strong></div>
            <div><span className="muted">Uploaded:</span> {formatDate(payment.submitted_at)}</div>
            {payment.reviewed_at && <div><span className="muted">Reviewed:</span> {formatDate(payment.reviewed_at)}</div>}
            {payment.review_note && <div><span className="muted">Note:</span> {payment.review_note}</div>}
          </div>
        </div>
      ) : (
        <p className="muted small">
          Customer has not uploaded proof for this payment.
          {payment.reference_no && <> Reference no.: <strong>{payment.reference_no}</strong></>}
        </p>
      )}

      {reviewable && hasProof && (
        <div className="form">
          <textarea
            rows={2}
            placeholder="Comment (required when you can't verify — e.g. 'Amount not received in GCash 0917…', 'Screenshot is unreadable')"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && <div className="alert alert-error">{error}</div>}
          <div className="row wrap">
            <button className="btn btn-primary" disabled={busy} onClick={handleVerify}>✓ Payment received — verify</button>
            <button className="btn btn-danger" disabled={busy} onClick={() => review(false)}>✕ Cannot verify</button>
          </div>
        </div>
      )}

      {reviewable && !hasProof && (
        <div className="no-proof">
          <div className="alert alert-warn small">
            <strong>No proof of payment attached.</strong>{' '}
            {payment.status === 'rejected'
              ? 'The last proof was not verified and no new one has been uploaded.'
              : 'You can still verify it if you have confirmed the money arrived in the account.'}
          </div>
          {error && !confirmOpen && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-outline" disabled={busy} onClick={handleVerify}>
            ✓ Verify without proof…
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="No proof of payment attached"
        confirmLabel="Confirm & verify payment"
        agreeLabel={`I agree — I checked ${m.label || 'the account'} and confirmed that ${peso(payment.amount)} was received.`}
        busy={busy}
        onCancel={() => {
          setConfirmOpen(false);
          setError('');
        }}
        onConfirm={() => review(true, true)}
      >
        <p>
          This payment has <strong>no proof of payment</strong>. Only continue if you have checked the account and the
          money is there:
        </p>
        <ul className="confirm-facts">
          <li><span>Account</span><strong>{m.label}</strong></li>
          <li><span>Number</span><strong>{m.account_number || '—'}</strong></li>
          <li><span>Amount</span><strong>{peso(payment.amount)}</strong></li>
        </ul>
        <label className="field">
          Reference no. from the bank / GCash app (optional)
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 1234 567 890" />
        </label>
        <p className="muted small">
          This is recorded on the order as &ldquo;verified without proof&rdquo;, with your name and the time.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
      </ConfirmDialog>
    </div>
  );
}

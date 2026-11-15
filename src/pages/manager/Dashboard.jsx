import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatDate, peso } from '../../lib/format';
import { ORDER_STATUS } from '../../lib/status';
import StatusBadge from '../../components/StatusBadge.jsx';
import CapacityCard from '../../components/CapacityCard.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function Dashboard() {
  const [orders, setOrders] = useState(null);
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase
        .from('orders')
        .select('id, order_no, status, total, created_at, ship_name')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.rpc('payment_method_capacity'),
    ]).then(([o, m]) => {
      setOrders(o.data || []);
      setMethods(m.data || []);
    });
  }, []);

  if (!orders) return <Spinner />;

  const counts = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
  const toVerify = orders.filter((o) => o.status === 'for_verification');
  const gcash = methods.filter((m) => m.type === 'gcash');
  const limitHit = gcash.filter((m) => m.remaining != null && Number(m.remaining) <= 0);

  return (
    <>
      <h1>Dashboard</h1>

      {limitHit.length > 0 && (
        <div className="alert alert-error">
          <strong>GCash limit reached:</strong> {limitHit.map((m) => m.label).join(', ')}. Customers can no longer select
          {limitHit.length > 1 ? ' these accounts' : ' this account'} until the limit resets.
        </div>
      )}

      <div className="stat-grid">
        {['for_verification', 'pending_payment', 'payment_rejected', 'payment_verified', 'shipped'].map((s) => (
          <Link key={s} to={`/manager/orders?status=${s}`} className={`stat stat-${ORDER_STATUS[s].tone}`}>
            <span className="stat-num">{counts[s] || 0}</span>
            <span className="stat-label">{ORDER_STATUS[s].label}</span>
          </Link>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Payments waiting for verification</h2>
          <Link to="/manager/orders?status=for_verification" className="small">View all</Link>
        </div>
        {toVerify.length === 0 ? (
          <p className="muted">Nothing to verify right now. 🎉</p>
        ) : (
          <div className="card">
            <table className="table">
              <tbody>
                {toVerify.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/manager/orders/${o.id}`}><strong>{o.order_no}</strong></Link></td>
                    <td>{o.ship_name}</td>
                    <td className="muted small">{formatDate(o.created_at)}</td>
                    <td className="right">{peso(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>GCash transaction limits</h2>
          <Link to="/manager/payment-methods" className="small">Manage accounts</Link>
        </div>
        <div className="capacity-grid">
          {gcash.map((m) => (
            <CapacityCard key={m.id} method={m} />
          ))}
          {gcash.length === 0 && <p className="muted">No GCash accounts configured.</p>}
        </div>
      </section>
    </>
  );
}

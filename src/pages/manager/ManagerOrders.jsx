import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatDate, peso } from '../../lib/format';
import { ORDER_STATUS } from '../../lib/status';
import StatusBadge from '../../components/StatusBadge.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function ManagerOrders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const [orders, setOrders] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase
      .from('orders')
      .select('id, order_no, status, total, created_at, ship_name, ship_region, profiles(full_name, email), order_payments(count)')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data }) => setOrders(data || []));
  }, []);

  if (!orders) return <Spinner />;

  const counts = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});
  const shown = orders.filter(
    (o) =>
      (status === 'all' || o.status === status) &&
      (!q ||
        `${o.order_no} ${o.ship_name} ${o.profiles?.email || ''}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <div className="page-head">
        <h1>Orders &amp; payments</h1>
        <input className="search" type="search" placeholder="Search order no., name, email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        <button className={`chip ${status === 'all' ? 'active' : ''}`} onClick={() => setParams({})}>
          All ({orders.length})
        </button>
        {Object.entries(ORDER_STATUS).map(([key, s]) => (
          <button key={key} className={`chip ${status === key ? 'active' : ''}`} onClick={() => setParams({ status: key })}>
            {s.label} ({counts[key] || 0})
          </button>
        ))}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Region</th>
              <th>Placed</th>
              <th className="right">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/manager/orders/${o.id}`}><strong>{o.order_no}</strong></Link>
                  {o.order_payments?.[0]?.count > 1 && <div className="muted small">{o.order_payments[0].count} split payments</div>}
                </td>
                <td>
                  {o.profiles?.full_name || o.ship_name}
                  <div className="muted small">{o.profiles?.email}</div>
                </td>
                <td className="small">{o.ship_region}</td>
                <td className="small muted">{formatDate(o.created_at)}</td>
                <td className="right">{peso(o.total)}</td>
                <td><StatusBadge status={o.status} /></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="muted">No orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

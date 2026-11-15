import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate, peso } from '../lib/format';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    supabase
      .from('orders')
      .select('id, order_no, status, total, created_at, order_items(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders(data || []));
  }, [user.id]);

  if (!orders) return <Spinner />;

  return (
    <div className="container">
      <h1>My orders</h1>
      {orders.length === 0 ? (
        <div className="card empty">
          <p>You have no orders yet.</p>
          <Link to="/" className="btn btn-primary">Start shopping</Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="card order-row">
              <div>
                <strong>{o.order_no}</strong>
                <div className="muted small">
                  {formatDate(o.created_at)} · {o.order_items?.[0]?.count ?? 0} item(s)
                </div>
              </div>
              <StatusBadge status={o.status} />
              <strong>{peso(o.total)}</strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

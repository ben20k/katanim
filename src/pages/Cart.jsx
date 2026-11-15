import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { peso } from '../lib/format';

export default function Cart() {
  const { items, update, remove, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="container narrow">
        <div className="card empty">
          <div className="empty-icon">🧺</div>
          <h2>Your cart is empty</h2>
          <Link to="/" className="btn btn-primary">Browse products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Cart</h1>
      <div className="two-col">
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Qty</th>
                <th className="right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.product_id}>
                  <td>
                    <div className="row">
                      {i.image_url ? <img className="thumb" src={i.image_url} alt="" /> : <span className="thumb">🌱</span>}
                      <span>{i.name}</span>
                    </div>
                  </td>
                  <td>{peso(i.price)}</td>
                  <td>
                    <input
                      className="qty"
                      type="number"
                      min={1}
                      max={i.stock}
                      value={i.qty}
                      onChange={(e) => update(i.product_id, Number(e.target.value) || 1)}
                    />
                  </td>
                  <td className="right">{peso(i.price * i.qty)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(i.product_id)} aria-label="Remove">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="card summary">
          <h3>Summary</h3>
          <div className="row between"><span>Subtotal</span><strong>{peso(subtotal)}</strong></div>
          <div className="row between muted small"><span>Shipping (J&amp;T)</span><span>Calculated at checkout</span></div>
          <Link to="/checkout" className="btn btn-primary btn-block">Proceed to checkout</Link>
          <Link to="/" className="btn btn-ghost btn-block">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}

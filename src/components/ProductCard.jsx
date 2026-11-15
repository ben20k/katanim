import { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { effectivePrice, isPromoActive, peso } from '../lib/format';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const promo = isPromoActive(product);
  const out = product.stock <= 0;
  const savePct = promo ? Math.round((1 - product.promo_price / product.price) * 100) : 0;

  function handleAdd() {
    add(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className={`product-card ${promo ? 'is-promo' : ''}`}>
      <div className="product-img">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" />
        ) : (
          <img className="product-placeholder" src="/brand/katanim-emblem.webp" alt="" />
        )}
        {promo && (
          <span className="promo-tag">
            {product.promo_label || 'Promo'}
            {savePct > 0 && ` · -${savePct}%`}
          </span>
        )}
      </div>
      <div className="product-body">
        <div className="eyebrow">{product.category}</div>
        <h3>{product.name}</h3>
        {product.description && <p className="muted small clamp">{product.description}</p>}
        <div className="price-row">
          <span className="price">{peso(effectivePrice(product))}</span>
          {promo && <s className="muted small">{peso(product.price)}</s>}
          <span className="muted small">/ {product.unit}</span>
        </div>
        {promo && product.promo_ends_at && (
          <div className="small promo-ends">Until {new Date(product.promo_ends_at).toLocaleDateString('en-PH')}</div>
        )}
        <div className="muted small">{out ? 'Out of stock' : `${product.stock} in stock`}</div>
        <button className="btn btn-primary btn-block" disabled={out} onClick={handleAdd}>
          {out ? 'Out of stock' : added ? 'Added ✓' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isPromoActive } from '../lib/format';
import ProductCard from '../components/ProductCard.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setProducts(data || []);
        setLoading(false);
      });
  }, []);

  const promos = useMemo(() => products.filter(isPromoActive), [products]);
  const categories = useMemo(
    () => ['All', ...new Set(products.map((p) => p.category).filter(Boolean))],
    [products],
  );
  const filtered = products.filter(
    (p) =>
      (category === 'All' || p.category === category) &&
      (!query || `${p.name} ${p.description || ''}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow light">Katanim Modern Agriculture</span>
            <h1>Grow more with smarter farm inputs.</h1>
            <p>
              Quality seeds, organic fertilizers, drip irrigation and hydroponic kits — shipped nationwide through J&amp;T
              Express. Pay by GCash, Maya or bank QR.
            </p>
            <a href="#products" className="btn btn-lime">Shop now</a>
          </div>
          <div className="hero-art" aria-hidden="true">🌾</div>
        </div>
      </section>

      <div className="container">
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <Spinner />
        ) : (
          <>
            {promos.length > 0 && (
              <section className="section">
                <div className="section-head">
                  <h2>🔥 Promo deals</h2>
                  <span className="muted small">Limited-time prices</span>
                </div>
                <div className="product-grid">
                  {promos.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            )}

            <section className="section" id="products">
              <div className="section-head">
                <h2>All products</h2>
                <input
                  className="search"
                  type="search"
                  placeholder="Search products…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="chips">
                {categories.map((c) => (
                  <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>
                    {c}
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="muted">No products match your search.</p>
              ) : (
                <div className="product-grid">
                  {filtered.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

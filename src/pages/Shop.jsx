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
          <div className="hero-copy">
            <span className="hashtag">#Katanim</span>
            <h1>
              Grow clean, fresh greens <span className="text-water">the hydroponic way.</span>
            </h1>
            <p>
              Hydroponic kits, seeds, nutrients and farm inputs from Katanim Modern Agriculture — delivered nationwide
              through J&amp;T Express. Pay with GCash, Maya or bank QR.
            </p>
            <div className="row wrap">
              <a href="#products" className="btn btn-primary btn-lg">Shop now</a>
              {categories.includes('Hydroponics') && (
                <a
                  href="#products"
                  className="btn btn-outline btn-lg"
                  onClick={() => setCategory('Hydroponics')}
                >
                  Hydroponic kits
                </a>
              )}
            </div>
            <p className="tagline-script">So clean, so good.</p>
          </div>
          <img
            className="hero-art"
            src="/brand/how-i-grow-hydroponics.webp"
            alt="This is how I grow hydroponics — #Katanim"
            width="1100"
            height="732"
          />
        </div>
        <div className="container perks">
          <div className="perk"><span className="perk-icon perk-water">💧</span><div><strong>Soil-free growing</strong><span>Kits &amp; nutrients for hydroponics</span></div></div>
          <div className="perk"><span className="perk-icon perk-leaf">🌱</span><div><strong>Quality seeds &amp; inputs</strong><span>For backyard and farm growers</span></div></div>
          <div className="perk"><span className="perk-icon perk-sun">🚚</span><div><strong>Nationwide delivery</strong><span>Shipping fee computed at checkout</span></div></div>
          <div className="perk"><span className="perk-icon perk-soil">📱</span><div><strong>GCash · Maya · QR</strong><span>Upload proof, we verify fast</span></div></div>
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

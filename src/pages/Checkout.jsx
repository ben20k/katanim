import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { effectivePrice, errorMessage, peso, round2 } from '../lib/format';
import { PAYMENT_TYPE_LABEL } from '../lib/status';
import { notify } from '../lib/notify';
import Spinner from '../components/Spinner.jsx';

const capOf = (m) => (m.remaining == null ? Infinity : Number(m.remaining));

export default function Checkout() {
  const { profile } = useAuth();
  const { items, clear } = useCart();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [lane, setLane] = useState(null); // { dest_name, eta }
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  const [ship, setShip] = useState({
    name: '', phone: '', address: '', city: '', province: '', region: '', zip: '', notes: '',
  });
  const [fee, setFee] = useState(null);
  const [feeError, setFeeError] = useState('');

  const [payType, setPayType] = useState('');
  const [splits, setSplits] = useState([]); // [{ method_id, amount }]
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  // initial data
  useEffect(() => {
    const ids = items.map((i) => i.product_id);
    Promise.all([
      ids.length ? supabase.from('products').select('*').in('id', ids) : Promise.resolve({ data: [] }),
      supabase.from('shipping_regions').select('region, zone_code, sort').order('sort'),
      supabase.from('shipping_provinces').select('province, region').order('province'),
      supabase.rpc('payment_method_capacity'),
    ]).then(([p, r, pv, m]) => {
      setProducts(p.data || []);
      setRegions(r.data || []);
      setProvinces(pv.data || []);
      setMethods((m.data || []).filter((x) => x.active));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) {
      setShip((s) => ({ ...s, name: s.name || profile.full_name || '', phone: s.phone || profile.phone || '' }));
    }
  }, [profile]);

  // cart lines priced from the latest product data
  const lines = useMemo(
    () =>
      items
        .map((i) => {
          const p = products.find((x) => x.id === i.product_id);
          if (!p) return null;
          return { ...i, product: p, price: effectivePrice(p), ok: p.active && p.stock >= i.qty };
        })
        .filter(Boolean),
    [items, products],
  );
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const weight = round2(lines.reduce((s, l) => s + Number(l.product.weight_kg || 0) * l.qty, 0));
  const problems = lines.filter((l) => !l.ok);

  // 0.1 automatic shipping fee
  // J&T rate card: origin zone × destination (province, else region) × weight bracket
  const regionProvinces = provinces.filter((p) => p.region === ship.region);
  useEffect(() => {
    if (!ship.region || (regionProvinces.length > 0 && !ship.province)) {
      setFee(null);
      setLane(null);
      return;
    }
    setFeeError('');
    supabase
      .rpc('shipping_quote', { p_region: ship.region, p_weight_kg: weight, p_province: ship.province || null })
      .then(({ data, error: err }) => {
        const q = Array.isArray(data) ? data[0] : data;
        if (err || !q) {
          setFee(null);
          setLane(null);
          setFeeError(err ? err.message : 'We do not ship to this area yet.');
        } else {
          setFee(Number(q.fee));
          setLane(q);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ship.region, ship.province, weight, regionProvinces.length]);

  const total = fee == null ? null : round2(subtotal + fee);
  const types = [...new Set(methods.map((m) => m.type))];
  const ofType = methods.filter((m) => m.type === payType);
  const isGcash = payType === 'gcash';

  // default split: one account of the chosen type with the most remaining capacity
  useEffect(() => {
    if (!payType || total == null) {
      setSplits([]);
      return;
    }
    const best = [...methods.filter((m) => m.type === payType)].sort((a, b) => capOf(b) - capOf(a))[0];
    setSplits(best ? [{ method_id: best.id, amount: total }] : []);
  }, [payType, total, methods]);

  const allocated = round2(splits.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const unallocated = total == null ? 0 : round2(total - allocated);
  const gcashCapacity = methods.filter((m) => m.type === 'gcash').reduce((s, m) => s + capOf(m), 0);

  const splitErrors = splits.map((s) => {
    const m = methods.find((x) => x.id === s.method_id);
    if (!m) return 'Choose an account';
    if (!(Number(s.amount) > 0)) return 'Enter an amount';
    if (Number(s.amount) > capOf(m)) return `Limit reached — this account can only receive ${peso(m.remaining)} more`;
    return '';
  });

  function setSplit(idx, patch) {
    setSplits((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addSplit() {
    const used = new Set(splits.map((s) => s.method_id));
    const next = ofType.filter((m) => !used.has(m.id)).sort((a, b) => capOf(b) - capOf(a))[0];
    if (!next) return;
    setSplits((prev) => [...prev, { method_id: next.id, amount: Math.max(0, Math.min(unallocated, capOf(next))) }]);
  }

  // Fill accounts in order of remaining capacity until the total is covered
  function autoSplit() {
    let left = total;
    const out = [];
    for (const m of [...ofType].sort((a, b) => capOf(b) - capOf(a))) {
      if (left <= 0) break;
      const amt = round2(Math.min(left, capOf(m)));
      if (amt > 0) {
        out.push({ method_id: m.id, amount: amt });
        left = round2(left - amt);
      }
    }
    setSplits(out);
    if (left > 0) setError(`All GCash accounts combined can only receive ${peso(total - left)} right now. Please choose another payment method.`);
    else setError('');
  }

  const set = (k) => (e) => setShip({ ...ship, [k]: e.target.value });

  const canPlace =
    lines.length > 0 &&
    problems.length === 0 &&
    total != null &&
    splits.length > 0 &&
    Math.abs(unallocated) < 0.01 &&
    splitErrors.every((e) => !e) &&
    new Set(splits.map((s) => s.method_id)).size === splits.length;

  async function placeOrder(e) {
    e.preventDefault();
    if (!canPlace) return;
    setPlacing(true);
    setError('');
    const { data: orderId, error: err } = await supabase.rpc('place_order', {
      p_items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
      p_shipping: ship,
      p_payments: splits.map((s) => ({ method_id: s.method_id, amount: round2(s.amount) })),
    });
    setPlacing(false);
    if (err) return setError(errorMessage(err));
    clear();
    notify(orderId, 'order_placed');
    navigate(`/orders/${orderId}?new=1`);
  }

  if (loading) return <Spinner />;
  if (items.length === 0) {
    return (
      <div className="container narrow">
        <div className="card empty">
          <h2>Your cart is empty</h2>
          <Link to="/" className="btn btn-primary">Browse products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Checkout</h1>
      <form className="two-col" onSubmit={placeOrder}>
        <div className="stack">
          {/* Delivery */}
          <section className="card">
            <h3>1. Delivery address</h3>
            <div className="form grid-2">
              <label className="field">Recipient name<input required value={ship.name} onChange={set('name')} /></label>
              <label className="field">Mobile number<input required value={ship.phone} onChange={set('phone')} /></label>
              <label className="field span-2">
                House no., street, barangay
                <input required value={ship.address} onChange={set('address')} />
              </label>
              <label className="field">City / Municipality<input required value={ship.city} onChange={set('city')} /></label>
              <label className="field">
                Region
                <select
                  required
                  value={ship.region}
                  onChange={(e) => {
                    const region = e.target.value;
                    const only = provinces.filter((p) => p.region === region);
                    setShip({ ...ship, region, province: only.length === 1 ? only[0].province : '' });
                  }}
                >
                  <option value="">Select region…</option>
                  {regions.map((r) => (
                    <option key={r.region} value={r.region}>{r.region}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Province
                {regionProvinces.length > 0 ? (
                  <select required value={ship.province} onChange={set('province')}>
                    <option value="">Select province…</option>
                    {regionProvinces.map((p) => (
                      <option key={p.province} value={p.province}>{p.province}</option>
                    ))}
                  </select>
                ) : (
                  <input value={ship.province} onChange={set('province')} disabled={!ship.region} placeholder={ship.region ? '' : 'Select a region first'} />
                )}
              </label>
              <label className="field">ZIP code<input value={ship.zip} onChange={set('zip')} /></label>
              <label className="field span-2">
                Notes for the rider (optional)
                <input value={ship.notes} onChange={set('notes')} />
              </label>
            </div>
            {feeError && <div className="alert alert-error">{feeError}</div>}
            {lane && fee != null && (
              <div className="ship-quote">
                <span>🚚 J&amp;T Express to <strong>{lane.dest_name}</strong></span>
                <span>{peso(fee)}{lane.eta ? ` · ${lane.eta}` : ''}</span>
              </div>
            )}
          </section>

          {/* Payment */}
          <section className="card">
            <h3>2. Payment method</h3>
            {total == null ? (
              <p className="muted">Select your region first so we can compute the total.</p>
            ) : (
              <>
                <div className="pay-types">
                  {types.map((t) => (
                    <label key={t} className={`pay-type ${payType === t ? 'active' : ''}`}>
                      <input type="radio" name="paytype" value={t} checked={payType === t} onChange={() => setPayType(t)} />
                      <span>{PAYMENT_TYPE_LABEL[t] || t}</span>
                      <small className="muted">{t === 'gcash' ? 'QR / send money · can split' : 'QR / transfer'}</small>
                    </label>
                  ))}
                </div>

                {payType && (
                  <div className="splits">
                    {splits.map((s, idx) => {
                      const m = methods.find((x) => x.id === s.method_id);
                      return (
                        <div className="split-row" key={idx}>
                          <select value={s.method_id} onChange={(e) => setSplit(idx, { method_id: e.target.value })}>
                            {ofType.map((opt) => (
                              <option
                                key={opt.id}
                                value={opt.id}
                                disabled={opt.id !== s.method_id && splits.some((x) => x.method_id === opt.id)}
                              >
                                {opt.label}
                                {opt.remaining != null ? ` — ${capOf(opt) <= 0 ? 'LIMIT REACHED' : `up to ${peso(opt.remaining)}`}` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="amount-input">
                            <span>₱</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={s.amount}
                              readOnly={!isGcash}
                              onChange={(e) => setSplit(idx, { amount: e.target.value })}
                            />
                          </div>
                          {splits.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                            >
                              ✕
                            </button>
                          )}
                          {splitErrors[idx] && <div className="split-error">{splitErrors[idx]}</div>}
                          {m?.account_number && (
                            <div className="muted small split-meta">
                              {m.account_name} · {m.account_number}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isGcash && (
                      <div className="row wrap">
                        {splits.length < ofType.length && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={addSplit}>
                            + Pay part with another GCash account
                          </button>
                        )}
                        {ofType.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={autoSplit}>
                            Auto-split across GCash accounts
                          </button>
                        )}
                      </div>
                    )}

                    {isGcash && total > 0 && gcashCapacity < total && (
                      <div className="alert alert-warn">
                        GCash accounts can only receive {peso(gcashCapacity)} in total right now (transaction limits). Please
                        choose bank transfer or Maya.
                      </div>
                    )}
                    {Math.abs(unallocated) >= 0.01 && (
                      <div className="alert alert-warn">
                        {unallocated > 0
                          ? `${peso(unallocated)} still unassigned — add another GCash account or adjust amounts.`
                          : `Amounts exceed the total by ${peso(-unallocated)}.`}
                      </div>
                    )}
                    <p className="muted small">
                      After placing the order you'll see the QR code(s) and account details, then upload your proof of
                      payment for each part.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="card summary sticky">
          <h3>Order summary</h3>
          <ul className="summary-lines">
            {lines.map((l) => (
              <li key={l.product_id} className={l.ok ? '' : 'text-danger'}>
                <span>{l.name} × {l.qty}</span>
                <span>{peso(l.price * l.qty)}</span>
                {!l.ok && <small>Only {l.product.stock} left — update your cart</small>}
              </li>
            ))}
          </ul>
          <div className="row between"><span>Subtotal</span><span>{peso(subtotal)}</span></div>
          <div className="row between">
            <span>Shipping · J&amp;T ({weight} kg{lane?.dest_name ? ` · ${lane.dest_name}` : ''})</span>
            <span>{fee == null ? '—' : peso(fee)}</span>
          </div>
          <div className="row between total"><span>Total</span><span>{total == null ? '—' : peso(total)}</span></div>
          {problems.length > 0 && (
            <div className="alert alert-error">Some items are no longer available in that quantity. <Link to="/cart">Edit cart</Link></div>
          )}
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={!canPlace || placing}>
            {placing ? 'Placing order…' : 'Place order'}
          </button>
        </aside>
      </form>
    </div>
  );
}

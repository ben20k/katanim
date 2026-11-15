import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { errorMessage, isPromoActive, peso } from '../../lib/format';
import { uploadPublicAsset, validateUpload } from '../../lib/storage';
import Spinner from '../../components/Spinner.jsx';

const EMPTY = {
  name: '', description: '', category: '', unit: 'pc', price: '', stock: 0, weight_kg: 1, image_url: '', active: true,
  is_promo: false, promo_price: '', promo_label: '', promo_ends_at: '',
};

// ISO timestamp → value for <input type="datetime-local"> in the browser's timezone
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function ManagerProducts() {
  const [products, setProducts] = useState(null);
  const [editing, setEditing] = useState(null); // product draft
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  async function load() {
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  // Quick promo dropdown in the table (story 8)
  async function setPromo(p, value) {
    setError('');
    if (value === 'promo' && p.promo_price == null) {
      setEditing({ ...p, is_promo: true, promo_price: '', promo_ends_at: toLocalInput(p.promo_ends_at) });
      return;
    }
    const { error: err } = await supabase.from('products').update({ is_promo: value === 'promo' }).eq('id', p.id);
    if (err) setError(errorMessage(err));
    load();
  }

  async function toggleActive(p) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
    load();
  }

  if (!products) return <Spinner />;
  const shown = products.filter((p) => filter === 'all' || (filter === 'promo' ? p.is_promo : !p.is_promo));

  return (
    <>
      <div className="page-head">
        <h1>Products &amp; promos</h1>
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>+ New product</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {editing && <ProductEditor draft={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      <div className="chips">
        {['all', 'promo', 'regular'].map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'promo' ? 'On promo' : 'Regular price'}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="right">Price</th>
              <th>Promo</th>
              <th className="right">Stock</th>
              <th>Visible</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'dim'}>
                <td>
                  <strong>{p.name}</strong>
                  <div className="muted small">{p.category} · {p.weight_kg} kg / {p.unit}</div>
                </td>
                <td className="right">
                  {isPromoActive(p) ? (
                    <>
                      <strong>{peso(p.promo_price)}</strong>
                      <div className="muted small"><s>{peso(p.price)}</s></div>
                    </>
                  ) : (
                    peso(p.price)
                  )}
                </td>
                <td>
                  <select value={p.is_promo ? 'promo' : 'regular'} onChange={(e) => setPromo(p, e.target.value)}>
                    <option value="regular">Regular price</option>
                    <option value="promo">On promo</option>
                  </select>
                  {p.is_promo && !isPromoActive(p) && <div className="small text-danger">Promo expired / no price</div>}
                </td>
                <td className={`right ${p.stock <= 5 ? 'text-danger' : ''}`}>{p.stock}</td>
                <td>
                  <label className="switch">
                    <input type="checkbox" checked={p.active} onChange={() => toggleActive(p)} />
                    <span />
                  </label>
                </td>
                <td className="right">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setEditing({
                        ...p,
                        promo_price: p.promo_price ?? '',
                        promo_label: p.promo_label ?? '',
                        promo_ends_at: toLocalInput(p.promo_ends_at),
                        description: p.description ?? '',
                        category: p.category ?? '',
                        image_url: p.image_url ?? '',
                      })
                    }
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductEditor({ draft, onClose, onSaved }) {
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    const invalid = validateUpload(file);
    if (invalid) return setError(invalid);
    try {
      setBusy(true);
      const url = await uploadPublicAsset('products', file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    if (form.is_promo) {
      if (form.promo_price === '' || Number(form.promo_price) <= 0) return setError('Enter a promo price.');
      if (Number(form.promo_price) >= Number(form.price)) return setError('Promo price should be lower than the regular price.');
    }
    const row = {
      name: form.name.trim(),
      description: form.description || null,
      category: form.category || null,
      unit: form.unit || 'pc',
      price: Number(form.price),
      stock: Number(form.stock),
      weight_kg: Number(form.weight_kg),
      image_url: form.image_url || null,
      active: form.active,
      is_promo: form.is_promo,
      promo_price: form.promo_price === '' ? null : Number(form.promo_price),
      promo_label: form.promo_label || null,
      promo_ends_at: form.promo_ends_at ? new Date(form.promo_ends_at).toISOString() : null,
    };
    setBusy(true);
    const { error: err } = form.id
      ? await supabase.from('products').update(row).eq('id', form.id)
      : await supabase.from('products').insert(row);
    setBusy(false);
    if (err) return setError(errorMessage(err));
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h3>{form.id ? 'Edit product' : 'New product'}</h3>
        <div className="form grid-2">
          <label className="field span-2">Name<input required value={form.name} onChange={set('name')} /></label>
          <label className="field span-2">Description<textarea rows={2} value={form.description} onChange={set('description')} /></label>
          <label className="field">Category<input value={form.category} onChange={set('category')} placeholder="Seeds, Fertilizers…" /></label>
          <label className="field">Unit<input value={form.unit} onChange={set('unit')} placeholder="pack, kg, kit…" /></label>
          <label className="field">Regular price (₱)<input required type="number" step="0.01" min="0" value={form.price} onChange={set('price')} /></label>
          <label className="field">Stock<input required type="number" min="0" value={form.stock} onChange={set('stock')} /></label>
          <label className="field">Shipping weight per unit (kg)<input required type="number" step="0.01" min="0" value={form.weight_kg} onChange={set('weight_kg')} /></label>
          <label className="field">
            Photo
            <input type="file" accept="image/*" onChange={uploadImage} />
            {form.image_url && <img src={form.image_url} alt="" className="thumb-lg" />}
          </label>

          <fieldset className="span-2 promo-fieldset">
            <legend>Promo</legend>
            <div className="grid-2">
              <label className="field">
                Pricing
                <select value={form.is_promo ? 'promo' : 'regular'} onChange={(e) => setForm({ ...form, is_promo: e.target.value === 'promo' })}>
                  <option value="regular">Regular price</option>
                  <option value="promo">On promo</option>
                </select>
              </label>
              <label className="field">
                Promo price (₱)
                <input type="number" step="0.01" min="0" disabled={!form.is_promo} value={form.promo_price} onChange={set('promo_price')} />
              </label>
              <label className="field">
                Promo label
                <input disabled={!form.is_promo} value={form.promo_label} onChange={set('promo_label')} placeholder="e.g. Planting Season Sale" />
              </label>
              <label className="field">
                Promo ends (optional)
                <input type="datetime-local" disabled={!form.is_promo} value={form.promo_ends_at} onChange={set('promo_ends_at')} />
              </label>
            </div>
          </fieldset>

          <label className="check span-2">
            <input type="checkbox" checked={form.active} onChange={set('active')} /> Visible in shop
          </label>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="row end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
        </div>
      </form>
    </div>
  );
}

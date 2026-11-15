import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { errorMessage, peso } from '../../lib/format';
import { PAYMENT_TYPE_LABEL } from '../../lib/status';
import { uploadPublicAsset, validateUpload } from '../../lib/storage';
import CapacityCard from '../../components/CapacityCard.jsx';
import Spinner from '../../components/Spinner.jsx';

const EMPTY = {
  type: 'gcash', label: '', account_name: '', account_number: '', qr_url: '', instructions: '',
  daily_limit: '', monthly_limit: '', active: true, sort: 0,
};

export default function PaymentMethods() {
  const [methods, setMethods] = useState(null);
  const [editing, setEditing] = useState(null);

  async function load() {
    const { data } = await supabase.rpc('payment_method_capacity');
    setMethods(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  if (!methods) return <Spinner />;
  const gcash = methods.filter((m) => m.type === 'gcash');
  const others = methods.filter((m) => m.type !== 'gcash');

  return (
    <>
      <div className="page-head">
        <h1>Payment methods &amp; GCash limits</h1>
        <div className="row">
          <button className="btn btn-outline" onClick={load}>Refresh</button>
          <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>+ Add account</button>
        </div>
      </div>
      <p className="muted small">
        Usage counts every payment assigned to an account (awaiting proof, for verification and verified) except rejected
        payments and cancelled orders. Day and month reset on Philippine time. When an account hits its limit, customers
        can't select it at checkout and are prompted to split across other GCash accounts.
      </p>

      <h2>GCash accounts</h2>
      <div className="capacity-grid">
        {gcash.map((m) => (
          <div key={m.id} className="capacity-wrap">
            <CapacityCard method={m} />
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(toDraft(m))}>Edit</button>
          </div>
        ))}
        {gcash.length === 0 && <p className="muted">No GCash accounts yet.</p>}
      </div>

      <h2>Other methods</h2>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Method</th><th>Account</th><th>QR</th><th className="right">This month</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {others.map((m) => (
              <tr key={m.id} className={m.active ? '' : 'dim'}>
                <td><strong>{m.label}</strong><div className="muted small">{PAYMENT_TYPE_LABEL[m.type]}</div></td>
                <td className="small">{m.account_name}<br />{m.account_number}</td>
                <td>{m.qr_url ? <img src={m.qr_url} alt="" className="thumb" /> : <span className="muted small">none</span>}</td>
                <td className="right">{peso(m.used_month)}</td>
                <td>{m.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                <td className="right"><button className="btn btn-outline btn-sm" onClick={() => setEditing(toDraft(m))}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <MethodEditor draft={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

const toDraft = (m) => ({
  id: m.id, type: m.type, label: m.label, account_name: m.account_name || '', account_number: m.account_number || '',
  qr_url: m.qr_url || '', instructions: m.instructions || '', daily_limit: m.daily_limit ?? '',
  monthly_limit: m.monthly_limit ?? '', active: m.active, sort: m.sort,
});

function MethodEditor({ draft, onClose, onSaved }) {
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function uploadQr(e) {
    const file = e.target.files?.[0];
    const invalid = validateUpload(file);
    if (invalid) return setError(invalid);
    try {
      setBusy(true);
      const url = await uploadPublicAsset('qr', file);
      setForm((f) => ({ ...f, qr_url: url }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const row = {
      type: form.type,
      label: form.label.trim(),
      account_name: form.account_name || null,
      account_number: form.account_number || null,
      qr_url: form.qr_url || null,
      instructions: form.instructions || null,
      daily_limit: form.daily_limit === '' ? null : Number(form.daily_limit),
      monthly_limit: form.monthly_limit === '' ? null : Number(form.monthly_limit),
      active: form.active,
      sort: Number(form.sort) || 0,
    };
    setBusy(true);
    const { error: err } = form.id
      ? await supabase.from('payment_methods').update(row).eq('id', form.id)
      : await supabase.from('payment_methods').insert(row);
    setBusy(false);
    if (err) return setError(errorMessage(err));
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h3>{form.id ? 'Edit payment account' : 'New payment account'}</h3>
        <div className="form grid-2">
          <label className="field">
            Type
            <select value={form.type} onChange={set('type')}>
              {Object.entries(PAYMENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field">Display name<input required value={form.label} onChange={set('label')} placeholder="GCash – Account 4" /></label>
          <label className="field">Account name<input value={form.account_name} onChange={set('account_name')} /></label>
          <label className="field">Account / mobile number<input value={form.account_number} onChange={set('account_number')} /></label>
          <label className="field">Daily limit (₱, blank = none)<input type="number" step="0.01" min="0" value={form.daily_limit} onChange={set('daily_limit')} /></label>
          <label className="field">Monthly limit (₱, blank = none)<input type="number" step="0.01" min="0" value={form.monthly_limit} onChange={set('monthly_limit')} /></label>
          <label className="field span-2">Instructions shown to customer<textarea rows={2} value={form.instructions} onChange={set('instructions')} /></label>
          <label className="field">
            QR code image
            <input type="file" accept="image/*" onChange={uploadQr} />
          </label>
          <div>{form.qr_url && <img src={form.qr_url} alt="QR" className="thumb-lg" />}</div>
          <label className="field">Sort order<input type="number" value={form.sort} onChange={set('sort')} /></label>
          <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Active (shown at checkout)</label>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="row end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

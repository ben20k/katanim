import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { errorMessage, peso } from '../../lib/format';
import Spinner from '../../components/Spinner.jsx';

const ZONE_ORDER = ['METRO_MANILA', 'LUZON', 'VISAYAS', 'MINDANAO', 'ISLAND'];
const bracketLabel = (kg, prev) => (prev == null ? `0 – ${fmtKg(kg)}` : `${fmtKg(prev)} – ${fmtKg(kg)}`);
const fmtKg = (kg) => (Number(kg) < 1 ? `${Number(kg) * 1000} g` : `${Number(kg)} kg`);

export default function ShippingRates() {
  const [zones, setZones] = useState([]);
  const [settings, setSettings] = useState(null);
  const [rates, setRates] = useState([]); // all origins
  const [lanes, setLanes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [origin, setOrigin] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  async function load() {
    const [z, s, r, l, rg, pv] = await Promise.all([
      supabase.from('shipping_zones').select('code, name'),
      supabase.from('store_settings').select('*').eq('id', 1).single(),
      supabase.from('shipping_rates').select('*'),
      supabase.from('shipping_lanes').select('*'),
      supabase.from('shipping_regions').select('*').order('sort'),
      supabase.from('shipping_provinces').select('*').order('province'),
    ]);
    const zs = (z.data || []).sort((a, b) => ZONE_ORDER.indexOf(a.code) - ZONE_ORDER.indexOf(b.code));
    setZones(zs);
    setSettings(s.data);
    setOrigin((o) => o || s.data?.origin_zone || 'METRO_MANILA');
    setRates((r.data || []).map((x) => ({ ...x, fee: String(x.fee) })));
    setLanes((l.data || []).map((x) => ({ ...x, extra_per_kg: String(x.extra_per_kg) })));
    setRegions(rg.data || []);
    setProvinces(pv.data || []);
    setDirty(false);
  }
  useEffect(() => {
    load();
  }, []);

  const zoneName = (code) => zones.find((z) => z.code === code)?.name || code;
  const brackets = useMemo(
    () => [...new Set(rates.filter((r) => r.origin_zone === origin).map((r) => Number(r.max_kg)))].sort((a, b) => a - b),
    [rates, origin],
  );
  const rateOf = (dest, kg) => rates.find((r) => r.origin_zone === origin && r.dest_zone === dest && Number(r.max_kg) === kg);
  const laneOf = (dest) => lanes.find((l) => l.origin_zone === origin && l.dest_zone === dest);

  function editRate(dest, kg, value) {
    setRates((rs) => rs.map((r) => (r.origin_zone === origin && r.dest_zone === dest && Number(r.max_kg) === kg ? { ...r, fee: value } : r)));
    setDirty(true);
  }
  function editLane(dest, key, value) {
    setLanes((ls) => ls.map((l) => (l.origin_zone === origin && l.dest_zone === dest ? { ...l, [key]: value } : l)));
    setDirty(true);
  }

  async function saveRates() {
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const rows = rates.filter((r) => r.origin_zone === origin);
      if (rows.some((r) => r.fee === '' || Number(r.fee) < 0)) throw new Error('Every fee must be a number of 0 or more.');
      const { error: e1 } = await supabase
        .from('shipping_rates')
        .upsert(rows.map((r) => ({ origin_zone: r.origin_zone, dest_zone: r.dest_zone, max_kg: r.max_kg, fee: Number(r.fee) })));
      if (e1) throw e1;
      const laneRows = lanes.filter((l) => l.origin_zone === origin);
      const { error: e2 } = await supabase
        .from('shipping_lanes')
        .upsert(laneRows.map((l) => ({ origin_zone: l.origin_zone, dest_zone: l.dest_zone, extra_per_kg: Number(l.extra_per_kg) || 0, eta: l.eta || null })));
      if (e2) throw e2;
      const { error: e3 } = await supabase
        .from('store_settings')
        .update({ rates_updated: new Date().toISOString().slice(0, 10), rates_source: 'Edited by manager', updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (e3) throw e3;
      setMsg({ type: 'success', text: `Rates from ${zoneName(origin)} saved.` });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function setStoreOrigin(code) {
    const { error } = await supabase.from('store_settings').update({ origin_zone: code, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return setMsg({ type: 'error', text: errorMessage(error) });
    setOrigin(code);
    setMsg({ type: 'success', text: `Katanim now ships from ${zoneName(code)}. Checkout uses these rates.` });
    load();
  }

  async function setProvinceZone(province, zone_code) {
    const { error } = await supabase.from('shipping_provinces').update({ zone_code }).eq('province', province);
    if (error) setMsg({ type: 'error', text: errorMessage(error) });
    load();
  }

  if (!settings) return <Spinner />;
  const storeOrigin = settings.origin_zone;

  return (
    <>
      <h1>Shipping rates (J&amp;T Express)</h1>
      <div className="alert alert-info small">
        Checkout charges J&amp;T's rate for the parcel's <strong>origin → destination</strong> and total weight. The
        destination is the customer's <strong>province</strong> (island provinces use the Island rate). Above the top
        bracket, the "+ per kg" amount is added for every started kilogram.
        <div className="muted" style={{ marginTop: 6 }}>
          Source: {settings.rates_source || '—'}
          {settings.rates_updated && ` · updated ${settings.rates_updated}`}. J&amp;T changes rates from time to time —
          compare with the J&amp;T app or branch and edit below.
        </div>
      </div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <section className="card">
        <h3>Where does Katanim ship from?</h3>
        <div className="row wrap">
          <select value={storeOrigin} onChange={(e) => setStoreOrigin(e.target.value)} style={{ maxWidth: 280 }}>
            {zones.map((z) => (
              <option key={z.code} value={z.code}>{z.name}</option>
            ))}
          </select>
          <span className="muted small">This decides which J&amp;T rate table is used at checkout.</span>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h3 style={{ margin: 0 }}>Rate table</h3>
          <label className="row small">
            Showing rates from
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={{ width: 'auto' }} disabled={dirty}>
              {zones.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name}{z.code === storeOrigin ? ' (store origin)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table rate-matrix">
            <thead>
              <tr>
                <th>Weight</th>
                {zones.map((z) => <th key={z.code} className="right">→ {z.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {brackets.map((kg, i) => (
                <tr key={kg}>
                  <td>{bracketLabel(kg, i ? brackets[i - 1] : null)}</td>
                  {zones.map((z) => {
                    const r = rateOf(z.code, kg);
                    return (
                      <td key={z.code} className="right">
                        {r ? (
                          <input type="number" min="0" step="1" value={r.fee} onChange={(e) => editRate(z.code, kg, e.target.value)} />
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="extra">
                <td>Above {fmtKg(brackets[brackets.length - 1] || 0)}: + per kg</td>
                {zones.map((z) => {
                  const l = laneOf(z.code);
                  return (
                    <td key={z.code} className="right">
                      {l ? <input type="number" min="0" step="1" value={l.extra_per_kg} onChange={(e) => editLane(z.code, 'extra_per_kg', e.target.value)} /> : '—'}
                    </td>
                  );
                })}
              </tr>
              <tr className="eta">
                <td>Delivery estimate</td>
                {zones.map((z) => {
                  const l = laneOf(z.code);
                  return <td key={z.code}>{l ? <input value={l.eta || ''} onChange={(e) => editLane(z.code, 'eta', e.target.value)} /> : '—'}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="row end">
          {dirty && <span className="muted small">Unsaved changes</span>}
          <button className="btn btn-ghost" disabled={!dirty || busy} onClick={load}>Discard</button>
          <button className="btn btn-primary" disabled={!dirty || busy} onClick={saveRates}>{busy ? 'Saving…' : 'Save rates'}</button>
        </div>
        <p className="muted small">
          J&amp;T's published card stops at 6 kg. The "+ per kg" values are estimates (the 5→6 kg step) — check heavy
          items such as sacks and greenhouse film against a real J&amp;T quote.
        </p>
      </section>

      <QuoteTester regions={regions} provinces={provinces} />

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Province → rate zone</h3>
        <p className="muted small">
          Island provinces were pre-set to <strong>Island</strong> as a best guess. If J&amp;T charges a province
          differently, change it here.
        </p>
        <div className="province-table">
          <table className="table">
            <thead><tr><th>Province</th><th>Region</th><th>Zone</th></tr></thead>
            <tbody>
              {provinces.map((p) => (
                <tr key={p.province}>
                  <td>{p.province}</td>
                  <td className="muted small">{p.region}</td>
                  <td>
                    <select value={p.zone_code} onChange={(e) => setProvinceZone(p.province, e.target.value)}>
                      {zones.map((z) => <option key={z.code} value={z.code}>{z.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function QuoteTester({ regions, provinces }) {
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [weight, setWeight] = useState(1);
  const [quote, setQuote] = useState(null);
  const options = provinces.filter((p) => p.region === region);

  useEffect(() => {
    if (!region) return setQuote(null);
    supabase
      .rpc('shipping_quote', { p_region: region, p_weight_kg: Number(weight) || 0, p_province: province || null })
      .then(({ data }) => setQuote(Array.isArray(data) ? data[0] : data));
  }, [region, province, weight]);

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h3>Test a quote</h3>
      <div className="form grid-2">
        <label className="field">
          Region
          <select value={region} onChange={(e) => { setRegion(e.target.value); setProvince(''); }}>
            <option value="">Select…</option>
            {regions.map((r) => <option key={r.region} value={r.region}>{r.region}</option>)}
          </select>
        </label>
        <label className="field">
          Province
          <select value={province} onChange={(e) => setProvince(e.target.value)} disabled={!options.length}>
            <option value="">(use region)</option>
            {options.map((p) => <option key={p.province} value={p.province}>{p.province}</option>)}
          </select>
        </label>
        <label className="field">
          Total weight (kg)
          <input type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <div className="field">
          Customer pays
          <div className="calc-result">{quote ? peso(quote.fee) : '—'}</div>
          {quote && <span className="muted small">{quote.dest_name}{quote.eta ? ` · ${quote.eta}` : ''}</span>}
        </div>
      </div>
    </section>
  );
}

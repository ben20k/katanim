import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { errorMessage, peso } from '../../lib/format';
import Spinner from '../../components/Spinner.jsx';

export default function ShippingRates() {
  const [zones, setZones] = useState(null);
  const [regions, setRegions] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [testWeight, setTestWeight] = useState(3);

  async function load() {
    const [z, r] = await Promise.all([
      supabase.from('shipping_zones').select('*').order('base_fee'),
      supabase.from('shipping_regions').select('*').order('sort'),
    ]);
    setZones(z.data || []);
    setRegions(r.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const editZone = (code, k, v) => setZones((zs) => zs.map((z) => (z.code === code ? { ...z, [k]: v } : z)));

  async function saveZone(z) {
    setError('');
    setMsg('');
    const { error: err } = await supabase
      .from('shipping_zones')
      .update({ name: z.name, base_fee: Number(z.base_fee), base_kg: Number(z.base_kg), per_kg_fee: Number(z.per_kg_fee), eta: z.eta })
      .eq('code', z.code);
    if (err) setError(errorMessage(err));
    else setMsg(`Saved ${z.name}.`);
  }

  async function setRegionZone(region, zone_code) {
    const { error: err } = await supabase.from('shipping_regions').update({ zone_code }).eq('region', region);
    if (err) setError(errorMessage(err));
    load();
  }

  if (!zones) return <Spinner />;
  const quote = (z) => Number(z.base_fee) + Math.max(0, Math.ceil(testWeight - Number(z.base_kg))) * Number(z.per_kg_fee);

  return (
    <>
      <h1>Shipping rates (J&amp;T)</h1>
      <div className="alert alert-info small">
        Fees are calculated automatically at checkout: <strong>base fee</strong> covers the first <strong>base kg</strong>,
        then <strong>per-kg fee</strong> for every started kilogram above it. Enter your J&amp;T rate card here. When J&amp;T
        API access is approved, the <code>quote_shipping</code> function can call it instead (see README).
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Zone</th><th>Base fee (₱)</th><th>Base kg</th><th>Per extra kg (₱)</th><th>ETA</th>
              <th className="right">
                Fee @ <input className="qty" type="number" min="0" step="0.5" value={testWeight} onChange={(e) => setTestWeight(Number(e.target.value))} /> kg
              </th><th /></tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.code}>
                <td><input value={z.name} onChange={(e) => editZone(z.code, 'name', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={z.base_fee} onChange={(e) => editZone(z.code, 'base_fee', e.target.value)} /></td>
                <td><input type="number" step="0.1" value={z.base_kg} onChange={(e) => editZone(z.code, 'base_kg', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={z.per_kg_fee} onChange={(e) => editZone(z.code, 'per_kg_fee', e.target.value)} /></td>
                <td><input value={z.eta || ''} onChange={(e) => editZone(z.code, 'eta', e.target.value)} /></td>
                <td className="right">{peso(quote(z))}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => saveZone(z)}>Save</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Region → zone</h2>
      <div className="card">
        <table className="table">
          <tbody>
            {regions.map((r) => (
              <tr key={r.region}>
                <td>{r.region}</td>
                <td>
                  <select value={r.zone_code} onChange={(e) => setRegionZone(r.region, e.target.value)}>
                    {zones.map((z) => <option key={z.code} value={z.code}>{z.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

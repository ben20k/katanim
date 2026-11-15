import { peso } from '../lib/format';

function Meter({ label, used, limit }) {
  if (limit == null) {
    return (
      <div className="meter">
        <div className="row between small"><span>{label}</span><span>{peso(used)} · no limit</span></div>
      </div>
    );
  }
  const pct = Math.min(100, (Number(used) / Number(limit)) * 100);
  const tone = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  return (
    <div className="meter">
      <div className="row between small">
        <span>{label}</span>
        <span>{peso(used)} / {peso(limit)}</span>
      </div>
      <div className={`progress progress-${tone}`}><div style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// Shows how much of a GCash (or any) account's transaction limit has been used.
export default function CapacityCard({ method }) {
  const reached = method.remaining != null && Number(method.remaining) <= 0;
  const near =
    !reached &&
    method.remaining != null &&
    ((method.daily_limit && Number(method.used_today) / method.daily_limit >= 0.8) ||
      (method.monthly_limit && Number(method.used_month) / method.monthly_limit >= 0.8));
  return (
    <div className={`card capacity ${reached ? 'card-danger' : ''}`}>
      <div className="row between">
        <div>
          <strong>{method.label}</strong>
          <div className="muted small">{method.account_number}</div>
        </div>
        {reached ? (
          <span className="badge badge-danger">Limit reached</span>
        ) : near ? (
          <span className="badge badge-warn">Near limit</span>
        ) : (
          <span className="badge badge-success">Available</span>
        )}
      </div>
      <Meter label="Today" used={method.used_today} limit={method.daily_limit} />
      <Meter label="This month" used={method.used_month} limit={method.monthly_limit} />
      <div className="row between small muted">
        <span>Verified this month: {peso(method.verified_month)}</span>
        <span>Can still receive: {method.remaining == null ? 'no limit' : peso(method.remaining)}</span>
      </div>
      {!method.active && <span className="badge badge-muted">Inactive</span>}
    </div>
  );
}

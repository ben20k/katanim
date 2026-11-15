import { ORDER_STATUS } from '../lib/status';
import { formatDate } from '../lib/format';

export default function OrderTimeline({ history = [] }) {
  const sorted = [...history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!sorted.length) return null;
  return (
    <ol className="timeline">
      {sorted.map((h) => (
        <li key={h.id} className={`tl-${ORDER_STATUS[h.status]?.tone || 'muted'}`}>
          <strong>{ORDER_STATUS[h.status]?.label || h.status}</strong>
          <span className="muted small">{formatDate(h.created_at)}</span>
        </li>
      ))}
    </ol>
  );
}

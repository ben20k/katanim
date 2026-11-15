import { ORDER_STATUS, PAYMENT_STATUS } from '../lib/status';

export default function StatusBadge({ status, kind = 'order' }) {
  const map = kind === 'payment' ? PAYMENT_STATUS : ORDER_STATUS;
  const s = map[status] || { label: status, tone: 'muted' };
  return <span className={`badge badge-${s.tone}`}>{kind === 'order' ? 'Status: ' : ''}{s.label}</span>;
}

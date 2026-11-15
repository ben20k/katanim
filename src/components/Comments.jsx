import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorMessage, formatDate } from '../lib/format';
import { useAuth } from '../context/AuthContext.jsx';

// Shared comment thread. Managers can add internal (manager-only) notes.
export default function Comments({ orderId, comments = [], onChange, highlight = false }) {
  const { user, isManager } = useAuth();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase
      .from('order_comments')
      .insert({ order_id: orderId, author_id: user.id, body: body.trim(), is_internal: isManager && internal });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    setBody('');
    setInternal(false);
    onChange?.();
  }

  return (
    <section className={`card ${highlight ? 'card-danger' : ''}`}>
      <h3>Comments</h3>
      {sorted.length === 0 && <p className="muted small">No comments yet.</p>}
      <ul className="comments">
        {sorted.map((c) => {
          const fromStore = c.profiles?.role === 'manager';
          return (
            <li key={c.id} className={`${fromStore ? 'from-store' : 'from-customer'} ${c.is_internal ? 'internal' : ''}`}>
              <div className="comment-meta">
                <strong>{fromStore ? 'Katanim team' : c.profiles?.full_name || 'Customer'}</strong>
                {c.is_internal && <span className="badge badge-muted">Internal</span>}
                <span className="muted small">{formatDate(c.created_at)}</span>
              </div>
              <p>{c.body}</p>
            </li>
          );
        })}
      </ul>
      <form onSubmit={submit} className="form">
        <textarea
          rows={2}
          placeholder={isManager ? 'Write a comment to the customer…' : 'Reply to the Katanim team…'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="row between">
          {isManager ? (
            <label className="check">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note
              (hidden from customer)
            </label>
          ) : (
            <span />
          )}
          <button className="btn btn-outline btn-sm" disabled={busy || !body.trim()}>
            {busy ? 'Sending…' : 'Post comment'}
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </form>
    </section>
  );
}

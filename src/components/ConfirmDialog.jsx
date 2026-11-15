import { useEffect, useState } from 'react';

// Modal confirmation with an optional "I agree" checkbox that must be ticked first.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  agreeLabel,          // when set, the confirm button stays disabled until this is ticked
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="card modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-head">
          <span className="confirm-icon" aria-hidden="true">!</span>
          <h3 id="confirm-title">{title}</h3>
        </div>
        <div className="confirm-body">{children}</div>
        {agreeLabel && (
          <label className="agree">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>{agreeLabel}</span>
          </label>
        )}
        <div className="row end">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy || (agreeLabel && !agreed)}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

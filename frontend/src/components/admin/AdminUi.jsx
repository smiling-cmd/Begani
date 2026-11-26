import { X } from 'lucide-react';
import { formatLabel } from './adminHelpers';
import './AdminPortal.css';

export function StatusChip({ status }) {
  return <span className={`ap-chip is-${status}`}>{formatLabel(status)}</span>;
}

/** Small modal shell used by every admin dialog. */
export function Modal({ title, onClose, children, wide = false, busy = false }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className={`dialog-card ap-dialog${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close" disabled={busy}><X size={20} /></button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, danger = false, busy = false, error = '', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <div className="ap-confirm-body">{children}</div>
      {error && <p className="form-message error" role="alert">{error}</p>}
      <div className="ap-dialog-actions">
        <button type="button" className={`button${danger ? ' ap-danger' : ''}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button type="button" className="text-button" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  );
}

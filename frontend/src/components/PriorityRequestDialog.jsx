import { useState } from 'react';
import api from '../api';
import { Phone, X } from 'lucide-react';

export default function PriorityRequestDialog({ hasPhone, source, conversationId, onClose, onCreated }) {
  const [phoneConsent, setPhoneConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submitRequest = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/api/tua/priority/', {
        source,
        phone_consent: phoneConsent,
        ...(conversationId ? { tua_conversation_id: conversationId } : {}),
      });
      onCreated(data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not send your request. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="priority-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <section className="priority-dialog" role="dialog" aria-modal="true" aria-labelledby="priority-dialog-title">
        <button className="priority-dialog-close" type="button" aria-label="Close" onClick={onClose} disabled={submitting}>
          <X size={18} />
        </button>
        <span className="priority-dialog-icon" aria-hidden="true"><Phone size={19} /></span>
        <h2 id="priority-dialog-title">Connect with a counsellor</h2>
        <p className="priority-dialog-copy">We’ll alert an approved school counsellor and open a private chat. The 15-minute timer is a response target, not a guarantee.</p>
        <p className="priority-dialog-emergency">If you may be in immediate danger, call emergency services now.</p>
        <div className="priority-dialog-calls">
          <a href="tel:999">Call 999</a>
          <a href="tel:112">Call 112</a>
        </div>

        <form onSubmit={submitRequest}>
          <label className={`priority-phone-consent${!hasPhone ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={phoneConsent}
              disabled={!hasPhone || submitting}
              onChange={(event) => setPhoneConsent(event.target.checked)}
            />
            <span>{hasPhone ? 'I agree to share the phone number on my account with this counsellor.' : 'There is no phone number on your account to share.'}</span>
          </label>
          {error && <p className="priority-dialog-error" role="alert">{error}</p>}
          <div className="priority-dialog-actions">
            <button type="button" className="priority-dialog-cancel" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="priority-dialog-submit" disabled={submitting}>{submitting ? 'Sending…' : 'Open urgent chat'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

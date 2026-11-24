import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Smartphone, X } from 'lucide-react';
import api from '../api';
import './PayWithMpesaDialog.css';

const WAIT_SECONDS = 180;
const POLL_MS = 3000;
const PHONE_KEY = 'begani-pay-phone';

const readPhone = () => { try { return localStorage.getItem(PHONE_KEY) || ''; } catch { return ''; } };
const savePhone = (value) => { try { localStorage.setItem(PHONE_KEY, value); } catch { /* ignore */ } };

/**
 * M-Pesa STK-push dialog (Paystack). `startUrl` is the POST endpoint that begins the payment.
 * onPaid() runs after the payment is confirmed so the parent can refresh its data.
 */
export default function PayWithMpesaDialog({ title, amount, startUrl, onClose, onPaid }) {
  const [phase, setPhase] = useState('form'); // form | starting | waiting | success | failed | timeout
  const [phone, setPhone] = useState(readPhone);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);
  const [paymentId, setPaymentId] = useState('');
  const paidRef = useRef(false);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && phase !== 'starting') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  useEffect(() => {
    if (phase !== 'waiting' || !paymentId) return undefined;
    let active = true;
    const started = Date.now();
    const tick = setInterval(() => {
      if (!active) return;
      setSecondsLeft(Math.max(WAIT_SECONDS - Math.round((Date.now() - started) / 1000), 0));
    }, 1000);
    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/payments/${paymentId}/`);
        if (!active) return;
        if (data.status === 'succeeded') {
          setPhase('success');
          if (!paidRef.current) { paidRef.current = true; onPaid?.(); }
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setError(data.message || 'The payment didn’t go through.');
          setPhase('failed');
        } else if (data.status === 'timed_out' || Date.now() - started > (WAIT_SECONDS + 5) * 1000) {
          setPhase('timeout');
        }
      } catch { /* keep polling; a blip shouldn't end the wait */ }
    }, POLL_MS);
    return () => { active = false; clearInterval(tick); clearInterval(poll); };
  }, [phase, paymentId, onPaid]);

  const submit = async (event) => {
    event.preventDefault();
    if (phase === 'starting') return;
    setError('');
    setPhase('starting');
    try {
      const { data } = await api.post(startUrl, { phone });
      savePhone(phone);
      setPaymentId(data.id);
      setSecondsLeft(WAIT_SECONDS);
      if (data.status === 'succeeded') {
        setPhase('success');
        if (!paidRef.current) { paidRef.current = true; onPaid?.(); }
      } else if (data.status === 'failed') {
        setError(data.message || 'The payment didn’t go through.');
        setPhase('failed');
      } else {
        setPhase('waiting');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not start the payment. Please try again.');
      setPhase('form');
    }
  };

  const mm = String(Math.floor(secondsLeft / 60));
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && phase !== 'starting') onClose(); }}>
      <section className="dialog-card pay-dialog" role="dialog" aria-modal="true" aria-labelledby="pay-title">
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close"><X size={20} /></button>

        {(phase === 'form' || phase === 'starting') && (
          <form onSubmit={submit}>
            <span className="pay-icon"><Smartphone size={22} /></span>
            <h2 id="pay-title">Pay with M-Pesa</h2>
            <p className="pay-sub">{title}</p>
            <p className="pay-amount">KES {Number(amount).toLocaleString()}</p>
            <label className="pay-label" htmlFor="pay-phone">M-Pesa phone number</label>
            <input
              id="pay-phone" className="pay-input" type="tel" inputMode="tel" autoComplete="tel"
              placeholder="0712 345 678" value={phone} onChange={(event) => setPhone(event.target.value)} required autoFocus
            />
            {error && <p className="pay-error" role="alert">{error}</p>}
            <p className="pay-note">We’ll send a prompt to your phone. Enter your M-Pesa PIN there to finish. We never see your PIN.</p>
            <button type="submit" className="button pay-submit" disabled={phase === 'starting' || !phone.trim()}>
              {phase === 'starting' ? 'Sending prompt…' : `Pay KES ${Number(amount).toLocaleString()}`}
            </button>
          </form>
        )}

        {phase === 'waiting' && (
          <div className="pay-state" aria-live="polite">
            <span className="pay-icon is-pulse"><Smartphone size={22} /></span>
            <h2 id="pay-title">Check your phone</h2>
            <p>We’ve sent an M-Pesa prompt for <strong>KES {Number(amount).toLocaleString()}</strong>. Enter your PIN to approve.</p>
            <p className="pay-timer">{mm}:{ss} left</p>
            <p className="pay-note">You can close this window. We’ll confirm your payment once it’s approved.</p>
          </div>
        )}

        {phase === 'success' && (
          <div className="pay-state" aria-live="polite">
            <span className="pay-icon is-ok"><CheckCircle2 size={24} /></span>
            <h2 id="pay-title">Payment received</h2>
            <p>Thank you. {title} is all set.</p>
            <button type="button" className="button pay-submit" onClick={onClose}>Done</button>
          </div>
        )}

        {(phase === 'failed' || phase === 'timeout') && (
          <div className="pay-state" aria-live="polite">
            <h2 id="pay-title">{phase === 'timeout' ? 'We didn’t get a response' : 'Payment didn’t go through'}</h2>
            <p>{phase === 'timeout'
              ? 'The prompt may have expired or been missed. You haven’t been charged unless you entered your PIN.'
              : error}</p>
            <div className="pay-actions">
              <button type="button" className="button" onClick={() => { setError(''); setPhase('form'); }}>Try again</button>
              <button type="button" className="text-button" onClick={onClose}>Not now</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

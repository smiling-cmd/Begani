import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import api from '../api';
import './PayoutAccountCard.css';

/** Where a therapist's share is sent. The full number is never shown again after saving. */
export default function PayoutAccountCard() {
  const [account, setAccount] = useState(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    let active = true;
    api.get('/api/payments/payout-account/')
      .then(({ data }) => {
        if (!active) return;
        setAccount(data);
        setName(data.account_name || '');
        setEditing(!data.has_account);
      })
      .catch(() => { if (active) setAccount(false); });
    return () => { active = false; };
  }, []);

  if (account === null || account === false) return null; // loading, or not a private therapist

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await api.put('/api/payments/payout-account/', { phone, account_name: name });
      setAccount(data);
      setPhone('');
      setEditing(false);
      setMessage({ type: 'success', text: 'Saved. Your payouts will go to this number.' });
    } catch (requestError) {
      setMessage({ type: 'error', text: requestError.response?.data?.detail || 'Could not save. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel payout-card" aria-labelledby="payout-account-title">
      <div className="payout-card-head">
        <span className="payout-card-icon"><Smartphone size={18} /></span>
        <div>
          <h2 id="payout-account-title">Where we send your money</h2>
          {account.has_account && !editing ? (
            <p>M-Pesa <strong>{account.phone_masked}</strong> · {account.account_name}</p>
          ) : (
            <p>Add your M-Pesa number. We send your share here after each completed session.</p>
          )}
        </div>
        {account.has_account && !editing && (
          <button type="button" className="text-button" onClick={() => setEditing(true)}>Change</button>
        )}
      </div>

      {editing && (
        <form className="payout-form" onSubmit={save}>
          <label>
            <span>M-Pesa phone number</span>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <label>
            <span>Name registered on that M-Pesa line</span>
            <input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={3} />
          </label>
          <div className="payout-form-actions">
            <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save payout number'}</button>
            {account.has_account && <button type="button" className="text-button" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}
      {message.text && <p className={`form-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  );
}

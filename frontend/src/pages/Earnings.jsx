import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import api from '../api';

const PAYOUT_STATUS_LABELS = {
  paid: 'Paid out',
  pending: 'Pending payout',
  failed: 'Payout failed',
};

const money = (value) => `KES ${Number(value ?? 0).toLocaleString()}`;

export default function Earnings() {
  const { token } = useContext(AuthContext);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    api.get('/api/payments/earnings/')
      .then((response) => {
        if (!active) return;
        setEarnings(response.data);
        setError('');
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load your earnings right now. Please refresh to try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const items = earnings?.items ?? [];
  const commissionRate = Number(earnings?.commission_rate_percent ?? 0);
  const showDash = loading ? 'Ã¢â‚¬â€' : undefined;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#F5F0E7', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
        <h1 style={{ color: '#2F6F69', fontSize: '2rem', margin: 0, fontWeight: '800' }}>Earnings</h1>
        <p style={{ color: '#666', margin: '0.5rem 0 2rem 0' }}>Students pay BEGANI. After each session you mark it completed, and BEGANI sends your share by M-Pesa, minus the commission.</p>

        {error && <p className="form-message error" role="alert">{error}</p>}
        {earnings?.estimated && (
          <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
            Some completed sessions do not have a payout record yet. Those figures use the platform commission rate ({commissionRate}%) until the payout is issued.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          <SummaryCard label="Paid out to you" value={showDash ?? money(earnings?.paid_kes)} />
          <SummaryCard label="Held until sessions are done" value={showDash ?? money(earnings?.pending_kes)} />
          <SummaryCard label={`Commission deducted (${commissionRate}%)`} value={showDash ?? money(earnings?.commission_kes)} />
          <SummaryCard label="Total session value" value={showDash ?? money(earnings?.gross_kes)} />
        </div>

        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ color: '#2F6F69', marginTop: 0 }}>Payments and payouts</h3>

          {loading ? (
            <p style={{ color: '#888' }}>Loading your paymentsÃ¢â‚¬Â¦</p>
          ) : items.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No completed sessions yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left', color: '#666' }}>
                  <th style={{ padding: '10px' }}>Date</th>
                  <th style={{ padding: '10px' }}>Student</th>
                  <th style={{ padding: '10px' }}>Amount</th>
                  <th style={{ padding: '10px' }}>Commission</th>
                  <th style={{ padding: '10px' }}>You Receive</th>
                  <th style={{ padding: '10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '10px' }}>{new Date(item.starts_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px' }}>{item.student_alias}</td>
                    <td style={{ padding: '10px' }}>{money(item.gross_kes)}</td>
                    <td style={{ padding: '10px' }}>{money(item.commission_kes)}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#2F6F69' }}>{money(item.net_kes)}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: '#EAF4F2', color: '#2F6F69', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {PAYOUT_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const SummaryCard = ({ label, value }) => (
  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
    <h2 style={{ fontSize: '1.8rem', color: '#2F6F69', margin: '0 0 5px 0' }}>{value}</h2>
    <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>{label}</p>
  </div>
);

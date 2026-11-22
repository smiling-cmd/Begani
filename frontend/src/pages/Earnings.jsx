import { useState, useEffect, useContext } from 'react';
import { Wallet } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import api from '../api';
import './TherapistReports.css';

const PAYOUT_STATUS_LABELS = {
  paid: 'Paid out',
  pending: 'Pending payout',
  failed: 'Payout failed',
};

const money = (value) => `KES ${Number(value ?? 0).toLocaleString()}`;
const formatDay = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
  const showDash = loading ? '—' : undefined;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading">
          <div className="eyebrow"><Wallet size={16} aria-hidden="true" /> Your earnings</div>
          <h1>Earnings</h1>
          <p>Students pay BEGANI. After each session you mark it completed, and BEGANI sends your share by M-Pesa, minus the commission.</p>
        </header>

        {error && <p className="form-message error" role="alert">{error}</p>}
        {earnings?.estimated && (
          <p className="report-note">
            Some completed sessions do not have a payout record yet. Those figures use the platform commission rate ({commissionRate}%) until the payout is issued.
          </p>
        )}

        <div className="report-stats">
          <SummaryCard label="Paid out to you" value={showDash ?? money(earnings?.paid_kes)} />
          <SummaryCard label="Held until sessions are done" value={showDash ?? money(earnings?.pending_kes)} />
          <SummaryCard label={`Commission deducted (${commissionRate}%)`} value={showDash ?? money(earnings?.commission_kes)} />
          <SummaryCard label="Total session value" value={showDash ?? money(earnings?.gross_kes)} />
        </div>

        <section className="panel report-panel" aria-labelledby="payments-title">
          <h2 id="payments-title">Payments and payouts</h2>

          {loading ? (
            <p className="report-empty">Loading your payments…</p>
          ) : items.length === 0 ? (
            <p className="report-empty">No completed sessions yet.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Student</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Commission</th>
                  <th scope="col">You receive</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Date">{formatDay(item.starts_at)}</td>
                    <td data-label="Student">{item.student_alias}</td>
                    <td data-label="Amount">{money(item.gross_kes)}</td>
                    <td data-label="Commission">{money(item.commission_kes)}</td>
                    <td data-label="You receive" className="is-net">{money(item.net_kes)}</td>
                    <td data-label="Status">
                      <span className={`report-pill${item.status === 'pending' ? ' is-pending' : item.status === 'failed' ? ' is-failed' : ''}`}>
                        {PAYOUT_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

const SummaryCard = ({ label, value }) => (
  <div className="panel report-stat">
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

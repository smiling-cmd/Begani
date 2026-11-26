import { useContext, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import Sidebar from '../components/Sidebar';
import './TherapistReports.css';
import { SkeletonList } from '../components/Skeleton';

const CURRENT_YEAR = new Date().getFullYear();

export default function Insights() {
  const { token } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    api.get('/api/bookings/insights/')
      .then((response) => {
        if (!active) return;
        setData(response.data);
        setError('');
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load your insights right now. Please refresh to try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const monthly = data?.monthly ?? [];
  const isSchool = data?.audience === 'school';
  const breakdown = (isSchool ? data?.groups : data?.schools) ?? [];
  const peak = Math.max(1, ...monthly.map((item) => item.count));
  const year = data?.year ?? CURRENT_YEAR;
  const dash = '—';

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading">
          <div className="eyebrow"><BarChart3 size={16} aria-hidden="true" /> {isSchool ? 'Your caseload' : 'Your practice'}</div>
          <h1>Insights</h1>
          <p>Your appointments, chats and anonymised insights. You never see a student&apos;s phone number; students appear by alias.</p>
        </header>

        {error && <p className="form-message error" role="alert">{error}</p>}

        <div className="report-stats">
          <StatCard title={`Booked in ${year}`} value={loading ? dash : data?.booked_this_year ?? 0} />
          <StatCard title="Awaiting your confirmation" value={loading ? dash : data?.awaiting_confirmation ?? 0} />
          <StatCard title="Upcoming appointments" value={loading ? dash : data?.upcoming_appointments ?? 0} />
          <StatCard title="Ongoing chats (7 days)" value={loading ? dash : data?.ongoing_chats ?? 0} />
        </div>

        <section className="panel report-panel" aria-labelledby="insights-title">
          <h2 id="insights-title">Insights for data analysis</h2>
          <p className="report-note">
            {isSchool
              ? 'School counsellor view: sessions are grouped by class. Classes with fewer than 3 students are combined into "Other groups" so no student can be identified. No names or contact details are used.'
              : 'Private therapist view: students come from different schools, so they are grouped by school and year. No names or contact details are used.'}
          </p>

          <h3>Bookings by month ({year})</h3>
          {loading ? (
            <SkeletonList label="Loading your bookings" rows={3} />
          ) : monthly.length === 0 ? (
            <p className="report-empty">No bookings yet this year.</p>
          ) : (
            <>
              <div className="month-chart" role="img" aria-label={`Bookings per month in ${year}: ${monthly.map((item) => `${item.label} ${item.count}`).join(', ')}`}>
                {monthly.map((item) => (
                  <div className="month-col" key={item.month} title={`${item.label}: ${item.count} booking${item.count === 1 ? '' : 's'}`}>
                    {item.count > 0 && <em>{item.count}</em>}
                    <span
                      className="month-bar"
                      style={{ height: `${(item.count / peak) * 100}%`, minHeight: item.count > 0 ? 10 : 0, background: item.count > 0 ? undefined : 'transparent' }}
                    />
                  </div>
                ))}
              </div>
              <div className="month-labels" aria-hidden="true">
                {monthly.map((item) => <span key={item.month}>{item.label}</span>)}
              </div>
            </>
          )}

          <h3>{isSchool ? 'By class' : 'By school'}</h3>
          {loading ? (
            <SkeletonList rows={3} />
          ) : breakdown.length === 0 ? (
            <p className="report-empty">{isSchool ? 'No class breakdown yet.' : 'No school breakdown yet.'}</p>
          ) : (
            <ul className="school-list">
              {breakdown.map((school) => (
                <li className="school-row" key={school.name}>
                  <span className="school-name">{school.name}</span>
                  <span className="school-track" aria-hidden="true">
                    <span className="school-fill" style={{ width: `${school.percentage}%` }} />
                  </span>
                  <span className="school-count">{school.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

const StatCard = ({ title, value }) => (
  <div className="panel report-stat">
    <strong>{value}</strong>
    <span>{title}</span>
  </div>
);

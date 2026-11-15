import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import Sidebar from '../components/Sidebar';

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
  const schools = data?.schools ?? [];
  const peak = Math.max(1, ...monthly.map((item) => item.count));
  const year = data?.year ?? CURRENT_YEAR;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#F5F0E7', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '2rem 4rem', overflowY: 'auto' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ color: '#2F6F69', fontSize: '2rem', margin: 0, fontWeight: '800' }}>Insights</h1>
          <p style={{ color: '#666', margin: '0.3rem 0 0 0', fontWeight: '500' }}>
            Your appointments, chats and anonymised insights. You never see a student's phone number; students appear by alias.
          </p>
        </div>

        {error && <p className="form-message error" role="alert">{error}</p>}

        {/* TOP STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          <StatCard title={`Booked in ${year}`} value={loading ? 'Ã¢â‚¬â€' : data?.booked_this_year ?? 0} />
          <StatCard title="Awaiting your confirmation" value={loading ? 'Ã¢â‚¬â€' : data?.awaiting_confirmation ?? 0} />
          <StatCard title="Upcoming appointments" value={loading ? 'Ã¢â‚¬â€' : data?.upcoming_appointments ?? 0} />
          <StatCard title="Ongoing chats (7 days)" value={loading ? 'Ã¢â‚¬â€' : data?.ongoing_chats ?? 0} />
        </div>

        <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <h3 style={{ color: '#2F6F69', marginTop: 0 }}>Insights for data analysis</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '2rem' }}>
            Private therapist view: students come from different schools, so they are grouped by school and year. No names or contact details are used.
          </p>

          {/* BAR CHART */}
          <h4 style={{ color: '#2F6F69', marginBottom: '1rem' }}>Bookings by month ({year})</h4>
          {loading ? (
            <p style={{ color: '#888' }}>Loading your bookingsÃ¢â‚¬Â¦</p>
          ) : monthly.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No bookings yet this year.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '150px', marginBottom: '3rem', paddingBottom: '20px', borderBottom: '1px solid #E5E7EB' }}>
              {monthly.map((item) => (
                <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  {item.count > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#2F6F69', marginBottom: '5px' }}>{item.count}</span>}
                  <div
                    title={`${item.label}: ${item.count} booking${item.count === 1 ? '' : 's'}`}
                    style={{
                      height: `${(item.count / peak) * 100}%`,
                      width: '80%',
                      backgroundColor: item.count > 0 ? '#2F6F69' : 'transparent',
                      borderRadius: '4px 4px 0 0',
                      minHeight: item.count > 0 ? '10px' : '0',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* SCHOOL BREAKDOWN */}
          <h4 style={{ color: '#2F6F69', marginBottom: '1rem' }}>By school</h4>
          {loading ? (
            <p style={{ color: '#888' }}>LoadingÃ¢â‚¬Â¦</p>
          ) : schools.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No school breakdown yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {schools.map((school) => (
                <div key={school.name} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ width: '200px', fontSize: '0.9rem', color: '#2F6F69', fontWeight: '500' }}>{school.name}</span>
                  <div style={{ flex: 1, background: '#E5E7EB', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${school.percentage}%`, background: '#2F6F69', height: '100%', borderRadius: '6px' }} />
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#2F6F69', width: '24px' }}>{school.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ title, value }) => (
  <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
    <h2 style={{ fontSize: '2rem', color: '#2F6F69', margin: '0 0 5px 0' }}>{value}</h2>
    <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>{title}</p>
  </div>
);

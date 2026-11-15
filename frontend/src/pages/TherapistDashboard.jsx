import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { CalendarCheck, CalendarDays, CalendarPlus, Clock3, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = 'http://127.0.0.1:8000/api';

function loadDashboard(token) {
  const headers = { Authorization: `Bearer ${token}` };
  return Promise.all([
    axios.get(`${api}/bookings/therapist-list/`, { headers }),
    axios.get(`${api}/counsellors/availability/`, { headers }),
    axios.get(`${api}/messaging/threads/`, { headers }),
  ]);
}

function formatCountdown(value, now) {
  const milliseconds = Math.max(0, new Date(value).getTime() - now);
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function TherapistDashboard() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [slots, setSlots] = useState([]);
  const [threads, setThreads] = useState([]);
  const [priorityRequests, setPriorityRequests] = useState([]);
  const [priorityLoading, setPriorityLoading] = useState(true);
  const [priorityError, setPriorityError] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [slotDate, setSlotDate] = useState('');
  const [slotTime, setSlotTime] = useState('');
  const [addingSlot, setAddingSlot] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const [bookingRes, slotRes, threadRes] = await loadDashboard(token);
      setBookings(Array.isArray(bookingRes.data) ? bookingRes.data : []);
      setSlots(Array.isArray(slotRes.data) ? slotRes.data : []);
      setThreads(Array.isArray(threadRes.data) ? threadRes.data : []);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Could not load your dashboard.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPriorityRequests = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${api}/tua/priority/assigned/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPriorityRequests(Array.isArray(data) ? data : []);
      setPriorityError('');
    } catch (error) {
      setPriorityError(error.response?.data?.error || 'Could not load priority requests.');
    } finally {
      setPriorityLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    void fetchDashboard();
    void fetchPriorityRequests();
    const dashboardRefresh = window.setInterval(() => void fetchDashboard(), 30000);
    const priorityRefresh = window.setInterval(() => void fetchPriorityRequests(), 10000);
    return () => {
      window.clearInterval(dashboardRefresh);
      window.clearInterval(priorityRefresh);
    };
  }, [fetchDashboard, fetchPriorityRequests, token]);

  useEffect(() => {
    const ticker = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await axios.post(`${api}/bookings/${bookingId}/status/`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotice({ type: 'success', text: `Booking ${newStatus}.` });
      fetchDashboard();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Failed to update the booking.' });
    }
  };

  const handleOpenPriorityRequest = async (requestId) => {
    try {
      const { data } = await axios.post(`${api}/tua/priority/${requestId}/accept/`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate(`/chat/${data.thread_id}`);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Could not open this priority chat.' });
      fetchDashboard();
    }
  };

  const handleAddSlot = async (event) => {
    event.preventDefault();
    setAddingSlot(true);
    setNotice({ type: '', text: '' });
    const start = new Date(`${slotDate}T${slotTime}`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      await axios.post(`${api}/counsellors/availability/create/`, {
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSlotDate('');
      setSlotTime('');
      setNotice({ type: 'success', text: 'Availability added. Students can now book this time.' });
      await fetchDashboard();
    } catch (error) {
      const data = error.response?.data;
      const message = typeof data === 'string' ? data : data?.error || data?.detail || Object.values(data || {}).flat().join(' ') || 'Failed to add availability.';
      setNotice({ type: 'error', text: message });
    } finally {
      setAddingSlot(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const totalBookings = bookings.filter((booking) => new Date(booking.slot_time).getFullYear() === currentYear).length;
  const awaiting = bookings.filter((booking) => booking.status === 'requested').length;
  const upcoming = bookings.filter((booking) => booking.status === 'confirmed').length;
  const activePriorityRequests = priorityRequests.filter((item) => (
    item.status === 'accepted' || new Date(item.respond_by).getTime() > currentTime
  ));

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content therapist-dashboard-content">
        <h1 className="therapist-dashboard-title">Welcome to your dashboard</h1>
        <p className="muted-copy therapist-dashboard-subtitle">Manage your appointments, availability, and chats here.</p>

        {notice.text && <div role="status" className={`form-message ${notice.type}`}>{notice.text}</div>}

        <div className="therapist-dashboard-stats">
          <StatCard title="Booked this year" value={loading ? '—' : totalBookings} icon={<CalendarDays size={18} />} />
          <StatCard title="Awaiting confirmation" value={loading ? '—' : awaiting} icon={<Clock3 size={18} />} />
          <StatCard title="Upcoming sessions" value={loading ? '—' : upcoming} icon={<CalendarCheck size={18} />} />
          <StatCard title="Ongoing chats" value={loading ? '—' : threads.length} icon={<MessageCircle size={18} />} />
        </div>

        <section className="panel therapist-priority-panel" aria-labelledby="priority-requests-title">
          <div className="therapist-priority-heading">
            <h2 id="priority-requests-title">Priority requests</h2>
            <span className="therapist-priority-badge">Urgent</span>
          </div>
          {priorityLoading ? <p style={muted}>Loading priority requests…</p> : priorityError ? (
            <p style={muted} role="alert">{priorityError}</p>
          ) : activePriorityRequests.length === 0 ? (
            <p style={muted}>No active priority requests.</p>
          ) : (
            <div className="therapist-priority-list">
              {activePriorityRequests.map((item) => (
                <article className="therapist-priority-item" key={item.id}>
                  <div className="therapist-priority-item-heading">
                    <span className="therapist-priority-badge">PRIORITY</span>
                    <strong>{item.student_alias}</strong>
                    {item.status === 'accepted' ? <span className="therapist-priority-accepted">Accepted</span> : (
                      <span className="therapist-priority-countdown" aria-label={`${formatCountdown(item.respond_by, currentTime)} remaining to respond`}>
                        <Clock3 size={15} /> {formatCountdown(item.respond_by, currentTime)}
                      </span>
                    )}
                  </div>
                  {item.phone && <p className="therapist-priority-phone">Shared with consent: <a href={`tel:${item.phone}`}>{item.phone}</a></p>}
                  <button className="therapist-priority-chat-link" type="button" onClick={() => handleOpenPriorityRequest(item.id)}>
                    {item.status === 'accepted' ? 'Open urgent chat' : 'Accept and open chat'} <MessageCircle size={15} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="therapist-dashboard-grid">
          <section className="panel therapist-dashboard-card">
            <h2 className="therapist-dashboard-section-title"><CalendarPlus size={20} /> Add availability</h2>
            <p className="muted-copy therapist-dashboard-intro">Create a one hour slot for students to book.</p>
            <form onSubmit={handleAddSlot} style={{ display: 'grid', gap: '1rem' }}>
              <label style={labelStyle}>Date
                <input type="date" value={slotDate} onChange={(event) => setSlotDate(event.target.value)} required style={inputStyle} />
              </label>
              <label style={labelStyle}>Start time
                <input type="time" value={slotTime} onChange={(event) => setSlotTime(event.target.value)} required style={inputStyle} />
              </label>
              <button type="submit" disabled={addingSlot} style={buttonStyle}>{addingSlot ? 'Adding…' : 'Add slot'}</button>
            </form>
            <div className="therapist-availability">
              <h3>Your availability</h3>
              {loading ? <p style={muted}>Loading slots…</p> : slots.length === 0 ? <p style={muted}>No slots added yet.</p> : (
                <div style={{ display: 'grid', gap: '0.6rem', maxHeight: 260, overflowY: 'auto' }}>
                  {slots.map((slot) => <div key={slot.id} className="therapist-availability-slot">
                    <Clock3 size={16} /> <span>{new Date(slot.starts_at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><strong style={{ marginLeft: 'auto', textTransform: 'capitalize' }}>{slot.status}</strong>
                  </div>)}
                </div>
              )}
            </div>
          </section>

          <section className="panel therapist-dashboard-card">
            <h2 className="therapist-dashboard-section-title">Recent appointments</h2>
            {loading ? <p style={muted}>Loading appointments…</p> : bookings.length === 0 ? <p style={muted}>No appointments yet.</p> : (
              <div className="therapist-appointments-scroll">
                <table className="therapist-appointments-table">
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Date and time</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          <span className="therapist-booking-student">{booking.student_alias}</span>
                          {booking.is_priority && <span className="therapist-priority-badge">Priority</span>}
                        </td>
                        <td className="therapist-booking-time">{new Date(booking.slot_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <span className={`therapist-booking-status${booking.status === 'requested' ? ' is-requested' : ''}`}>
                            {booking.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <div className="therapist-booking-actions">
                            {booking.status === 'requested' && <>
                              <button type="button" onClick={() => handleStatusChange(booking.id, 'confirmed')} style={buttonStyle}>Confirm</button>
                              <button type="button" onClick={() => handleStatusChange(booking.id, 'declined')} style={{ ...buttonStyle, background: 'var(--terra-soft)', color: 'var(--ink)', border: '1px solid var(--terra)' }}>Decline</button>
                            </>}
                            {booking.status === 'confirmed' && <button type="button" onClick={() => handleStatusChange(booking.id, 'completed')} style={buttonStyle}>Mark completed</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

const labelStyle = { display: 'grid', gap: 6, color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 600 };
const inputStyle = { boxSizing: 'border-box', width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--line)', color: 'var(--ink)', background: 'var(--card)', font: 'inherit' };
const buttonStyle = { background: 'var(--brand-green)', color: 'white', border: 0, padding: '0.65rem 0.9rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 };
const muted = { color: 'var(--muted)', fontSize: '0.9rem' };

function StatCard({ title, value, icon }) {
  return (
    <div className="panel therapist-stat-card">
      <div className="therapist-stat-card-heading">{icon}{value}</div>
      <span>{title}</span>
    </div>
  );
}

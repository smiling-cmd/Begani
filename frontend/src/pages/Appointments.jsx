import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarPlus, Clock3, Hourglass, MapPin, MessageCircle, Smartphone, Video, X } from 'lucide-react';
import api from '../api';
import PayWithMpesaDialog from '../components/PayWithMpesaDialog';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import './Appointments.css';

const TIME_ZONE = 'Africa/Nairobi';
const FORMATS = { online: ['Online', Video], in_person: ['In person', MapPin], both: ['Online or in person', Video] };

// Calm, student-friendly wording for every status.
const PAST_LABELS = {
  completed: { text: 'Completed', tone: 'is-done' },
  declined: { text: 'Couldn’t make this time', tone: 'is-soft' },
  expired: { text: 'Not confirmed in time', tone: 'is-soft' },
  cancelled_by_student: { text: 'You cancelled', tone: 'is-soft' },
  cancelled_by_therapist: { text: 'Cancelled by your counsellor', tone: 'is-soft' },
  student_no_show: { text: 'You didn’t make it', tone: 'is-soft' },
  therapist_no_show: { text: 'Your counsellor missed this one', tone: 'is-soft' },
};
const PAST_HINT = {
  declined: 'That’s okay. You can pick another time.',
  expired: 'Requests lapse if they aren’t confirmed in 48 hours. Try again.',
  cancelled_by_therapist: 'Sorry about that. Pick another time that works for you.',
  therapist_no_show: 'We’re sorry. Please book again or message them.',
};

const fmt = (value, options) => new Intl.DateTimeFormat('en-KE', { timeZone: TIME_ZONE, hour12: true, ...options }).format(new Date(value));
const fullDate = (value) => fmt(value, { weekday: 'long', day: 'numeric', month: 'long' });
const timeRange = (start, minutes) => `${fmt(start, { hour: 'numeric', minute: '2-digit' })} – ${fmt(new Date(start).getTime() + (minutes || 50) * 60_000, { hour: 'numeric', minute: '2-digit' })}`;

function initials(name = '') {
  const parts = name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '·';
}

function relative(value, now) {
  const minutes = Math.round((new Date(value).getTime() - now) / 60_000);
  if (minutes < 0) return '';
  if (minutes < 60) return `Starts in ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `In ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

function expiresIn(value, now) {
  const hours = Math.round((new Date(value).getTime() - now) / 3_600_000);
  if (hours <= 1) return 'Expires within the hour';
  if (hours < 48) return `Expires in ${hours} hours`;
  return `Expires in ${Math.round(hours / 24)} days`;
}

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function addToCalendar(appointment) {
  const stamp = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const end = new Date(new Date(appointment.starts_at).getTime() + (appointment.duration_minutes || 50) * 60_000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Begani//Appointments//EN', 'BEGIN:VEVENT',
    `UID:${appointment.id}@begani`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(appointment.starts_at)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(`Begani appointment with ${appointment.therapist_name}`)}`,
    'DESCRIPTION:Your Begani counselling appointment.', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([lines], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'begani-appointment.ics';
  anchor.click();
  URL.revokeObjectURL(url);
}

const asList = (data) => (Array.isArray(data) ? data : data?.results || []);

export default function Appointments() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState('upcoming');
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(null);
  const [paying, setPaying] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.get('/api/bookings/appointments/')
      .then((response) => { if (active) setAppointments(asList(response.data)); })
      .catch(() => { if (active) setError('We couldn’t load your appointments. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, retry]);

  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setConfirming(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  const groups = useMemo(() => {
    const future = (item) => new Date(item.starts_at).getTime() >= now;
    const upcoming = appointments.filter((item) => item.status === 'confirmed' && future(item))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const waiting = appointments.filter((item) => item.status === 'requested' && future(item))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const past = appointments.filter((item) => !upcoming.includes(item) && !waiting.includes(item))
      .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
    return { upcoming, waiting, past };
  }, [appointments, now]);

  const startChat = async (appointment) => {
    if (busyId) return;
    setBusyId(appointment.id);
    setNotice({ type: '', text: '' });
    try {
      const { data } = await api.post('/api/messaging/start/', { therapist_id: appointment.therapist_id });
      navigate(`/chat/${data.thread_id}`);
    } catch (requestError) {
      setNotice({ type: 'error', text: requestError.response?.data?.error || 'Could not open the chat. Please try again.' });
    } finally {
      setBusyId('');
    }
  };

  const cancel = async () => {
    const target = confirming;
    if (!target || busyId) return;
    setBusyId(target.id);
    setNotice({ type: '', text: '' });
    try {
      const { data } = await api.post(`/api/bookings/${target.id}/cancel/`, {});
      setAppointments((current) => current.map((item) => (item.id === data.id ? data : item)));
      setNotice({ type: 'success', text: `Your appointment with ${target.therapist_name} has been cancelled. The time is free for someone else.` });
      setConfirming(null);
    } catch (requestError) {
      setNotice({ type: 'error', text: requestError.response?.data?.error || 'Could not cancel. Please try again.' });
      setConfirming(null);
    } finally {
      setBusyId('');
    }
  };

  const renderWho = (appointment) => (
    <div className="ap-who">
      <span className="ap-avatar" aria-hidden="true">{initials(appointment.therapist_name)}</span>
      <div>
        <strong>{appointment.therapist_name}</strong>
        <span>{appointment.therapist_title || 'Counsellor'}</span>
      </div>
    </div>
  );

  const renderMeta = (appointment) => {
    const [formatLabel, FormatIcon] = FORMATS[appointment.format] || [];
    return (
      <ul className="ap-meta">
        <li><Clock3 size={15} />{timeRange(appointment.starts_at, appointment.duration_minutes)}</li>
        {formatLabel && <li><FormatIcon size={15} />{formatLabel}</li>}
      </ul>
    );
  };

  const renderDate = (appointment) => (
    <div className="ap-date" aria-hidden="true">
      <strong>{fmt(appointment.starts_at, { day: 'numeric' })}</strong>
      <span>{fmt(appointment.starts_at, { month: 'short' })}</span>
    </div>
  );

  const renderActive = (appointment, waiting) => (
    <article className={`ap-card${waiting ? ' is-waiting' : ''}`} key={appointment.id}>
      {renderDate(appointment)}
      <div className="ap-body">
        <div className="ap-top">
          <span className="ap-when">{fullDate(appointment.starts_at)}</span>
          {waiting
            ? <span className="ap-pill is-waiting"><Hourglass size={13} /> Waiting for confirmation</span>
            : <span className="ap-pill is-confirmed"><CalendarCheck size={13} /> Confirmed · {relative(appointment.starts_at, now)}</span>}
          {appointment.payment_status === 'paid' && <span className="ap-pill is-confirmed">Paid · KES {appointment.fee_kes_snapshot.toLocaleString()}</span>}
        </div>
        {renderWho(appointment)}
        {renderMeta(appointment)}
        {waiting && <p className="ap-hint">{appointment.therapist_name} usually replies within 48 hours. {expiresIn(appointment.confirm_by, now)}.</p>}
        {!waiting && ['unpaid', 'processing'].includes(appointment.payment_status) && (
          <p className="ap-hint">
            {appointment.payment_status === 'processing'
              ? 'We’re confirming your payment. This usually takes a moment.'
              : `Your counsellor confirmed this session. Pay KES ${appointment.fee_kes_snapshot.toLocaleString()} to secure it.`}
          </p>
        )}
        {waiting && appointment.payment_status !== 'free' && <p className="ap-hint">You’ll be asked to pay (KES {appointment.fee_kes_snapshot.toLocaleString()}) once it’s confirmed.</p>}
        <div className="ap-actions">
          {!waiting && ['unpaid', 'processing'].includes(appointment.payment_status) && (
            <button type="button" className="button" onClick={() => setPaying(appointment)}>
              <Smartphone size={16} /> {appointment.payment_status === 'processing' ? 'Check payment' : `Pay KES ${appointment.fee_kes_snapshot.toLocaleString()}`}
            </button>
          )}
          <button type="button" className={`button${!waiting && appointment.payment_status !== 'paid' && appointment.payment_status !== 'free' ? ' button-secondary' : ''}`} disabled={Boolean(busyId)} onClick={() => startChat(appointment)}>
            <MessageCircle size={16} /> {busyId === appointment.id && !confirming ? 'Opening…' : 'Message'}
          </button>
          {!waiting && <button type="button" className="button button-secondary" onClick={() => addToCalendar(appointment)}><CalendarPlus size={16} /> Add to calendar</button>}
          <button type="button" className="text-button" onClick={() => setConfirming(appointment)}>{waiting ? 'Cancel request' : 'Cancel'}</button>
        </div>
      </div>
    </article>
  );

  const renderPast = (appointment) => {
    const label = PAST_LABELS[appointment.status] || { text: appointment.status, tone: 'is-soft' };
    return (
      <article className="ap-row" key={appointment.id}>
        {renderDate(appointment)}
        <div className="ap-row-main">
          <div className="ap-row-top">
            <strong>{appointment.therapist_name}</strong>
            <span className={`ap-pill ${label.tone}`}>{label.text}</span>
          </div>
          <span className="ap-row-when">{fullDate(appointment.starts_at)} · {fmt(appointment.starts_at, { hour: 'numeric', minute: '2-digit' })}</span>
          {PAST_HINT[appointment.status] && <span className="ap-row-hint">{PAST_HINT[appointment.status]}</span>}
        </div>
        <Link className="button button-secondary ap-rebook" to={`/therapist/${appointment.therapist_id}`}>
          {appointment.status === 'completed' ? 'Book again' : 'Pick another time'}
        </Link>
      </article>
    );
  };

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
    { id: 'waiting', label: 'Waiting', count: groups.waiting.length },
    { id: 'past', label: 'Past', count: groups.past.length },
  ];
  const current = groups[tab];
  const emptyCopy = {
    upcoming: ['Nothing confirmed yet', 'Once a counsellor confirms a time, it will show up here.'],
    waiting: ['No requests waiting', 'When you ask for a time, you can follow its progress here.'],
    past: ['No past appointments', 'Completed and cancelled appointments will be kept here.'],
  }[tab];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <div className="ap-page">
          <header className="ap-header">
            <span className="ap-eyebrow"><CalendarCheck size={15} /> Your counselling sessions</span>
            <h1>Appointments</h1>
            <p>See who has confirmed, what’s still waiting, and everything you’ve booked before. Times are in East Africa Time.</p>
          </header>

          {notice.text && <p className={`form-message ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

          <div className="ap-tabs" role="tablist" aria-label="Appointment groups">
            {tabs.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`ap-tab${tab === item.id ? ' is-on' : ''}`} onClick={() => setTab(item.id)}>
                {item.label}<span className="ap-count">{loading ? '–' : item.count}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="ap-list" aria-label="Loading appointments">{[0, 1].map((i) => <div key={i} className="ap-skeleton" />)}</div>
          ) : error ? (
            <section className="empty-state panel" role="alert">
              <h2>Appointments are unavailable</h2>
              <p>{error}</p>
              <button type="button" className="button button-secondary" onClick={() => { setError(''); setLoading(true); setRetry((count) => count + 1); }}>Try again</button>
            </section>
          ) : current.length === 0 ? (
            <section className="empty-state panel ap-empty">
              <h2>{emptyCopy[0]}</h2>
              <p>{emptyCopy[1]}</p>
              <Link className="button" to="/support">Find support</Link>
            </section>
          ) : (
            <div className="ap-list">
              {tab === 'past' ? current.map(renderPast) : current.map((item) => renderActive(item, tab === 'waiting'))}
            </div>
          )}
        </div>
      </main>

      {paying && (
        <PayWithMpesaDialog
          title={`Session with ${paying.therapist_name}`}
          amount={paying.fee_kes_snapshot}
          startUrl={`/api/payments/booking/${paying.id}/pay/`}
          onClose={() => setPaying(null)}
          onPaid={() => setRetry((value) => value + 1)}
        />
      )}
      {confirming && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirming(null); }}>
          <section className="dialog-card ap-dialog" role="dialog" aria-modal="true" aria-labelledby="ap-cancel-title">
            <button type="button" className="icon-button dialog-close" onClick={() => setConfirming(null)} aria-label="Close"><X size={20} /></button>
            <h2 id="ap-cancel-title">{confirming.status === 'requested' ? 'Cancel this request?' : 'Cancel this appointment?'}</h2>
            <p>{fullDate(confirming.starts_at)} at {fmt(confirming.starts_at, { hour: 'numeric', minute: '2-digit' })} with {confirming.therapist_name}. The time will go back to being available for others, and you can always book again.</p>
            <div className="ap-dialog-actions">
              <button type="button" className="button button-secondary" onClick={() => setConfirming(null)}>Keep it</button>
              <button type="button" className="button ap-danger" disabled={Boolean(busyId)} onClick={cancel}>{busyId ? 'Cancelling…' : 'Yes, cancel'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

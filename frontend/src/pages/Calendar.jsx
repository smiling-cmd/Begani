import { useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Download, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import './Calendar.css';

const TIME_ZONE = 'Africa/Nairobi';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function asList(data) {
  return Array.isArray(data) ? data : data?.results ?? [];
}

function getNairobiDateKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function getTodayInNairobi() {
  const [year, month, day] = getNairobiDateKey(new Date()).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDayKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatSelectedDate(date) {
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function describeDaysUntil(targetKey, todayKey) {
  const diff = Math.round((parseDayKey(targetKey) - parseDayKey(todayKey)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

function formatShortDate(key) {
  return new Intl.DateTimeFormat('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseDayKey(key));
}

function moodLabel(score) {
  if (score <= 2) return 'Very low';
  if (score <= 4) return 'Low';
  if (score <= 6) return 'Okay';
  if (score <= 8) return 'Good';
  return 'Great';
}

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function downloadCalendarEvent(event) {
  const toIcsTime = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const end = new Date(new Date(event.startsAt).getTime() + (event.durationMinutes || 60) * 60_000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Begani//Student Calendar//EN',
    'BEGIN:VEVENT', `UID:${event.id}@begani`, `DTSTAMP:${toIcsTime(new Date())}`,
    `DTSTART:${toIcsTime(event.startsAt)}`, `DTEND:${toIcsTime(end)}`,
    `SUMMARY:${escapeIcs(event.type === 'session' ? 'Begani appointment' : event.title)}`,
    event.location ? `LOCATION:${escapeIcs(event.location)}` : '',
    `DESCRIPTION:${escapeIcs(event.type === 'session' ? 'Your Begani appointment.' : 'Your registered Begani activity.')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${event.type === 'session' ? 'begani-appointment' : 'begani-activity'}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length: total }, (_, index) => new Date(year, month, index - offset + 1, 12));
}

export default function CalendarPage() {
  const { token } = useContext(AuthContext);
  const today = useMemo(() => getTodayInNairobi(), []);
  const [displayMonth, setDisplayMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [selectedKey, setSelectedKey] = useState(() => dayKey(today));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    Promise.allSettled([
      api.get('/api/bookings/my/'),
      api.get('/api/activities/registrations/'),
      api.get('/api/wellbeing/moods/'),
    ]).then((results) => {
      if (!active) return;
      const [bookings, registrations, moods] = results;
      const nextItems = [];
      const nextErrors = [];

      if (bookings.status === 'fulfilled') {
        asList(bookings.value.data).forEach((booking) => {
          if (!booking.starts_at) return;
          nextItems.push({
            id: `session-${booking.id}`,
            type: 'session',
            title: 'Appointment',
            startsAt: booking.starts_at,
            status: booking.status,
          });
        });
      } else nextErrors.push('appointments');

      if (registrations.status === 'fulfilled') {
        asList(registrations.value.data).forEach((registration) => {
          if (registration.status === 'cancelled' || !registration.activity_starts_at) return;
          nextItems.push({
            id: `activity-${registration.id}`,
            type: 'activity',
            title: registration.activity_title || 'Registered activity',
            startsAt: registration.activity_starts_at,
            location: registration.location_text || '',
            status: registration.status,
          });
        });
      } else nextErrors.push('activities');

      if (moods.status === 'fulfilled') {
        asList(moods.value.data).forEach((checkin) => {
          if (!checkin.checked_in_at) return;
          nextItems.push({
            id: `mood-${checkin.id}`,
            type: 'mood',
            title: 'Mood check-in',
            startsAt: checkin.checked_in_at,
            score: checkin.score,
          });
        });
      } else nextErrors.push('mood check-ins');

      nextItems.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      setItems(nextItems);
      setErrors(nextErrors);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, retry]);

  const monthDays = useMemo(() => createMonthDays(displayMonth), [displayMonth]);
  const itemsByDay = useMemo(() => items.reduce((grouped, item) => {
    const key = getNairobiDateKey(item.startsAt);
    (grouped[key] ||= []).push(item);
    return grouped;
  }, {}), [items]);
  const selectedItems = itemsByDay[selectedKey] || [];
  const todayKey = dayKey(today);
  const [openedAt] = useState(() => Date.now());
  const upcoming = useMemo(
    () => items.filter((item) => item.type !== 'mood' && new Date(item.startsAt).getTime() >= openedAt),
    [items, openedAt],
  );
  const nextUp = upcoming[0];
  const monthPrefix = dayKey(displayMonth).slice(0, 7);
  const monthCounts = useMemo(() => items.reduce((counts, item) => {
    if (getNairobiDateKey(item.startsAt).startsWith(monthPrefix)) counts[item.type] += 1;
    return counts;
  }, { session: 0, activity: 0, mood: 0 }), [items, monthPrefix]);
  const selectedDate = parseDayKey(selectedKey);
  const monthLabel = new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric' }).format(displayMonth);

  const shiftMonth = (amount) => {
    const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + amount, 1, 12);
    setDisplayMonth(nextMonth);
    setSelectedKey(dayKey(nextMonth));
  };

  const goToDay = (key) => {
    const date = parseDayKey(key);
    setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    setSelectedKey(key);
  };

  const showToday = () => {
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12));
    setSelectedKey(dayKey(today));
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content begani-calendar-page">
        <header className="page-heading">
          <div className="eyebrow"><CalendarDays size={16} /> Your plans and check-ins</div>
          <h1>Calendar</h1>
          <p>See your appointments, registered activities, and mood check-ins together.</p>
        </header>

        {!loading && (
          <section className="calendar-summary" aria-label="At a glance">
            <div className={`calendar-next${nextUp ? ` is-${nextUp.type}` : ''}`}>
              <span className="calendar-next-kicker">Next up</span>
              {nextUp ? (
                <>
                  <strong>{nextUp.title}</strong>
                  <span className="calendar-next-when">
                    {describeDaysUntil(getNairobiDateKey(nextUp.startsAt), todayKey)} · {formatShortDate(getNairobiDateKey(nextUp.startsAt))} · {formatTime(nextUp.startsAt)}
                  </span>
                  <button type="button" className="calendar-next-button" onClick={() => goToDay(getNairobiDateKey(nextUp.startsAt))}>
                    View day <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  <strong>Nothing booked yet</strong>
                  <span className="calendar-next-when">Join an activity or book a counsellor and it will show up here.</span>
                  <Link className="calendar-next-button" to="/activities">Browse activities <ArrowRight size={15} aria-hidden="true" /></Link>
                </>
              )}
            </div>
            <dl className="calendar-stats">
              <div><dt><i className="calendar-dot dot-session" /> Appointments</dt><dd>{monthCounts.session}</dd></div>
              <div><dt><i className="calendar-dot dot-activity" /> Activities</dt><dd>{monthCounts.activity}</dd></div>
              <div><dt><i className="calendar-dot dot-mood" /> Check-ins</dt><dd>{monthCounts.mood}</dd></div>
              <p className="calendar-stats-note">in {monthLabel}</p>
            </dl>
          </section>
        )}

        <div className="calendar-layout">
          <section className="calendar-month panel" aria-label="Monthly calendar">
            <div className="calendar-toolbar">
              <div className="calendar-month-label">
                <h2>{monthLabel}</h2>
                <span>East Africa Time</span>
              </div>
              <div className="calendar-controls">
                <button className="button button-secondary calendar-today-button" type="button" onClick={showToday} disabled={selectedKey === todayKey && dayKey(displayMonth).slice(0, 7) === todayKey.slice(0, 7)}>Today</button>
                <button className="icon-button" type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={19} /></button>
                <button className="icon-button" type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={19} /></button>
              </div>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-days">
              {monthDays.map((date) => {
                const key = dayKey(date);
                const dayItems = itemsByDay[key] || [];
                const types = [...new Set(dayItems.map((item) => item.type))];
                const outside = date.getMonth() !== displayMonth.getMonth();
                const currentDay = key === dayKey(today);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`calendar-day${outside ? ' is-outside' : ''}${currentDay ? ' is-today' : ''}${selectedKey === key ? ' is-selected' : ''}`}
                    aria-label={`${formatSelectedDate(date)}${dayItems.length ? `, ${dayItems.length} item${dayItems.length === 1 ? '' : 's'}` : ''}`}
                    aria-pressed={selectedKey === key}
                    onClick={() => {
                      setSelectedKey(key);
                      if (outside) setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
                    }}
                  >
                    <span className="calendar-day-number">{date.getDate()}</span>
                    <span className="calendar-day-dots" aria-hidden="true">
                      {types.map((type) => <i key={type} className={`calendar-dot dot-${type}`} />)}
                    </span>
                    {dayItems.length > 0 && <span className="calendar-day-count">{dayItems.length}</span>}
                  </button>
                );
              })}
            </div>

            <div className="calendar-legend" aria-label="Calendar item types">
              <span><i className="calendar-dot dot-session" /> Appointment</span>
              <span><i className="calendar-dot dot-activity" /> Activity</span>
              <span><i className="calendar-dot dot-mood" /> Mood check-in</span>
            </div>
          </section>

          <aside className="calendar-agenda panel" aria-live="polite">
            <div className="section-title-row calendar-agenda-heading">
              <div><span className="calendar-agenda-kicker">Selected day</span><h2>{formatSelectedDate(selectedDate)}</h2></div>
              <span>{selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}</span>
            </div>

            {loading ? <p className="muted-copy">Loading your calendar…</p> : (
              <>
                {errors.length > 0 && (
                  <div className="calendar-load-error" role="status">
                    <p>Couldn’t load {errors.join(', ')}.</p>
                    <button className="text-button" type="button" onClick={() => { setLoading(true); setRetry((count) => count + 1); }}>Try again</button>
                  </div>
                )}
                {selectedItems.length === 0 ? (
                  <>
                  <div className="calendar-empty-day">
                    <CalendarDays size={26} />
                    <p>{selectedKey === todayKey ? 'Nothing planned for today.' : 'No plans or check-ins for this day.'}</p>
                    <div className="calendar-empty-links">
                      <Link to="/activities">Find an activity</Link>
                      <Link to="/support">Find support</Link>
                    </div>
                  </div>
                  {upcoming.length > 0 && (
                    <div className="calendar-coming">
                      <h3>Coming up</h3>
                      <ul>
                        {upcoming.slice(0, 3).map((item) => {
                          const key = getNairobiDateKey(item.startsAt);
                          return (
                            <li key={item.id}>
                              <button type="button" onClick={() => goToDay(key)}>
                                <i className={`calendar-dot dot-${item.type}`} aria-hidden="true" />
                                <span><strong>{item.title}</strong><small>{formatShortDate(key)} · {formatTime(item.startsAt)}</small></span>
                                <ChevronRight size={16} aria-hidden="true" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  </>
                ) : (
                  <ul className="calendar-event-list">
                    {selectedItems.map((event) => (
                      <li className={`calendar-event event-${event.type}`} key={event.id}>
                        <time className="calendar-event-clock" dateTime={event.startsAt}>{formatTime(event.startsAt)}</time>
                        <div className="calendar-event-copy">
                          <strong>{event.title}</strong>
                          {event.type === 'session' && <span className="calendar-event-detail">Counselling appointment · {event.status === 'confirmed' ? 'Confirmed' : 'Awaiting confirmation'}</span>}
                          {event.type === 'activity' && <span className="calendar-event-detail">Registered activity</span>}
                          {event.type === 'mood' && <span className="calendar-event-detail">You felt {moodLabel(event.score).toLowerCase()}</span>}
                          <div className="calendar-event-actions">
                            {event.type === 'session' && <Link to="/appointments">Manage appointment</Link>}
                            {event.type === 'activity' && <Link to="/activities">View activities</Link>}
                            {event.type !== 'mood' && (
                              <button type="button" onClick={() => downloadCalendarEvent(event)}><Download size={14} /> Add to calendar</button>
                            )}
                            {event.type === 'activity' && event.location && <span className="calendar-event-location"><MapPin size={13} />{event.location}</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </aside>
        </div>

        <p className="calendar-privacy-note">Mood check-ins are private to you and appear only in your calendar.</p>
      </main>
    </div>
  );
}

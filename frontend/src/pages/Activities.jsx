import { Fragment, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import {
  ArrowRight, CalendarDays, Check, Clock3, Footprints, Leaf, MapPin, Mountain,
  Music, Palette, Search, Sparkles, Sun, Trees, Users, X, BookOpen, MessagesSquare,
} from 'lucide-react';
import PayWithMpesaDialog from '../components/PayWithMpesaDialog';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import activitiesPhoto from '../assets/activities.jpeg';
import './Activities.css';

const TYPES = {
  hiking: { label: 'Hiking', icon: Mountain },
  painting: { label: 'Painting', icon: Palette },
  yoga: { label: 'Yoga', icon: Leaf },
  music: { label: 'Music', icon: Music },
  reading_club: { label: 'Reading club', icon: BookOpen },
  group_talk: { label: 'Group talk', icon: MessagesSquare },
  mindfulness: { label: 'Mindfulness', icon: Footprints },
  picnic: { label: 'Picnic', icon: Trees },
  trip: { label: 'Wellbeing trip', icon: Sun },
  other: { label: 'Other', icon: Sparkles },
};
const typeInfo = (type) => TYPES[type] || { label: type, icon: Sparkles };

function getErrorMessage(error) {
  const detail = error.response?.data?.detail || error.response?.data;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.join(' ');
  if (detail && typeof detail === 'object') {
    const messages = Object.values(detail).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Could not load activities. Please try again.';
}

const fmt = (value, options) => new Intl.DateTimeFormat(undefined, options).format(new Date(value));
const fullDate = (value) => fmt(value, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const shortDate = (value) => fmt(value, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function weekGroup(value, now) {
  const diff = Math.round((startOfWeek(value) - startOfWeek(now)) / (7 * 24 * 3600 * 1000));
  if (diff <= 0) return 'This week';
  if (diff === 1) return 'Next week';
  return 'Later';
}

function Badge({ children, tone = '' }) {
  return <span className={`ax-badge ${tone}`}>{children}</span>;
}

function spotsText(activity) {
  if (activity.spots_left === undefined) return `Up to ${activity.capacity} people`;
  if (activity.spots_left === 0) return 'Full';
  if (activity.spots_left <= 5) return `Only ${activity.spots_left} spots left`;
  return `${activity.spots_left} spots left`;
}

export default function Activities() {
  const { token } = useContext(AuthContext);
  const [activities, setActivities] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busyIds, setBusyIds] = useState([]);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [selected, setSelected] = useState(null);
  const [paying, setPaying] = useState(null); // { activity, registration }
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    Promise.all([api.get('/api/activities/'), api.get('/api/activities/registrations/')])
      .then(([activityResponse, registrationResponse]) => {
        if (!active) return;
        const a = activityResponse.data;
        const r = registrationResponse.data;
        setActivities(Array.isArray(a) ? a : a.results || []);
        setRegistrations(Array.isArray(r) ? r : r.results || []);
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, retryCount]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const activeRegistration = (activityId) => registrations.find((registration) =>
    registration.activity === activityId && registration.status !== 'cancelled');

  const myPlans = useMemo(() => registrations
    .filter((registration) => registration.status !== 'cancelled' && new Date(registration.activity_starts_at) >= now)
    .sort((a, b) => new Date(a.activity_starts_at) - new Date(b.activity_starts_at)), [registrations, now]);

  const filterOptions = useMemo(() => {
    const types = [...new Set(activities.map((activity) => activity.type).filter(Boolean))];
    return [
      { id: 'all', label: 'All' },
      { id: 'free', label: 'Free' },
      { id: 'paid', label: 'Paid' },
      ...types.map((type) => ({ id: type, label: typeInfo(type).label })),
    ];
  }, [activities]);

  const visible = useMemo(() => activities.filter((activity) => {
    const matchesFilter = filter === 'all'
      || (filter === 'free' && !activity.fee_kes)
      || (filter === 'paid' && activity.fee_kes > 0)
      || activity.type === filter;
    const text = `${activity.title} ${typeInfo(activity.type).label} ${activity.description || ''} ${activity.location_text}`.toLowerCase();
    return matchesFilter && text.includes(query.trim().toLowerCase());
  }), [activities, filter, query]);

  const featured = filter === 'all' && !query.trim()
    ? activities.find((activity) => !activeRegistration(activity.id) && (activity.spots_left ?? 1) > 0)
    : null;
  const listed = featured ? visible.filter((activity) => activity.id !== featured.id) : visible;

  const groups = useMemo(() => {
    const order = ['This week', 'Next week', 'Later'];
    const map = new Map(order.map((name) => [name, []]));
    listed.forEach((activity) => map.get(weekGroup(activity.starts_at, now)).push(activity));
    return order.map((name) => [name, map.get(name)]).filter(([, items]) => items.length);
  }, [listed, now]);

  const setBusy = (id, on) => setBusyIds((current) => (on ? [...current, id] : current.filter((value) => value !== id)));

  const join = async (activity) => {
    if (activeRegistration(activity.id) || busyIds.includes(activity.id)) return;
    setBusy(activity.id, true);
    setNotice({ type: '', text: '' });
    try {
      const { data, status } = await api.post(`/api/activities/${activity.id}/register/`, {});
      setRegistrations((current) => [...current.filter((registration) => registration.activity !== data.activity), data]);
      if (status === 201) {
        setActivities((current) => current.map((item) => (item.id === activity.id && item.spots_left !== undefined
          ? { ...item, spots_left: Math.max(item.spots_left - 1, 0) } : item)));
      }
      if (activity.fee_kes > 0 && data.payment_status !== 'paid') {
        setSelected(null);
        setPaying({ activity, registration: data });
        return;
      }
      setNotice({ type: 'success', text: status === 201 ? `You’re in. We’ve saved your place for ${activity.title}.` : `You’re already registered for ${activity.title}.` });
    } catch (requestError) {
      setNotice({ type: 'error', text: getErrorMessage(requestError) });
    } finally {
      setBusy(activity.id, false);
    }
  };

  const cancel = async (activity) => {
    const registration = activeRegistration(activity.id);
    if (!registration || busyIds.includes(activity.id)) return;
    setBusy(activity.id, true);
    setNotice({ type: '', text: '' });
    try {
      const { data } = await api.post(`/api/activities/registrations/${registration.id}/cancel/`, {});
      setRegistrations((current) => current.map((item) => (item.id === data.id ? data : item)));
      setActivities((current) => current.map((item) => (item.id === activity.id && item.spots_left !== undefined
        ? { ...item, spots_left: item.spots_left + 1 } : item)));
      setNotice({ type: 'success', text: `Your place for ${activity.title} has been released.` });
    } catch (requestError) {
      setNotice({ type: 'error', text: getErrorMessage(requestError) });
    } finally {
      setBusy(activity.id, false);
    }
  };

  const activityById = (id) => activities.find((activity) => activity.id === id);

  const renderAction = (activity, large = false) => {
    const registered = Boolean(activeRegistration(activity.id));
    const busy = busyIds.includes(activity.id);
    const full = activity.spots_left === 0;
    const registration = activeRegistration(activity.id);
    if (registration && registration.status === 'pending_payment') {
      return (
        <div className="ax-actions-row">
          <button type="button" className={`button${large ? ' ax-button-large' : ''}`} disabled={busy} onClick={() => setPaying({ activity, registration })}>
            {registration.payment_status === 'processing' ? 'Check payment' : `Complete payment · KES ${activity.fee_kes.toLocaleString()}`}
          </button>
          <button type="button" className="text-button" disabled={busy} onClick={() => cancel(activity)}>{busy ? 'Working…' : 'Release place'}</button>
        </div>
      );
    }
    if (registered) {
      return (
        <div className="ax-actions-row">
          <span className="ax-going"><Check size={16} /> You’re going</span>
          <button type="button" className="text-button" disabled={busy} onClick={() => cancel(activity)}>{busy ? 'Working…' : 'Cancel place'}</button>
        </div>
      );
    }
    if (full) return <button type="button" className="button button-secondary" disabled>Fully booked</button>;
    return (
      <button type="button" className={`button${large ? ' ax-button-large' : ''}`} disabled={busy} onClick={() => join(activity)}>
        {busy ? 'Saving your place…' : activity.fee_kes > 0 ? `Pay KES ${activity.fee_kes.toLocaleString()} to join` : 'Join for free'} <ArrowRight size={16} />
      </button>
    );
  };

  const renderArt = (activity) => {
    const { icon: Icon } = typeInfo(activity.type);
    return (
      <div className={`ax-art ax-art-${activity.type.replace(/_/g, '-')}`} aria-hidden="true">
        <span className="ax-art-orb" />
        <span className="ax-art-hill" />
        <Icon size={38} strokeWidth={1.4} />
        <div className="ax-date"><strong>{fmt(activity.starts_at, { day: 'numeric' })}</strong><span>{fmt(activity.starts_at, { month: 'short' })}</span></div>
      </div>
    );
  };

  const renderCard = (activity) => {
    const info = typeInfo(activity.type);
    const registered = Boolean(activeRegistration(activity.id));
    return (
      <article className={`ax-card${registered ? ' is-registered' : ''}`}>
        {renderArt(activity)}
        <div className="ax-card-body">
          <div className="ax-card-top">
            <span className="ax-kind"><info.icon size={14} /> {info.label}</span>
            <Badge tone={activity.fee_kes ? 'is-paid' : 'is-free'}>{activity.fee_kes ? `KES ${activity.fee_kes.toLocaleString()}` : 'Free'}</Badge>
          </div>
          <h3>{activity.title}</h3>
          <p className="ax-desc">{activity.description || 'Details will be shared by the organiser.'}</p>
          <ul className="ax-facts">
            <li><CalendarDays size={15} />{shortDate(activity.starts_at)}</li>
            <li><MapPin size={15} />{activity.location_text}</li>
            <li><Clock3 size={15} />{durationLabel(activity.duration_minutes)}<span className="ax-dot" /><Users size={15} /><span className={activity.spots_left !== undefined && activity.spots_left <= 5 ? 'ax-low' : ''}>{spotsText(activity)}</span></li>
          </ul>
          <div className="ax-card-actions">
            {renderAction(activity)}
            <button type="button" className="text-button" onClick={() => setSelected(activity)}>Details</button>
          </div>
        </div>
      </article>
    );
  };

  const resetFilters = () => { setQuery(''); setFilter('all'); };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <div className="ax-page">
          <header className="ax-hero">
            <img className="ax-hero-photo" src={activitiesPhoto} alt="" />
            <div className="ax-hero-copy">
              <span className="ax-eyebrow"><Mountain size={15} /> Find your next little lift</span>
              <h1>Activities</h1>
              <p>Walks, picnics, music and quiet circles. Pick something small, bring a friend, or come on your own.</p>
              <label className="ax-search">
                <Search size={18} aria-hidden="true" />
                <input aria-label="Search activities" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search walks, yoga, trips or places..." />
              </label>
            </div>
          </header>

          {notice.text && <p className={`form-message ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

          {myPlans.length > 0 && (
            <section className="ax-plans" aria-label="Your upcoming plans">
              <h2>Your plans</h2>
              <ul>
                {myPlans.map((plan) => {
                  const activity = activityById(plan.activity);
                  return (
                    <li key={plan.id}>
                      <div className="ax-plan-date"><strong>{fmt(plan.activity_starts_at, { day: 'numeric' })}</strong><span>{fmt(plan.activity_starts_at, { month: 'short' })}</span></div>
                      <div className="ax-plan-copy">
                        <strong>{plan.activity_title}</strong>
                        <span>{fmt(plan.activity_starts_at, { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · {plan.location_text}</span>
                      </div>
                      {activity && <button type="button" className="text-button" onClick={() => setSelected(activity)}>Details</button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!loading && !error && activities.length > 0 && (
            <div className="ax-filters" role="group" aria-label="Filter activities">
              {filterOptions.map((option) => (
                <button key={option.id} type="button" className={`ax-chip${filter === option.id ? ' is-on' : ''}`} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}</button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="ax-skeletons" aria-label="Loading activities">{[0, 1, 2].map((i) => <div key={i} className="ax-skeleton" />)}</div>
          ) : error ? (
            <section className="empty-state panel" role="alert">
              <h2>Activities are unavailable</h2>
              <p>{error}</p>
              <button type="button" className="button button-secondary" onClick={() => { setError(''); setLoading(true); setRetryCount((count) => count + 1); }}>Try again</button>
            </section>
          ) : visible.length === 0 ? (
            <section className="empty-state panel">
              <h2>{activities.length ? 'Nothing matches that yet' : 'No activities scheduled yet'}</h2>
              <p>{activities.length ? 'Try another word, or clear the filters.' : 'New activities will appear here as soon as they are published.'}</p>
              {activities.length > 0 && <button type="button" className="button button-secondary" onClick={resetFilters}>Clear filters</button>}
            </section>
          ) : (
            <>
              {featured && (
                <section className="ax-featured" aria-label="Next up">
                  {renderArt(featured)}
                  <div className="ax-featured-body">
                    <span className="ax-eyebrow ax-eyebrow-dark"><Sparkles size={14} /> Next up for you</span>
                    <h2>{featured.title}</h2>
                    <p>{featured.description}</p>
                    <ul className="ax-facts ax-facts-row">
                      <li><CalendarDays size={15} />{fullDate(featured.starts_at)}</li>
                      <li><MapPin size={15} />{featured.location_text}</li>
                      <li><Clock3 size={15} />{durationLabel(featured.duration_minutes)}</li>
                    </ul>
                    <div className="ax-card-actions">
                      {renderAction(featured, true)}
                      <Badge tone={featured.fee_kes ? 'is-paid' : 'is-free'}>{featured.fee_kes ? `KES ${featured.fee_kes.toLocaleString()}` : 'Free'}</Badge>
                      <button type="button" className="text-button" onClick={() => setSelected(featured)}>Details</button>
                    </div>
                  </div>
                </section>
              )}
              {groups.map(([name, items]) => (
                <section key={name} className="ax-group">
                  <h2>{name}</h2>
                  <div className="ax-grid">{items.map((activity) => <Fragment key={activity.id}>{renderCard(activity)}</Fragment>)}</div>
                </section>
              ))}
              {listed.length === 0 && featured && <p className="muted-copy">That’s everything for now. Check back soon.</p>}
              <p className="ax-note">Free activities save your place straight away. Paid activities will open for booking once online payment is connected.</p>
            </>
          )}
        </div>
      </main>

      {selected && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="dialog-card ax-dialog" role="dialog" aria-modal="true" aria-labelledby="activity-dialog-title">
            <button type="button" className="icon-button dialog-close" onClick={() => setSelected(null)} aria-label="Close activity details"><X size={20} /></button>
            {renderArt(selected)}
            <span className="ax-kind ax-kind-dialog">{typeInfo(selected.type).label}</span>
            <h2 id="activity-dialog-title">{selected.title}</h2>
            <p>{selected.description || 'Details will be shared by the organiser.'}</p>
            <ul className="ax-facts ax-facts-dialog">
              <li><CalendarDays size={16} />{fullDate(selected.starts_at)}</li>
              <li><MapPin size={16} />{selected.location_text}</li>
              <li><Clock3 size={16} />{durationLabel(selected.duration_minutes)}</li>
              <li><Users size={16} />{spotsText(selected)}</li>
              <li><Sparkles size={16} />{selected.fee_kes ? `KES ${selected.fee_kes.toLocaleString()} per person` : 'Free to join'}</li>
            </ul>
            <p className="dialog-note">
              {selected.fee_kes > 0 && !activeRegistration(selected.id) ? 'We hold your place while you pay with M-Pesa. It’s released if payment isn’t completed.'
                : activeRegistration(selected.id) ? 'Your place is saved. You can release it any time before it starts.'
                  : 'Joining saves your place. You can cancel before it starts.'}
            </p>
            {renderAction(selected, true)}
          </section>
        </div>
      )}
      {paying && (
        <PayWithMpesaDialog
          title={paying.activity.title}
          amount={paying.activity.fee_kes}
          startUrl={`/api/payments/registration/${paying.registration.id}/pay/`}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setRegistrations((current) => current.map((item) => (item.id === paying.registration.id
              ? { ...item, status: 'registered', payment_status: 'paid' } : item)));
            setNotice({ type: 'success', text: `Payment received. You’re in for ${paying.activity.title}.` });
          }}
        />
      )}
    </div>
  );
}

import { useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { ArrowRight, CalendarDays, Clock3, MapPin, Mountain, Users, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import activitiesPhoto from '../assets/activities.jpeg';

const typeLabels = {
  hiking: 'Hiking',
  painting: 'Painting',
  yoga: 'Yoga',
  music: 'Music',
  reading_club: 'Reading club',
  group_talk: 'Group talk',
  mindfulness: 'Mindfulness',
  other: 'Other',
};

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

function formatActivityDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function Activities() {
  const { token } = useContext(AuthContext);
  const [activities, setActivities] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [joiningIds, setJoiningIds] = useState([]);
  const [registrationNotice, setRegistrationNotice] = useState({ type: '', text: '' });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    Promise.all([
      api.get('/api/activities/'),
      api.get('/api/activities/registrations/'),
    ])
      .then(([activityResponse, registrationResponse]) => {
        if (!active) return;
        const activityData = activityResponse.data;
        const registrationData = registrationResponse.data;
        setActivities(Array.isArray(activityData) ? activityData : activityData.results || []);
        setRegistrations(Array.isArray(registrationData) ? registrationData : registrationData.results || []);
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, retryCount]);

  useEffect(() => {
    if (!selected) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const filters = useMemo(() => [
    'All',
    'Free',
    'Paid',
    ...new Set(activities.map((activity) => activity.type).filter(Boolean)),
  ], [activities]);
  const visibleActivities = useMemo(() => activities.filter((activity) => {
    const typeLabel = typeLabels[activity.type] || activity.type;
    const matchesFilter = filter === 'All'
      || (filter === 'Free' && activity.fee_kes === 0)
      || (filter === 'Paid' && activity.fee_kes > 0)
      || activity.type === filter;
    const matchesQuery = `${activity.title} ${typeLabel} ${activity.description || ''} ${activity.location_text}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  }), [activities, filter, query]);

  const isRegistered = (activityId) => registrations.some((registration) =>
    registration.activity === activityId && registration.status !== 'cancelled');

  const handleJoin = async (activity) => {
    if (activity.fee_kes > 0 || isRegistered(activity.id) || joiningIds.includes(activity.id)) return;
    setJoiningIds((current) => [...current, activity.id]);
    setRegistrationNotice({ type: '', text: '' });
    try {
      const { data, status: responseStatus } = await api.post(`/api/activities/${activity.id}/register/`, {});
      setRegistrations((current) => [
        ...current.filter((registration) => registration.activity !== data.activity),
        data,
      ]);
      setRegistrationNotice({
        type: 'success',
        text: responseStatus === 201 ? `You’re registered for ${activity.title}.` : `You’re already registered for ${activity.title}.`,
      });
    } catch (requestError) {
      setRegistrationNotice({ type: 'error', text: getErrorMessage(requestError) });
    } finally {
      setJoiningIds((current) => current.filter((id) => id !== activity.id));
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading">
          <div className="eyebrow"><Mountain size={16} /> Find your next little lift</div>
          <h1>Activities</h1>
          <p>Try something new, spend time with others, or make space to recharge.</p>
        </header>

        <section className="activity-intro panel">
          <div>
            <h2>There’s room for you here.</h2>
            <p>Choose an activity that feels right. Registration is currently open for free activities.</p>
          </div>
          <img className="activity-intro-photo" src={activitiesPhoto} alt="Students gathering in a circle outdoors" />
          <div className="activity-count"><strong>{registrations.filter((registration) => registration.status !== 'cancelled').length}</strong><span>your registrations</span></div>
        </section>

        <div className="activity-tools">
          <label className="search-field">
            <span className="sr-only">Search activities</span>
            <input aria-label="Search activities" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activities or places..." />
          </label>
          {!loading && !error && filters.length > 1 && (
            <div className="filter-list" aria-label="Filter activities">
              {filters.map((option) => {
                const label = typeLabels[option] || option;
                return <button key={option} type="button" className={`filter-chip${filter === option ? ' selected' : ''}`} onClick={() => setFilter(option)} aria-pressed={filter === option}>{label}</button>;
              })}
            </div>
          )}
        </div>

        <p className="preview-note">Upcoming published activities · Free registrations are saved to your account. Paid activity checkout isn’t available yet.</p>
        {registrationNotice.text && <p className={`form-message ${registrationNotice.type}`} role={registrationNotice.type === 'error' ? 'alert' : 'status'}>{registrationNotice.text}</p>}
        {loading ? <p className="muted-copy">Loading activities…</p> : error ? (
          <section className="empty-state panel" role="alert">
            <h2>Activities are unavailable</h2>
            <p>{error}</p>
            <button type="button" className="button button-secondary" onClick={() => { setError(''); setLoading(true); setRetryCount((count) => count + 1); }}>Try again</button>
          </section>
        ) : visibleActivities.length === 0 ? (
          <section className="empty-state panel">
            <h2>{activities.length ? 'No activities match that search' : 'No activities scheduled yet'}</h2>
            <p>{activities.length ? 'Try another word or clear your filters.' : 'Published upcoming activities will appear here.'}</p>
            {activities.length > 0 && <button type="button" className="button button-secondary" onClick={() => { setQuery(''); setFilter('All'); }}>Clear filters</button>}
          </section>
        ) : (
          <div className="activity-grid">
            {visibleActivities.map((activity) => {
              const registered = isRegistered(activity.id);
              const joining = joiningIds.includes(activity.id);
              const typeClass = activity.type.replace(/_/g, '-');
              return (
                <article className="activity-card panel" key={activity.id}>
                  <div className={`activity-art activity-art-${typeClass}`} aria-hidden="true"><Mountain size={34} strokeWidth={1.5} /></div>
                  <div className="activity-card-body">
                    <div className="activity-title-row">
                      <h2>{activity.title}</h2>
                      <span className={`price-tag${activity.fee_kes ? ' paid' : ''}`}>{activity.fee_kes ? `KES ${activity.fee_kes}` : 'Free'}</span>
                    </div>
                    <span className="category-label">{typeLabels[activity.type] || activity.type}</span>
                    <p className="activity-description">{activity.description || 'Details will be shared by the activity organiser.'}</p>
                    <div className="activity-meta"><CalendarDays size={16} /><span>{formatActivityDate(activity.starts_at)}</span></div>
                    <div className="activity-meta"><MapPin size={16} /><span>{activity.location_text}</span></div>
                    <div className="activity-meta"><Clock3 size={16} /><span>{activity.duration_minutes} minutes</span><Users size={16} /><span>Capacity {activity.capacity}</span></div>
                    <div className="activity-actions">
                      <button type="button" className={`button${registered ? ' button-secondary' : ''}`} disabled={activity.fee_kes > 0 || registered || joining} onClick={() => handleJoin(activity)}>
                        {activity.fee_kes > 0 ? 'Checkout unavailable' : registered ? 'Registered' : joining ? 'Joining…' : 'Join activity'} <ArrowRight size={16} />
                      </button>
                      <button type="button" className="text-button" onClick={() => setSelected(activity)}>More info</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {selected && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="activity-dialog-title">
            <button type="button" className="icon-button dialog-close" onClick={() => setSelected(null)} aria-label="Close activity details"><X size={20} /></button>
            <span className="category-label">{typeLabels[selected.type] || selected.type}</span>
            <h2 id="activity-dialog-title">{selected.title}</h2>
            <p>{selected.description || 'Details will be shared by the activity organiser.'}</p>
            <div className="dialog-details">
              <span><CalendarDays size={17} /> {formatActivityDate(selected.starts_at)}</span>
              <span><MapPin size={17} /> {selected.location_text}</span>
              <span><Clock3 size={17} /> {selected.duration_minutes} minutes</span>
              <span><Users size={17} /> Capacity {selected.capacity}</span>
            </div>
            <p className="dialog-note">{selected.fee_kes > 0 ? 'This activity requires payment. Registration will be available when checkout is connected.' : isRegistered(selected.id) ? 'You’re registered for this activity.' : 'Joining will reserve your place and save the registration to your account.'}</p>
            <button type="button" className={`button${isRegistered(selected.id) ? ' button-secondary' : ''}`} disabled={selected.fee_kes > 0 || isRegistered(selected.id) || joiningIds.includes(selected.id)} onClick={() => handleJoin(selected)}>
              {selected.fee_kes > 0 ? 'Paid checkout unavailable' : isRegistered(selected.id) ? 'Registered' : joiningIds.includes(selected.id) ? 'Joining…' : 'Join activity'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

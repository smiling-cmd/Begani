import { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { Clock3, Globe2, HeartHandshake, MapPin, MessageCircle, Phone, Search, ShieldCheck, Video, CalendarCheck } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Link, useNavigate } from 'react-router-dom';
import studentsPhoto from '../assets/physical .jpeg';
import './FindSupport.css';

const FILTERS = [
  { id: 'all', label: 'Everyone' },
  { id: 'school_counsellor', label: 'School counsellors' },
  { id: 'private', label: 'Private therapists' },
];

const FORMATS = {
  online: { label: 'Online', icon: Video },
  in_person: { label: 'In person', icon: MapPin },
  both: { label: 'Online or in person', icon: Globe2 },
};

const HUES = [152, 168, 24, 200, 340, 44];

function initials(name = '') {
  const parts = name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '·';
}

function hueFor(text = '') {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return HUES[hash % HUES.length];
}

function priceLabel(therapist) {
  if (therapist.type !== 'private') return 'Free for students';
  return therapist.fee_kes ? `KES ${Number(therapist.fee_kes).toLocaleString()} / session` : 'Fee on request';
}

export default function FindSupport() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [startingChatId, setStartingChatId] = useState(null);
  const [chatError, setChatError] = useState('');

  useEffect(() => {
    const fetchTherapists = async () => {
      try {
        const res = await api.get('/api/counsellors/');
        setTherapists(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch (requestError) {
        console.error('Failed to fetch therapists', requestError);
        setError('We couldn’t load counsellors right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchTherapists();
  }, [token, retryCount]);

  const counts = useMemo(() => ({
    all: therapists.length,
    school_counsellor: therapists.filter((t) => t.type === 'school_counsellor').length,
    private: therapists.filter((t) => t.type === 'private').length,
  }), [therapists]);

  const filteredTherapists = therapists.filter((therapist) => {
    const text = `${therapist.display_name || ''} ${therapist.category || ''} ${therapist.title || ''} ${therapist.bio || ''} ${therapist.languages || ''} ${therapist.approach || ''}`.toLowerCase();
    const matchesText = text.includes(search.trim().toLowerCase());
    const matchesType = typeFilter === 'all' || therapist.type === typeFilter;
    return matchesText && matchesType;
  });

  const handleStartChat = async (therapistId) => {
    if (startingChatId) return;
    setStartingChatId(therapistId);
    setChatError('');
    try {
      const { data } = await api.post('/api/messaging/start/', { therapist_id: therapistId });
      navigate(`/chat/${data.thread_id}`);
    } catch (requestError) {
      setChatError(requestError.response?.data?.error || 'Could not start chat. Please try again.');
    } finally {
      setStartingChatId(null);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <div className="fs-page">
          <header className="fs-hero">
            <img className="fs-hero-photo" src={studentsPhoto} alt="" />
            <div className="fs-hero-copy">
              <span className="fs-eyebrow"><HeartHandshake size={15} /> You’re not alone</span>
              <h1>Find support</h1>
              <p>Talk to a real person who gets student life. Start with a chat, and book only when you feel ready.</p>
              <label className="fs-search">
                <Search size={18} aria-hidden="true" />
                <span className="sr-only">Search counsellors</span>
                <input id="support-search" type="search" placeholder="Search name, topic or language" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
            </div>
            {user?.role === 'student' && (
              <Link className="fs-chats-link" to="/chats"><MessageCircle size={16} /> Your chats</Link>
            )}
          </header>

          <ol className="fs-steps" aria-label="How it works">
            <li><span className="fs-step-icon"><MessageCircle size={18} /></span><div><strong>Say hello</strong><span>Chat first. No pressure, no booking needed.</span></div></li>
            <li><span className="fs-step-icon"><CalendarCheck size={18} /></span><div><strong>Book when ready</strong><span>Pick a time that suits your timetable.</span></div></li>
            <li><span className="fs-step-icon"><ShieldCheck size={18} /></span><div><strong>Stay private</strong><span>Counsellors see your alias, not your name.</span></div></li>
          </ol>

          <div className="fs-filters" role="group" aria-label="Filter counsellors">
            {FILTERS.map((filter) => (
              <button key={filter.id} type="button" className={`fs-chip${typeFilter === filter.id ? ' is-on' : ''}`} aria-pressed={typeFilter === filter.id} onClick={() => setTypeFilter(filter.id)}>
                {filter.label}{!loading && !error && <span className="fs-chip-count">{counts[filter.id]}</span>}
              </button>
            ))}
          </div>

          {chatError && <p className="form-message error" role="alert">{chatError}</p>}

          {loading ? (
            <div className="fs-grid" aria-label="Loading counsellors">{[0, 1, 2].map((i) => <div key={i} className="fs-skeleton" />)}</div>
          ) : error ? (
            <div className="support-error-state" role="alert">
              <p>{error}</p>
              <button className="button" type="button" onClick={() => { setError(''); setLoading(true); setRetryCount((count) => count + 1); }}>Try again</button>
            </div>
          ) : filteredTherapists.length === 0 ? (
            <div className="panel support-empty-state">
              <p>{therapists.length ? 'No one matches that yet. Try another word or clear the filters.' : 'Counsellors will appear here once they have been approved.'}</p>
              {therapists.length > 0 && <button className="button button-secondary" type="button" onClick={() => { setSearch(''); setTypeFilter('all'); }}>Clear filters</button>}
            </div>
          ) : (
            <div className="fs-grid">
              {filteredTherapists.map((therapist) => {
                const format = FORMATS[therapist.format];
                const hue = hueFor(therapist.display_name);
                const isSchool = therapist.type !== 'private';
                return (
                  <article className="fs-card" key={therapist.id} style={{ '--hue': hue }}>
                    <div className="fs-card-head">
                      <div className="fs-avatar" aria-hidden="true">{initials(therapist.display_name)}</div>
                      <div className="fs-card-who">
                        <h3>{therapist.display_name}</h3>
                        <p>{therapist.title || (isSchool ? 'School counsellor' : 'Therapist')}</p>
                      </div>
                    </div>

                    <div className="fs-tags">
                      {therapist.category && <span className="fs-topic">{therapist.category}</span>}
                      <span className={`fs-price${isSchool ? ' is-free' : ''}`}>{priceLabel(therapist)}</span>
                    </div>
                    <p className="fs-bio">{therapist.bio || 'Experienced professional ready to listen and help.'}</p>

                    <ul className="fs-facts">
                      {format && <li><format.icon size={15} />{format.label}</li>}
                      {therapist.session_length_minutes && <li><Clock3 size={15} />{therapist.session_length_minutes} min sessions</li>}
                      {therapist.languages && <li><Globe2 size={15} />{therapist.languages}</li>}
                    </ul>

                    <div className="fs-actions">
                      <button className="button" type="button" onClick={() => handleStartChat(therapist.id)} disabled={Boolean(startingChatId)}>
                        <MessageCircle size={16} /> {startingChatId === therapist.id ? 'Starting…' : 'Chat first'}
                      </button>
                      <Link className="button button-secondary" to={`/therapist/${therapist.id}`}>View profile</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <aside className="fs-urgent" aria-label="Urgent help">
            <Phone size={20} aria-hidden="true" />
            <div>
              <strong>Need someone right now?</strong>
              <p>If you’re in crisis or worried about your safety, call the Kenya Red Cross free helpline on <a href="tel:1199">1199</a> or Befrienders Kenya on <a href="tel:+254722178177">+254 722 178 177</a>. You don’t have to wait for a booking.</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

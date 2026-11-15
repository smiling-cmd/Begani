import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { MessageCircle, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Link, useNavigate } from 'react-router-dom';
import studentsPhoto from '../assets/physical .jpeg';

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
        setTherapists(res.data);
      } catch (error) {
        console.error("Failed to fetch therapists", error);
        setError('We couldn’t load counsellors right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchTherapists();
  }, [token, retryCount]);

  const filteredTherapists = therapists.filter((therapist) => {
    const text = `${therapist.display_name || ''} ${therapist.category || ''} ${therapist.title || ''} ${therapist.bio || ''}`.toLowerCase();
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
    } catch (error) {
      setChatError(error.response?.data?.error || 'Could not start chat. Please try again.');
    } finally {
      setStartingChatId(null);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />

      {/* MAIN CONTENT */}
      <main className="page-content">
        
        <div className="support-heading support-page-heading">
          <div>
            <h1>Find Support</h1>
            <p>Chat with a counsellor first, then book when you feel ready. You're not alone.</p>
          </div>
          {user?.role === 'student' && (
            <Link className="button button-secondary support-chats-link" to="/chats">
              <MessageCircle size={16} /> Your chats
            </Link>
          )}
        </div>

        <section className="support-community-panel panel">
          <img src={studentsPhoto} alt="A student talking with a counsellor" />
          <div>
            <strong>You can start with one conversation.</strong>
            <p>Browse counsellors and choose someone you feel comfortable talking to.</p>
          </div>
        </section>

        {/* Search Bar */}
        <div className="search-field support-search-field">
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="support-search">Search counsellors</label>
          <input
            id="support-search"
            type="search"
            placeholder="Search by name or specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-list support-filter-list" role="group" aria-label="Filter counsellors">
          {[['all', 'All'], ['school_counsellor', 'School counsellors'], ['private', 'Private therapists']].map(([value, label]) => (
            <button
              key={value}
              className={`filter-chip${typeFilter === value ? ' selected' : ''}`}
              type="button"
              onClick={() => setTypeFilter(value)}
              aria-pressed={typeFilter === value}
            >
              {label}
            </button>
          ))}
        </div>

        {chatError && <p className="form-message error" role="alert">{chatError}</p>}

        {/* Therapist Grid */}
        {loading ? (
          <p className="muted-copy">Loading therapists...</p>
        ) : error ? (
          <div className="support-error-state" role="alert">
            <p>{error}</p>
            <button className="button" type="button" onClick={() => { setError(''); setLoading(true); setRetryCount((count) => count + 1); }}>Try again</button>
          </div>
        ) : filteredTherapists.length === 0 ? (
          <div className="panel support-empty-state">
            <p>No counsellors match those filters yet.</p>
            <button className="button button-secondary" type="button" onClick={() => { setSearch(''); setTypeFilter('all'); }}>Clear filters</button>
          </div>
        ) : (
          <div className="therapist-grid">
            {filteredTherapists.map((therapist) => (
              <article className="card support-counsellor-card" key={therapist.id}>
                <div className="support-counsellor-heading">
                  <div className="support-counsellor-avatar" aria-hidden="true">
                    👤
                  </div>
                  <div className="support-counsellor-copy">
                    <h3>{therapist.display_name}</h3>
                    <p>{therapist.title}</p>
                  </div>
                </div>
                
                <div className="support-counsellor-badges">
                  <span className="price-tag">
                    {therapist.type === 'private' ? `KES ${therapist.fee_kes}` : 'Free (School)'}
                  </span>
                  <span className="price-tag support-category-tag">
                    {therapist.category}
                  </span>
                </div>

                <p className="support-counsellor-bio">
                  {therapist.bio || "Experienced professional ready to help."}
                </p>

                <div className="support-counsellor-actions">
                  <Link className="button support-profile-button" to={`/therapist/${therapist.id}`}>View Profile</Link>
                  <button className="button button-secondary support-chat-button" type="button" onClick={() => handleStartChat(therapist.id)} disabled={Boolean(startingChatId)}>
                    {startingChatId === therapist.id ? 'Starting…' : 'Chat first'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

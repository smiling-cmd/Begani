import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { MessageCircle, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Link, useNavigate } from 'react-router-dom';

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
        const res = await axios.get('http://127.0.0.1:8000/api/counsellors/', {
          headers: { Authorization: `Bearer ${token}` }
        });
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
      const { data } = await axios.post('http://127.0.0.1:8000/api/messaging/start/', { therapist_id: therapistId }, { headers: { Authorization: `Bearer ${token}` } });
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
        
        <div className="support-heading" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ color: 'var(--heading)', fontSize: '2rem', margin: 0, fontWeight: '800' }}>Find Support</h1>
            <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0 0', fontWeight: '500' }}>Chat with a counsellor first, then book when you feel ready. You're not alone.</p>
          </div>
          {user?.role === 'student' && (
            <Link className="button button-secondary support-chats-link" to="/chats">
              <MessageCircle size={16} /> Your chats
            </Link>
          )}
        </div>

        {/* Search Bar */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem', boxShadow: 'var(--shadow)' }}>
          <Search size={20} color="var(--muted)" />
          <input 
            type="text" 
            placeholder="Search by name or specialty..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.95rem', padding: '0.5rem 0', color: 'var(--ink)', background: 'transparent' }}
          />
        </div>

        <div role="group" aria-label="Filter counsellors" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '-1rem', marginBottom: '1.5rem' }}>
          {[['all', 'All'], ['school_counsellor', 'School counsellors'], ['private', 'Private therapists']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setTypeFilter(value)} aria-pressed={typeFilter === value} style={{ border: typeFilter === value ? '1px solid var(--brand-green)' : '1px solid var(--line)', borderRadius: '20px', padding: '0.55rem 1rem', color: typeFilter === value ? 'white' : 'var(--heading)', background: typeFilter === value ? 'var(--brand-green)' : 'var(--card)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              {label}
            </button>
          ))}
        </div>

        {chatError && <p className="form-message error" role="alert">{chatError}</p>}

        {/* Therapist Grid */}
        {loading ? (
          <p>Loading therapists...</p>
        ) : error ? (
          <div role="alert" style={{ background: 'var(--terra-soft)', borderLeft: '4px solid var(--terra)', borderRadius: '12px', padding: '1.25rem', color: 'var(--ink)' }}>
            <p>{error}</p>
            <button type="button" onClick={() => { setError(''); setLoading(true); setRetryCount((count) => count + 1); }} style={{ border: 0, borderRadius: '8px', padding: '0.6rem 0.9rem', color: 'white', background: 'var(--brand-green)', cursor: 'pointer' }}>Try again</button>
          </div>
        ) : filteredTherapists.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', color: 'var(--muted)' }}>
            <p>No counsellors match those filters yet.</p>
            <button type="button" onClick={() => { setSearch(''); setTypeFilter('all'); }} style={{ border: '1px solid var(--brand-green)', borderRadius: '20px', padding: '0.55rem 1rem', color: 'var(--heading)', background: 'var(--card)', cursor: 'pointer' }}>Clear filters</button>
          </div>
        ) : (
          <div className="therapist-grid">
            {filteredTherapists.map((therapist) => (
              <div key={therapist.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1rem' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--surface-subtle)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem' }}>
                    👤
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--heading)', fontSize: '1.1rem' }}>{therapist.display_name}</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>{therapist.title}</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ background: 'var(--tint)', color: 'var(--green)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {therapist.type === 'private' ? `KES ${therapist.fee_kes}` : 'Free (School)'}
                  </span>
                  <span style={{ background: 'var(--surface-subtle)', color: 'var(--heading)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {therapist.category}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
                  {therapist.bio || "Experienced professional ready to help."}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link className="button support-profile-button" to={`/therapist/${therapist.id}`}>View Profile</Link>
                  <button type="button" onClick={() => handleStartChat(therapist.id)} disabled={Boolean(startingChatId)} style={{ flex: 1, padding: '0.6rem', background: 'var(--card)', color: 'var(--heading)', border: '1px solid var(--brand-green)', borderRadius: '8px', cursor: startingChatId ? 'wait' : 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>
                    {startingChatId === therapist.id ? 'Starting…' : 'Chat first'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

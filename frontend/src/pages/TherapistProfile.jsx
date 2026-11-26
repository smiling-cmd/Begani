import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import Sidebar from '../components/Sidebar';
import { ArrowLeft, Calendar } from 'lucide-react';
import onlineSessionPhoto from '../assets/online.jpeg';
import inPersonSessionPhoto from '../assets/physical .jpeg';
import { LoadingRegion, Skeleton, SkeletonCards, SkeletonLines } from '../components/Skeleton';

export default function TherapistProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    const fetchTherapist = async () => {
      try {
        const res = await api.get(`/api/counsellors/${id}/`);
        setTherapist(res.data);
      } catch (err) {
        console.error("API Error Details:", err.response?.data || err.message);
        setError("Could not load therapist profile.");
      } finally {
        setLoading(false);
      }
    };
    if (id && token) fetchTherapist();
  }, [id, token]);

  const handleBook = async (slotId) => {
    setBookingLoading(true);
    try {
      await api.post('/api/bookings/create/', { slot_id: slotId });
      alert("Booking requested! The therapist will confirm shortly.");
      navigate('/home');
    } catch (err) {
      // Keep the raw API detail out of the UI; show a readable message instead.
      const detail = err.response?.data;
      const message = typeof detail === 'string'
        ? detail
        : detail?.error || detail?.detail || 'Could not request this booking. Please try again.';
      setBookingError(message);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      
      <main className="page-content therapist-profile-content">
        
        <Link className="text-button therapist-back-link" to="/support">
          <ArrowLeft size={16} /> Back to Find Support
        </Link>

        {loading ? (
          <LoadingRegion label="Loading profile">
            <Skeleton circle width={96} height={96} />
            <Skeleton height={28} width="45%" style={{ marginTop: 16 }} />
            <SkeletonLines lines={4} className="sk-profile-lines" />
            <SkeletonCards count={3} height={90} />
          </LoadingRegion>
        ) : error ? (
          <p className="form-message error" role="alert">{error}</p>
        ) : (
          <>
            <section className="panel therapist-profile-header">
              <div className="therapist-profile-avatar" aria-hidden="true">
                👤
              </div>
              <div className="therapist-profile-intro">
                <h1>{therapist.display_name}</h1>
                <p>{therapist.title}</p>
                <div className="therapist-profile-badges">
                  <span className="therapist-profile-badge">
                    {therapist.type === 'private'
                      ? (therapist.fee_kes != null ? `KES ${therapist.fee_kes} / session` : 'Fee shared before booking')
                      : 'Free (School)'}
                  </span>
                  <span className="therapist-profile-badge secondary">
                    {therapist.session_length_minutes} mins
                  </span>
                </div>
                <div className="therapist-format-list" aria-label="Available session formats">
                  {(therapist.format === 'online' || therapist.format === 'both') && (
                    <div className="therapist-format-card">
                      <img src={onlineSessionPhoto} alt="A person taking notes during an online counselling session" />
                      <span>Online sessions</span>
                    </div>
                  )}
                  {(therapist.format === 'in_person' || therapist.format === 'both') && (
                    <div className="therapist-format-card">
                      <img src={inPersonSessionPhoto} alt="A student talking with a counsellor in person" />
                      <span>In-person sessions</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="therapist-profile-grid">
              <section className="panel therapist-info-card">
                <h2>About Me</h2>
                <p>{therapist.bio || "This therapist has not written a bio yet."}</p>
                
                <h2>Approach</h2>
                <p>{therapist.approach || "Information not provided."}</p>
              </section>

              <section className="panel therapist-info-card">
                <h2 className="therapist-booking-title">
                  <Calendar size={20} /> Book a Session
                </h2>
                <p className="muted-copy therapist-booking-copy">Select an available time below.</p>
                {bookingError && <p className="form-message error" role="alert">{bookingError}</p>}
                
                <div className="therapist-slot-list">
                  {!therapist.slots || therapist.slots.length === 0 ? (
                    <p className="muted-copy">No available slots right now.</p>
                  ) : (
                    therapist.slots.map((slot) => (
                      <div key={slot.id} className="therapist-slot">
                        <div>
                          <p className="therapist-slot-date">
                            {new Date(slot.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="therapist-slot-time">
                            {new Date(slot.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleBook(slot.id)}
                          disabled={bookingLoading}
                          className="button"
                        >
                          {bookingLoading ? '...' : 'Book'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

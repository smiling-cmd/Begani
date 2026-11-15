import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { ArrowLeft, Calendar } from 'lucide-react';

export default function TherapistProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTherapist = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/api/counsellors/${id}/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
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
      await axios.post('http://127.0.0.1:8000/api/bookings/create/', 
        { slot_id: slotId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Booking requested! The therapist will confirm shortly.");
      navigate('/home');
    } catch (err) {
      // THIS WILL SHOW THE EXACT DJANGO ERROR
      const exactError = JSON.stringify(err.response?.data || err.message);
      alert("BOOKING ERROR: " + exactError);
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
          <p>Loading profile...</p>
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
                    {therapist.type === 'private' ? `KES ${therapist.fee_kes} / session` : 'Free (School)'}
                  </span>
                  <span className="therapist-profile-badge secondary">
                    {therapist.session_length_minutes} mins
                  </span>
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
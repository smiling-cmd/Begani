import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { MessageCircle, Heart, BookOpen, Mountain, Sun, Phone } from 'lucide-react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import tuaImage from '../assets/TUA-transparent.png';
import PriorityRequestDialog from '../components/PriorityRequestDialog';

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moodNotice, setMoodNotice] = useState('');
  const [moodError, setMoodError] = useState('');
  const [urgentHelpOpen, setUrgentHelpOpen] = useState(false);

  const moodData = [
    { label: 'Very Low', score: 2, emoji: '😞', range: '1-2' },
    { label: 'Low', score: 4, emoji: '🙁', range: '3-4' },
    { label: 'Okay', score: 5, emoji: '😐', range: '5-6' },
    { label: 'Good', score: 8, emoji: '🙂', range: '7-8' },
    { label: 'Great', score: 10, emoji: '😁', range: '9-10' },
  ];

  const handleUpdateMood = async () => {
    if (!selectedMood || isSubmitting) return;
    setIsSubmitting(true);
    setMoodNotice('');
    setMoodError('');
    try {
      await axios.post(
        'http://127.0.0.1:8000/api/wellbeing/moods/',
        { score: selectedMood.score, source: 'home' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMoodNotice(`Check-in saved. You’re feeling ${selectedMood.label.toLowerCase()}.`);
      setSelectedMood(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setMoodError(typeof detail === 'string' ? detail : 'Could not save your mood. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Home is the student dashboard; therapist accounts use TherapistDashboard.
  return (
    <div className="app-shell">
      <Sidebar />

      <main className="page-content home-page-content">
        
        <div className="home-page-header">
          <div>
            <h1 className="home-greeting-title">
              {getTimeGreeting()}, {user?.full_name?.trim() || user?.alias || 'friend'}!
            </h1>
            <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0 0', fontWeight: '500' }}>Take a moment. You matter.</p>
          </div>
        </div>

        <div className="home-dashboard-grid">
          
          {/* Mood Check-in Card */}
          <section className="home-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--heading)', marginBottom: '1rem', marginTop: 0, fontSize: '1.1rem' }}>
              <Sun size={20} color="var(--terra)" /> Daily Mood Check-in
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1.5rem', fontWeight: '500' }}>How are you feeling today?</p>
            
            <div className="home-mood-options">
              {moodData.map((mood) => {
                const isSelected = selectedMood?.label === mood.label;
                return (
                  <button
                    className={`home-mood-option${isSelected ? ' selected' : ''}`}
                    type="button"
                    key={mood.label}
                    onClick={() => { setSelectedMood(mood); setMoodError(''); setMoodNotice(''); }}
                    aria-pressed={isSelected}
                  >
                    <span className="home-mood-face">{mood.emoji}</span>
                    <span className="home-mood-label">{mood.label}</span>
                    <span className="home-mood-range">{mood.range}</span>
                  </button>
                );
              })}
            </div>

            {moodError && <p className="home-error-message" role="alert">{moodError}</p>}
            {moodNotice && <p role="status" style={{ color: 'var(--green)', fontSize: '0.85rem', margin: '-0.5rem 0 1rem' }}>{moodNotice}</p>}
            <div className="home-mood-actions">
                <button className="home-mood-submit" type="button" onClick={handleUpdateMood} disabled={!selectedMood || isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Update Mood →'}
                </button>
                <Link className="home-mood-history" to="/wellbeing">View Mood History</Link>
                <button className="home-mood-skip" type="button" onClick={() => { setSelectedMood(null); setMoodError(''); setMoodNotice('Check-in skipped. You can log a mood whenever you’re ready.'); }}>Skip</button>
            </div>
          </section>

          {/* Quick Access */}
          <section className="home-card">
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--heading)', marginBottom: '1rem', marginTop: 0, fontSize: '1.1rem' }}>
              <Sun size={20} color="var(--terra)" /> Quick Access
            </h3>
            <div className="home-quick-access-list">
                <QuickAccessItem icon={<BookOpen size={18} />} title="My Space" subtitle="Track your mood and goals" to="/wellbeing" />
                <QuickAccessItem icon={<Mountain size={18} />} title="Activities" subtitle="Join an activity" to="/activities" />
                <QuickAccessItem icon={<Heart size={18} />} title="Find Support" subtitle="Get help" to="/support" />
            </div>
          </section>

          <section className="home-tua-card">
            <div className="home-tua-copy">
              <h3>Want to chat with TUA?</h3>
              <p>A friendly companion is here whenever you need a listening ear.</p>
              <Link className="home-tua-cta" to="/tua">
                <MessageCircle size={16} /> Chat with TUA
              </Link>
            </div>
            <div className="home-tua-image-frame">
              <img src={tuaImage} alt="TUA, your friendly support companion" />
            </div>
          </section>

        </div>

        {/* Bottom Banner */}
        <div className="home-urgent-banner">
            <div className="home-urgent-copy">
                <div className="home-urgent-icon">!</div>
                <div>
                    <h4 className="home-urgent-title">Need Urgent Help?</h4>
                    <p className="home-urgent-message">If you're having thoughts of self-harm or suicide, please reach out immediately.</p>
                </div>
            </div>
            <div className="home-urgent-actions">
                 <div className="home-emergency-call-links">
                   <a className="home-emergency-link" href="tel:999"><Phone size={16} /> Call 999</a>
                   <a className="home-emergency-link" href="tel:112">Call 112</a>
                 </div>
                 <button className="home-emergency-link home-urgent-chat-button" type="button" onClick={() => setUrgentHelpOpen(true)}>
                    <MessageCircle size={16} /> Chat with a Counsellor
                 </button>
                 <Link className="home-urgent-cta" to="/support">Get Help Now →</Link>
            </div>
        </div>

      </main>
      {urgentHelpOpen && <PriorityRequestDialog
        token={token}
        hasPhone={Boolean(user?.phone)}
        source="find_support"
        onClose={() => setUrgentHelpOpen(false)}
        onCreated={(request) => navigate(`/chat/${request.thread_id}`, { state: { priorityRequestSent: true } })}
      />}
    </div>
  );
}

const QuickAccessItem = ({ icon, title, subtitle, to }) => (
    <Link className="home-quick-access-item" to={to}>
      <div className="home-quick-access-icon">{icon}</div>
      <div className="home-quick-access-copy">
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--heading)' }}>{title}</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>{subtitle}</p>
      </div>
    </Link>
);

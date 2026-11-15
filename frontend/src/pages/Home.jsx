import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { MessageCircle, Mountain, Sun, Zap, Phone, Calendar, Leaf } from 'lucide-react';
import api from '../api';
import { Link, useNavigate } from 'react-router-dom';
import tuaImage from '../assets/TUA-transparent.png';
import PriorityRequestDialog from '../components/PriorityRequestDialog';
import MoodWheel from '../components/MoodWheel';
import studentsPhoto from '../assets/students2.jpeg';

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const BOOKING_STATUS_LABELS = {
  requested: 'Awaiting confirmation',
  confirmed: 'Confirmed',
};

function asList(data) {
  return Array.isArray(data) ? data : data?.results ?? [];
}

function formatWhen(value) {
  return new Date(value).toLocaleString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Counts consecutive days with a check-in. A streak that ended yesterday still
// counts, so it does not show as zero before the student has logged today.
function getMoodStreak(checkins) {
  const days = new Set(checkins.map((checkin) => dayKey(new Date(checkin.checked_in_at))));
  const cursor = new Date();
  const loggedToday = days.has(dayKey(cursor));
  if (!loggedToday) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { streak, loggedToday };
}

function getStreakSubtitle({ streak, loggedToday }) {
  if (streak >= 2) return `${streak} days in a row`;
  if (streak === 1) return loggedToday ? 'Logged today' : 'Logged yesterday. Log today’s mood';
  return 'Log your first mood today';
}

export default function Home() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moodNotice, setMoodNotice] = useState('');
  const [moodError, setMoodError] = useState('');
  const [urgentHelpOpen, setUrgentHelpOpen] = useState(false);
  const [glance, setGlance] = useState({
    loading: true,
    session: null,
    activity: null,
    mood: { streak: 0, loggedToday: false },
    failed: { session: false, activity: false, mood: false },
  });
  const [glanceVersion, setGlanceVersion] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    Promise.allSettled([
      api.get('/api/bookings/my/'),
      api.get('/api/activities/registrations/'),
      api.get('/api/wellbeing/moods/'),
    ]).then(([bookings, registrations, moods]) => {
      if (cancelled) return;
      const now = Date.now();

      const session = bookings.status === 'fulfilled'
        ? asList(bookings.value.data)
            .filter((booking) => new Date(booking.starts_at).getTime() >= now)
            .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0] ?? null
        : null;

      const activity = registrations.status === 'fulfilled'
        ? asList(registrations.value.data)
            .filter((item) => item.status !== 'cancelled' && item.activity_starts_at
              && new Date(item.activity_starts_at).getTime() >= now)
            .sort((a, b) => new Date(a.activity_starts_at) - new Date(b.activity_starts_at))[0] ?? null
        : null;

      setGlance({
        loading: false,
        session,
        activity,
        mood: moods.status === 'fulfilled'
          ? getMoodStreak(asList(moods.value.data))
          : { streak: 0, loggedToday: false },
        failed: {
          session: bookings.status === 'rejected',
          activity: registrations.status === 'rejected',
          mood: moods.status === 'rejected',
        },
      });
    });

    return () => { cancelled = true; };
  }, [token, glanceVersion]);

  const handleUpdateMood = async () => {
    if (!selectedMood || isSubmitting) return;
    setIsSubmitting(true);
    setMoodNotice('');
    setMoodError('');
    try {
      await api.post('/api/wellbeing/moods/', {
        score: selectedMood.score,
        source: 'home',
      });
      setMoodNotice(`Check-in saved. You're feeling ${selectedMood.label.toLowerCase()}.`);
      setSelectedMood(null);
      setGlanceVersion((version) => version + 1);
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

        <section className="home-community-card">
          <div className="home-community-copy">
            <header className="home-page-header">
              <div>
                <h1 className="home-greeting-title">
                  {getTimeGreeting()}, {user?.full_name?.trim() || user?.alias || 'friend'}!
                </h1>
                <p className="home-page-tagline">Take a moment. You matter.</p>
              </div>
            </header>
            <span className="home-community-eyebrow">Campus community</span>
            <h2>Connection can start small.</h2>
            <p>Find activities and people that help campus feel a little more like yours.</p>
            <Link to="/activities">Explore activities <Mountain size={15} /></Link>
          </div>
          <img src={studentsPhoto} alt="Students gathering together outdoors on campus" />
        </section>

        <div className="home-dashboard-grid">

          {/* Mood Check-in Card */}
          <section className="card home-card">
            <h3 className="home-card-title">
              <Sun size={20} aria-hidden="true" /> Daily Mood Check-in
            </h3>
            <p className="home-mood-prompt">How are you feeling today?</p>

            <div className="home-mood-wheel">
              <MoodWheel
                selected={selectedMood}
                onChange={(mood) => { setSelectedMood(mood); setMoodError(''); setMoodNotice(''); }}
                size={240}
              />
            </div>

            {moodError && <p className="home-error-message" role="alert">{moodError}</p>}
            {moodNotice && <p className="home-mood-notice" role="status">{moodNotice}</p>}
            <div className="home-mood-actions">
                <button className="home-mood-submit" type="button" onClick={handleUpdateMood} disabled={!selectedMood || isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Log mood →'}
                </button>
                <Link className="home-mood-history" to="/wellbeing">View Mood History</Link>
                <button className="home-mood-skip" type="button" onClick={() => { setSelectedMood(null); setMoodError(''); setMoodNotice('Check-in skipped. You can log a mood whenever you’re ready.'); }}>Skip</button>
            </div>
          </section>

          {/* Quick Access */}
          <section className="card home-card">
             <h3 className="home-card-title">
              <Zap size={20} aria-hidden="true" /> At a Glance
            </h3>
            <div className="home-quick-access-list">
                <QuickAccessItem
                  icon={<Calendar size={18} />}
                  title="Next session"
                  subtitle={
                    glance.loading ? 'Loading…'
                      : glance.failed.session ? 'Could not load right now'
                      : glance.session
                        ? `${formatWhen(glance.session.starts_at)} · ${BOOKING_STATUS_LABELS[glance.session.status] ?? glance.session.status}`
                        : 'None booked. Find support'
                  }
                  to="/support"
                />
                <QuickAccessItem
                  icon={<Mountain size={18} />}
                  title="Next activity"
                  subtitle={
                    glance.loading ? 'Loading…'
                      : glance.failed.activity ? 'Could not load right now'
                      : glance.activity
                        ? `${glance.activity.activity_title} · ${formatWhen(glance.activity.activity_starts_at)}`
                        : 'Nothing registered yet. Join an activity'
                  }
                  to="/activities"
                />
                <QuickAccessItem
                  icon={<Leaf size={18} />}
                  title="Mood check-ins"
                  subtitle={
                    glance.loading ? 'Loading…'
                      : glance.failed.mood ? 'Could not load right now'
                      : getStreakSubtitle(glance.mood)
                  }
                  to="/wellbeing"
                />
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
                   <a className="home-emergency-link" href="tel:999" aria-label="Call national emergency number 999"><Phone size={16} /> Emergency 999</a>
                   <a className="home-emergency-link" href="tel:112" aria-label="Call national emergency number 112">Emergency 112</a>
                 </div>
                 <button className="home-emergency-link home-urgent-chat-button" type="button" onClick={() => setUrgentHelpOpen(true)}>
                    <MessageCircle size={16} /> Chat with a Counsellor
                 </button>
                 <Link className="home-urgent-cta" to="/support">Get Help Now →</Link>
            </div>
        </div>

      </main>
      {urgentHelpOpen && <PriorityRequestDialog
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
              <p className="home-quick-access-title">{title}</p>
              <p className="home-quick-access-subtitle">{subtitle}</p>
      </div>
    </Link>
);

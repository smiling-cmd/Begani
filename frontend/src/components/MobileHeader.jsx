import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { Bell, Moon, Sun, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import ThemeContext from '../context/ThemeContextValue';
import logoOnLight from '../assets/logo1.png';
import logoLight from '../assets/logo-light.png';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export default function MobileHeader() {
  const { user, token } = useContext(AuthContext);
  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme || 'light';
  const toggleTheme = themeContext?.toggleTheme || (() => {});
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadNotifications = async () => {
      try {
        const { data } = await api.get('/api/notifications/', {
          signal: controller.signal,
        });
        setNotifications(data);
        setError('');
      } catch {
        if (!controller.signal.aborted) setError('Could not load notifications.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [token]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const profileName = user?.full_name || user?.alias || user?.email || 'Profile';
  const profileInitial = profileName.charAt(0).toUpperCase();
  const homePath = user?.role === 'admin'
    ? '/admin-dashboard'
    : user?.role === 'therapist'
      ? '/therapist-dashboard'
      : '/home';

  const handleNotificationClick = async (notification) => {
    if (!notification.read_at) {
      setError('');
      try {
        const { data } = await api.patch(`/api/notifications/${notification.id}/read/`, {});
        setNotifications((current) => current.map((item) => item.id === data.id ? data : item));
      } catch {
        setError('Could not update this notification. Please try again.');
        return;
      }
    }
    setOpen(false);
    if (notification.type === 'new_message') {
      navigate(user?.role === 'therapist' ? '/therapist-chats' : '/chats');
    } else if (notification.type === 'priority_request' && user?.role === 'therapist') {
      navigate('/therapist-dashboard');
    }
  };

  const currentLogo = theme === 'dark' ? logoLight : logoOnLight;

  return (
    <header className="mobile-topbar">
      <Link className="mobile-topbar-brand" to={homePath} aria-label="Begani home">
        <img className="mobile-topbar-logo" src={currentLogo} alt="Begani" />
      </Link>
      <div className="mobile-topbar-actions">
        <button
          className="mobile-icon-button"
          type="button"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="mobile-notifications">
          <button
            className="mobile-icon-button"
            type="button"
            aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            aria-expanded={open}
            aria-controls="mobile-notification-panel"
            onClick={() => setOpen((isOpen) => !isOpen)}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="mobile-notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {open && (
            <section className="mobile-notification-panel" id="mobile-notification-panel" aria-label="Notifications">
              <div className="mobile-notification-heading">
                <h2>Notifications</h2>
                <button className="icon-button" type="button" aria-label="Close notifications" onClick={() => setOpen(false)}>
                  <X size={17} />
                </button>
              </div>
              {error && <p className="form-message error" role="alert">{error}</p>}
              {loading ? (
                <p className="mobile-notification-empty" role="status">Loading notifications…</p>
              ) : notifications.length === 0 ? (
                <p className="mobile-notification-empty">You're all caught up.</p>
              ) : (
                <div className="mobile-notification-list">
                  {notifications.map((notification) => (
                    <button
                      className={`mobile-notification-item${notification.read_at ? '' : ' unread'}`}
                      key={notification.id}
                      type="button"
                      onClick={() => void handleNotificationClick(notification)}
                    >
                      <span className="mobile-notification-dot" aria-hidden="true" />
                      <span className="mobile-notification-copy">
                        <span>{notification.body}</span>
                        <time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <Link className="mobile-profile-button" to="/settings" aria-label="Open profile and settings" title={profileName}>
          {profileInitial}
        </Link>
      </div>
    </header>
  );
}
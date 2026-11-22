import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart,
  BookOpen,
  Calendar,
  CalendarDays,
  DollarSign,
  Heart,
  Home,
  Leaf,
  LogOut,
  MessageSquare,
  Mountain,
  MoreHorizontal,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import './MobileBottomNav.css';

const CHAT_PATHS = ['/chats', '/therapist-chats'];

const isChatPath = (pathname) => CHAT_PATHS.includes(pathname) || pathname.startsWith('/chat/');

// Every role gets at most four tabs plus "More", so the bar always fits a
// phone and nothing has to scroll sideways. Anything that does not earn a
// tab lives in the More sheet.
const NAV_BY_ROLE = {
  student: {
    tabs: [
      { label: 'Home', icon: Home, to: '/home' },
      { label: 'TUA', icon: Sparkles, to: '/tua' },
      { label: 'Messages', icon: MessageSquare, to: '/chats', match: isChatPath },
      { label: 'Wellbeing', icon: Leaf, to: '/wellbeing' },
    ],
    more: [
      { label: 'Find support', icon: Heart, to: '/support' },
      { label: 'Calendar', icon: CalendarDays, to: '/calendar' },
      { label: 'Activities', icon: Mountain, to: '/activities' },
      { label: 'Resources', icon: BookOpen, to: '/resources' },
      { label: 'Settings', icon: Settings, to: '/settings' },
    ],
  },
  therapist: {
    tabs: [
      { label: 'Bookings', icon: Calendar, to: '/therapist-dashboard' },
      { label: 'Chats', icon: MessageSquare, to: '/therapist-chats', match: isChatPath },
      { label: 'Insights', icon: BarChart, to: '/insights' },
      { label: 'Earnings', icon: DollarSign, to: '/earnings' },
    ],
    more: [{ label: 'Settings', icon: Settings, to: '/settings' }],
  },
  admin: {
    tabs: [
      { label: 'Portal', icon: Home, to: '/admin-dashboard' },
      { label: 'Resources', icon: BookOpen, to: '/admin-resources' },
      { label: 'Activities', icon: Mountain, to: '/admin-activities' },
    ],
    more: [{ label: 'Settings', icon: Settings, to: '/settings' }],
  },
};

const isHere = (item, pathname) => (item.match ? item.match(pathname) : pathname === item.to);

export default function MobileBottomNav() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const moreButtonRef = useRef(null);
  const sheetRef = useRef(null);
  // The sheet is "open" only for the page it was opened on, so any navigation
  // (a link, the back button) closes it without an effect.
  const [openAt, setOpenAt] = useState(null);
  const open = openAt === location.key;

  const { tabs, more } = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.student;
  const moreActive = more.some((item) => isHere(item, location.pathname));

  const closeSheet = (returnFocus = true) => {
    setOpenAt(null);
    if (returnFocus) moreButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    sheetRef.current?.querySelector('a, button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenAt(null);
        moreButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleLogout = () => {
    setOpenAt(null);
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && (
        <>
          <div className="mobile-more-backdrop" onClick={() => closeSheet()} aria-hidden="true" />
          <section
            className="mobile-more-sheet"
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            ref={sheetRef}
          >
            <div className="mobile-more-header">
              <h2>More</h2>
              <button type="button" className="mobile-more-close" aria-label="Close menu" onClick={() => closeSheet()}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <ul className="mobile-more-list">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isHere(item, location.pathname);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`mobile-more-item${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="mobile-more-icon"><Icon size={19} aria-hidden="true" /></span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button type="button" className="mobile-more-item is-logout" onClick={handleLogout}>
                  <span className="mobile-more-icon"><LogOut size={19} aria-hidden="true" /></span>
                  Log out
                </button>
              </li>
            </ul>
          </section>
        </>
      )}

      <div className="mobile-bottom-nav-wrapper">
        <nav className="mobile-bottom-nav" aria-label="Main">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = isHere(item, location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mobile-nav-item${active && !open ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="mobile-nav-icon"><Icon size={21} aria-hidden="true" /></span>
                <span className="mobile-nav-label">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            ref={moreButtonRef}
            className={`mobile-nav-item${open || moreActive ? ' is-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="mobile-more-sheet"
            onClick={() => (open ? closeSheet(false) : setOpenAt(location.key))}
          >
            <span className="mobile-nav-icon"><MoreHorizontal size={21} aria-hidden="true" /></span>
            <span className="mobile-nav-label">More</span>
          </button>
        </nav>
      </div>
    </>
  );
}

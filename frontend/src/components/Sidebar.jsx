import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Heart,
  Home as HomeIcon,
  Leaf,
  LogOut,
  MessageCircle,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import beganiLogo from '../assets/logo-light.png';
import tuaImage from '../assets/TUA.png';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import './Sidebar.css';

const COLLAPSE_KEY = 'begani-sidebar-collapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const isTherapist = user?.role === 'therapist';
  const isAdmin = user?.role === 'admin';
  const isChatRoute =
    location.pathname === '/chats' ||
    location.pathname === '/therapist-chats' ||
    location.pathname.startsWith('/chat/');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* The rail still collapses; it just will not be remembered. */
      }
      return next;
    });
  };

  const homePath = isAdmin
    ? '/admin-dashboard'
    : isTherapist
      ? '/therapist-dashboard'
      : '/home';

  return (
    <>
      <MobileHeader />
      <aside className={`sidebar sidebar-desktop${collapsed ? ' is-collapsed' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Link to={homePath} className="sidebar-mark" aria-label="Begani Home" title="Begani Home">
            <Leaf size={20} aria-hidden="true" />
          </Link>
          <Link to={homePath} className="brand-logo-link" aria-label="Begani Home">
            <img
              className="brand-logo-image"
              src={beganiLogo}
              alt="Begani — Share the load."
              width="245"
              height="101"
            />
          </Link>
          <button
            type="button"
            className="sidebar-theme-toggle sidebar-collapse-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

      <nav className="sidebar-nav" id="sidebar-nav" aria-label="Pages">
        {isAdmin ? (
          <>
            <NavItem icon={<HomeIcon size={18} />} label="Admin Portal" to="/admin-dashboard" active={location.pathname === '/admin-dashboard'} />
            <NavItem icon={<BookOpen size={18} />} label="Manage Resources" to="/admin-resources" active={location.pathname === '/admin-resources'} />
            <NavItem icon={<Mountain size={18} />} label="Manage Activities" to="/admin-activities" active={location.pathname === '/admin-activities'} />
            <button className="sidebar-link mobile-only-nav-item" type="button" onClick={handleLogout}>
              <span className="nav-item-icon"><LogOut size={18} /></span>
              <span className="nav-item-label">Log out</span>
            </button>
          </>
        ) : isTherapist ? (
          <>
            <NavItem icon={<Calendar size={18} />} label="Appointments" to="/therapist-dashboard" active={location.pathname === '/therapist-dashboard'} />
            <NavItem icon={<MessageCircle size={18} />} label="Chats" to="/therapist-chats" active={isChatRoute} />
            <NavItem icon={<BarChart size={18} />} label="Insights" to="/insights" active={location.pathname === '/insights'} />
            {user?.therapist_type !== 'school_counsellor' && (
              <NavItem icon={<DollarSign size={18} />} label="Earnings" to="/earnings" active={location.pathname === '/earnings'} />
            )}
            <NavItem icon={<Settings size={18} />} label="Settings" to="/settings" active={location.pathname === '/settings'} />
            <button className="sidebar-link mobile-only-nav-item" type="button" onClick={handleLogout}>
              <span className="nav-item-icon"><LogOut size={18} /></span>
              <span className="nav-item-label">Log out</span>
            </button>
          </>
        ) : (
          <>
            <NavGroup label="Main" />
            <NavItem icon={<HomeIcon size={18} />} label="Home" to="/home" active={location.pathname === '/home'} />
            <NavItem icon={<img className="tua-nav-icon" src={tuaImage} alt="" />} label="TUA Assistant" to="/tua" active={location.pathname === '/tua'} />
            <NavItem icon={<MessageCircle size={18} />} label="Messages" to="/chats" active={isChatRoute} />
            <NavItem icon={<CalendarCheck size={18} />} label="Appointments" to="/appointments" active={location.pathname === '/appointments'} />
            <NavItem icon={<CalendarDays size={18} />} label="Calendar" to="/calendar" active={location.pathname === '/calendar'} />
            <NavGroup label="Wellbeing" />
            <NavItem icon={<Heart size={18} color={location.pathname === '/support' ? 'white' : '#E07A5F'} />} label="Find Support" to="/support" active={location.pathname === '/support'} />
            <NavItem icon={<Leaf size={18} />} label="Wellbeing" to="/wellbeing" active={location.pathname === '/wellbeing'} />
            <NavItem icon={<Mountain size={18} />} label="Activities" to="/activities" active={location.pathname === '/activities'} />
            <NavItem icon={<BookOpen size={18} />} label="Resources" to="/resources" active={location.pathname === '/resources'} />
            <NavGroup label="Preferences" />
            <NavItem icon={<Settings size={18} />} label="Settings" to="/settings" active={location.pathname === '/settings'} />
            <button className="sidebar-link mobile-only-nav-item" type="button" onClick={handleLogout}>
              <span className="nav-item-icon"><LogOut size={18} /></span>
              <span className="nav-item-label">Log out</span>
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <Link
          to="/settings"
          className="sidebar-user"
          title={user?.alias ? 'Counsellors see you by this alias, not your name.' : 'Settings'}
        >
          <div className="user-avatar" aria-hidden="true"><UserRound size={16} /></div>
          <div className="user-copy">
            <strong>{user?.alias || user?.full_name || user?.email || 'User'}</strong>
            <small>{user?.alias ? `${user.role} · alias` : user?.role}</small>
          </div>
        </Link>
        <button className="logout-button" type="button" title="Log out" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
    <button
      type="button"
      className="page-theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
    <MobileBottomNav />
  </>
  );
}

function NavGroup({ label }) {
  return <span className="sidebar-group-label" aria-hidden="true"><span>{label}</span></span>;
}

function NavItem({ icon, label, active, to }) {
  return (
    <Link
      className={`sidebar-link${active ? ' is-active' : ''}`}
      to={to}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </Link>
  );
}
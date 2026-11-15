import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart,
  BookOpen,
  Calendar,
  CalendarDays,
  DollarSign,
  Heart,
  Home as HomeIcon,
  Leaf,
  LogOut,
  MessageCircle,
  Mountain,
  Settings,
  UserRound,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import MobileHeader from './MobileHeader';
import beganiLogo from '../assets/logo-light.png';
import tuaImage from '../assets/TUA.png';

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const isTherapist = user?.role === 'therapist';
  const isAdmin = user?.role === 'admin';
  const isChatRoute = location.pathname === '/chats'
    || location.pathname === '/therapist-chats'
    || location.pathname.startsWith('/chat/');

  return (
    <>
      <MobileHeader />
      <aside className="sidebar">
        <div className="brand-lockup">
          <img className="brand-logo-image" src={beganiLogo} alt="Begani — Share the load." />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {isAdmin ? (
            <>
              <NavItem icon={<HomeIcon size={20} />} label="Admin Portal" to="/admin-dashboard" active={location.pathname === '/admin-dashboard'} />
              <NavItem icon={<BookOpen size={20} />} label="Manage Resources" to="/admin-resources" active={location.pathname === '/admin-resources'} />
              <NavItem icon={<Mountain size={20} />} label="Manage Activities" to="/admin-activities" active={location.pathname === '/admin-activities'} />
            </>
          ) : isTherapist ? (
            <>
              <NavItem icon={<Calendar size={20} />} label="Appointments" to="/therapist-dashboard" active={location.pathname === '/therapist-dashboard'} />
              <NavItem icon={<MessageCircle size={20} />} label="Chats" to="/therapist-chats" active={isChatRoute} />
              <NavItem icon={<BarChart size={20} />} label="Insights" to="/insights" active={location.pathname === '/insights'} />
              <NavItem icon={<DollarSign size={20} />} label="Earnings" to="/earnings" active={location.pathname === '/earnings'} />
              <NavItem icon={<Settings size={20} />} label="Settings" to="/settings" active={location.pathname === '/settings'} mobileHidden />
            </>
          ) : (
            <>
              <NavItem icon={<HomeIcon size={20} />} label="Home" to="/home" active={location.pathname === '/home'} />
              <NavItem icon={<img className="tua-nav-icon" src={tuaImage} alt="" />} label="TUA Assistant" to="/tua" active={location.pathname === '/tua'} />
              <NavItem icon={<Heart size={20} color={location.pathname === '/support' ? 'white' : '#E07A5F'} />} label="Find Support" to="/support" active={location.pathname === '/support'} />
              <NavItem icon={<CalendarDays size={20} />} label="Calendar" to="/calendar" active={location.pathname === '/calendar'} />
              <NavItem icon={<MessageCircle size={20} />} label="Messages" to="/chats" active={isChatRoute} />
              <NavItem icon={<Leaf size={20} />} label="Wellbeing" to="/wellbeing" active={location.pathname === '/wellbeing'} />
              <NavItem icon={<BookOpen size={20} />} label="Resources" to="/resources" active={location.pathname === '/resources'} />
              <NavItem icon={<Mountain size={20} />} label="Activities" to="/activities" active={location.pathname === '/activities'} />
              <NavItem icon={<Settings size={20} />} label="Settings" to="/settings" active={location.pathname === '/settings'} mobileHidden />
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div
            className="sidebar-user"
            title={user?.alias ? 'Counsellors see you by this alias, not your name.' : undefined}
          >
            <div className="user-avatar" aria-hidden="true"><UserRound size={18} /></div>
            <div className="user-copy">
              <strong>{user?.alias || user?.full_name || user?.email || 'User'}</strong>
              <small>{user?.alias ? `${user.role} · alias` : user?.role}</small>
            </div>
          </div>
          <button className="logout-button" type="button" onClick={logout} aria-label="Log out" title="Log out">
            <LogOut size={17} />
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function NavItem({ icon, label, active, to, mobileHidden = false }) {
  return (
    <Link
      className={`sidebar-link${active ? ' is-active' : ''}${mobileHidden ? ' mobile-hidden' : ''}`}
      to={to}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

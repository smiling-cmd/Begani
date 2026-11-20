import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Heart, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import beganiLogo from '../assets/logo1.png';
import sidePhoto from '../assets/students.jpeg';
import './AuthLayout.css';

/* Shared shell for Login and Register:
   Two-column responsive layout with background.jpg.
   Left side: Either heroText overlay (Sign Up) or community photo card (Login).
   Right side: Frosted glass authentication card. */
export default function AuthLayout({
  switchText,
  switchLabel,
  switchTo,
  align = 'center',
  showPhoto = false,
  heroText = null,
  label,
  children,
}) {
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Link to="/login" className="auth-brand" aria-label="Begani">
          <img src={beganiLogo} alt="Begani — Share the load." width="220" height="90" />
        </Link>
        <div className="auth-switch">
          <span className="auth-switch-text">{switchText}</span>
          <Link to={switchTo} className="auth-switch-pill">
            {switchLabel} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <main className={`auth-stage auth-stage--${align}`}>
        {heroText && (
          <aside className="auth-hero-text" aria-label="Begani mission">
            <h1 className="auth-hero-title">{heroText.title}</h1>
            <p className="auth-hero-desc">{heroText.desc}</p>
            {heroText.accent !== false && <span className="auth-hero-accent" aria-hidden="true" />}
          </aside>
        )}

        {showPhoto && !heroText && (
          <aside className="auth-photo-card" aria-label="Student community">
            <div className="auth-photo-media">
              <img
                src={sidePhoto}
                alt="Smiling university students sharing experiences on campus"
                width="736"
                height="736"
                fetchPriority="high"
              />
              <div className="auth-photo-gradient" />
            </div>
            <div className="auth-photo-content">
              <h2 className="auth-photo-title">Share the load with someone who listens.</h2>
              <p className="auth-photo-desc">
                A safe space to express yourself, find support and take things one step at a time.
              </p>
              <div className="auth-photo-badges">
                <div className="auth-badge-pill">
                  <ShieldCheck size={18} className="auth-badge-icon" />
                  <span>Talk Freely and Safely</span>
                </div>
                <div className="auth-badge-pill">
                  <Users size={18} className="auth-badge-icon" />
                  <span>Get Support from Peers</span>
                </div>
                <div className="auth-badge-pill">
                  <Heart size={18} className="auth-badge-icon" />
                  <span>Prioritize Your Wellbeing</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        <section className="auth-card" aria-label={label}>{children}</section>
      </main>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg className="auth-google-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4v-5.2H5.9a20 20 0 0 0 0 17.8l6.9-5.2Z" />
      <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.9 15.1l6.9 5.2c1.6-4.7 6-8.2 11.2-8.2Z" />
    </svg>
  );
}

export function AuthDivider({ text = 'or' }) {
  return (
    <div className="auth-divider" aria-hidden="true">
      <span />
      <b>{text}</b>
      <span />
    </div>
  );
}

/* Form field with optional label above, icon on left, trailing button on right */
export function AuthField({ label, id, icon, trailing, ...inputProps }) {
  return (
    <div className="auth-field-group">
      {label && <label htmlFor={id} className="auth-field-label">{label}</label>}
      <div className="auth-field">
        {icon && <span className="auth-field-icon" aria-hidden="true">{icon}</span>}
        <input id={id} {...inputProps} />
        {trailing}
      </div>
    </div>
  );
}

/* Password input with show/hide toggle and visible label */
export function PasswordField({
  label,
  id,
  hideLabel = 'Hide password',
  showLabel = 'Show password',
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field-group">
      {label && <label htmlFor={id} className="auth-field-label">{label}</label>}
      <div className="auth-field">
        <span className="auth-field-icon" aria-hidden="true"><LockKeyhole size={18} /></span>
        <input id={id} type={visible ? 'text' : 'password'} {...inputProps} />
        <button
          className="auth-eye"
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

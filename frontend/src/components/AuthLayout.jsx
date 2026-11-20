import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import beganiLogo from '../assets/logo1.png';
import './AuthLayout.css';

/* Shared shell for Login and Register: blurred campus photo, logo top-left,
   "switch page" link top-right, and a frosted glass card.
   align="right" puts the card on the right on wide screens (Login). */
export default function AuthLayout({ switchText, switchLabel, switchTo, align = 'center', label, children }) {
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Link to="/login" className="auth-brand" aria-label="Begani">
          <img src={beganiLogo} alt="Begani — Share the load." width="245" height="101" />
        </Link>
        <p className="auth-switch">
          {switchText} <Link to={switchTo}>{switchLabel} →</Link>
        </p>
      </header>

      <main className={`auth-stage auth-stage--${align}`}>
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

export function AuthDivider() {
  return (
    <div className="auth-divider" aria-hidden="true"><span /><b>or</b><span /></div>
  );
}

/* One input row: icon on the left, optional trailing slot (show/hide eye, "@"). */
export function AuthField({ icon, trailing, ...inputProps }) {
  return (
    <div className="auth-field">
      <span className="auth-field-icon" aria-hidden="true">{icon}</span>
      <input {...inputProps} />
      {trailing}
    </div>
  );
}

/* Password input with its own show/hide button. */
export function PasswordField({ hideLabel = 'Hide password', showLabel = 'Show password', ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <AuthField
      icon={<LockKeyhole size={19} />}
      type={visible ? 'text' : 'password'}
      trailing={(
        <button
          className="auth-eye"
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
      {...inputProps}
    />
  );
}

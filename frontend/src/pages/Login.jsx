import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { AtSign, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import beganiLogo from '../assets/logo-light.png';
import happyStudents from '../assets/happy students.jpg';
import './Register.css';

function GoogleMark() {
  return (
    <svg className="begani-google-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4v-5.2H5.9a20 20 0 0 0 0 17.8l6.9-5.2Z" />
      <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.9 15.1l6.9 5.2c1.6-4.7 6-8.2 11.2-8.2Z" />
    </svg>
  );
}

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const { data: tokens } = await axios.post(`${API_BASE_URL}/api/token/`, {
        email,
        password,
      });
      const { data: profile } = await axios.get(`${API_BASE_URL}/api/auth/me/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      login(tokens.access, profile);

      if (profile.role === 'admin') {
        navigate('/admin-dashboard', { replace: true });
      } else if (profile.role === 'therapist') {
        navigate('/therapist-dashboard', { replace: true });
      } else if (!profile.full_name?.trim()) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    } catch {
      setError('Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="begani-auth-wrapper">
      <header className="begani-auth-top-bar">
        <Link to="/login" className="begani-auth-brand" aria-label="Begani Home">
          <img src={beganiLogo} alt="Begani — Share the load." className="begani-auth-logo" />
        </Link>
        <div className="begani-auth-top-link">
          Don’t have an account? <Link to="/register">Sign up</Link>
        </div>
      </header>

      <main className="begani-auth-container" aria-label="Sign in to Begani">
        {/* Left Block: Happy students image inside glass panel */}
        <section className="begani-auth-glass-block begani-auth-image-block" aria-label="Campus community">
          <div className="begani-auth-image-frame">
            <img
              src={happyStudents}
              alt="Happy university students together on campus"
              className="begani-auth-happy-img"
            />
            <div className="begani-auth-image-overlay">
              <span className="begani-auth-image-tag">Welcome Back</span>
              <h2>Share the load with someone who listens.</h2>
              <p>Your confidential university mental health & wellbeing support portal.</p>
            </div>
          </div>
        </section>

        {/* Right Block: Sign in form inside matching glass panel (Velora/Begani Soft Glass) */}
        <section className="begani-auth-glass-block begani-auth-form-block" aria-label="Sign in form">
          <div className="begani-card-brand-lockup">
            <img src={beganiLogo} alt="Begani — Share the load." className="begani-card-brand-logo" />
          </div>

          <header className="begani-form-header">
            <h1>Welcome back</h1>
            <p>Sign in to continue to your space.</p>
          </header>

          <button
            className="begani-auth-google-btn"
            type="button"
            onClick={() => setNotice('Google sign-in is not connected yet. Please use your email below.')}
          >
            <GoogleMark />
            <span>Sign in with Google</span>
          </button>

          <div className="begani-auth-divider" aria-hidden="true">
            <span></span>
            <b>Or</b>
            <span></span>
          </div>

          <form className="begani-auth-form" onSubmit={handleSubmit}>
            <div className="begani-input-wrapper">
              <AtSign size={19} className="begani-field-icon" aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(''); }}
                placeholder="Email Address"
                aria-label="Email address"
                required
              />
            </div>

            <div className="begani-input-wrapper">
              <LockKeyhole size={19} className="begani-field-icon" aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(''); }}
                placeholder="Password"
                aria-label="Password"
                required
              />
              <button
                className="begani-eye-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {notice && <p className="begani-auth-notice" role="status">{notice}</p>}
            {error && <p className="begani-auth-error" role="alert">{error}</p>}

            <button className="begani-auth-submit-btn" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              <span>{isSubmitting ? 'Signing in…' : 'Log in →'}</span>
              {isSubmitting && <LoaderCircle className="begani-spin" size={20} aria-hidden="true" />}
            </button>
          </form>

          <footer className="begani-form-footer">
            <p>Don't have an account? <Link to="/register" className="begani-footer-link">Sign up</Link></p>
          </footer>
        </section>
      </main>
    </div>
  );
}

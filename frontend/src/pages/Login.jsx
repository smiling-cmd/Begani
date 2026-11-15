import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { ArrowRight, AtSign, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import beganiLogo from '../assets/logo1.png';
import campusBackground from '../assets/Sunlit Campus Clock Tower Landscape.png';
import campusStudentArt from '../assets/Serene Campus Study Day.png';
import './Register.css';
import './Login.css';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
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
    <main
      className="begani-signup-page begani-login-page"
      style={{
        '--begani-campus-image': `url("${campusStudentArt}")`,
        '--signup-campus-background': `url("${campusBackground}")`,
      }}
    >
      <section className="begani-signup-art" aria-label="Begani campus illustration">
        <img className="begani-signup-logo" src={beganiLogo} alt="Begani — Share the load." />
        <img
          className="begani-signup-girl"
          src={campusStudentArt}
          alt="A student relaxing on campus with her cat"
        />
      </section>

      <section className="begani-signup-panel" aria-label="Sign in to Begani">
        <img className="begani-signup-mobile-logo" src={beganiLogo} alt="Begani — Share the load." />
        <div className="begani-signup-glass begani-login-glass">
          <header className="begani-signup-heading">
            <h1>Welcome back!</h1>
            <p>Sign in to continue.</p>
          </header>

          <form className="begani-login-form" onSubmit={handleSubmit}>
            <label className="begani-signup-field">
              <span className="begani-signup-input-icon"><AtSign size={20} /></span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(''); }}
                placeholder="Email address"
                aria-label="Email address"
                required
              />
            </label>

            <label className="begani-signup-field">
              <span className="begani-signup-input-icon"><LockKeyhole size={21} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(''); }}
                placeholder="Password"
                aria-label="Password"
                required
              />
              <button
                className="begani-signup-eye"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </label>

            {error && <p className="begani-signup-error" role="alert">{error}</p>}

            <button className="begani-signup-submit" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Signing in…' : 'Log in'}</span>
              <ArrowRight size={22} strokeWidth={2.5} />
            </button>
          </form>

          <p className="begani-signup-login">
            Don’t have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
      </section>

      <svg className="begani-signup-clip-defs" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="begani-signup-curve" clipPathUnits="objectBoundingBox">
            <path d="M .13 0 C .02 .16 .20 .31 .10 .50 C .01 .69 .19 .85 .12 1 L 1 1 L 1 0 Z" />
          </clipPath>
        </defs>
      </svg>
    </main>
  );
}

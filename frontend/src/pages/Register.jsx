import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import beganiLogo from '../assets/logo1.png';
import campusBackground from '../assets/Sunlit Campus Clock Tower Landscape.png';
import campusStudentArt from '../assets/student signup.jpeg';
import './Register.css';

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const messages = Object.values(data)
      .flat()
      .filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'We could not create your account. Please try again.';
}

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

export default function Register() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  // Sign-up is student-only. Therapist accounts come from the application and
  // admin-approval flow, so there is no role picker and no ?role= override.

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const name = formData.name.trim();
    const email = formData.email.trim();
    if (!name || !email || !formData.password || !confirmPassword) {
      setError('Please complete all fields before continuing.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!email.toLowerCase().endsWith('.ac.ke')) {
      setError('Student accounts must use your university email, ending in .ac.ke.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (formData.password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsSubmitting(true);
    let accountCreated = false;

    try {
      await axios.post('http://127.0.0.1:8000/api/auth/register/', {
        email,
        password: formData.password,
        phone: '',
      });
      accountCreated = true;

      const { data: tokens } = await axios.post('http://127.0.0.1:8000/api/token/', {
        email,
        password: formData.password,
      });

      const { data: profile } = await api.patch(
        '/api/auth/me/update/',
        { full_name: name },
        { headers: { Authorization: `Bearer ${tokens.access}` } },
      );

      login(tokens.access, profile);
      navigate(profile.role === 'therapist' ? '/therapist-dashboard' : '/onboarding', { replace: true });
    } catch (requestError) {
      setError(accountCreated
        ? 'Your account was created, but profile setup could not be completed. Please log in to continue.'
        : getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="begani-signup-page"
      style={{ '--signup-campus-background': `url("${campusBackground}")` }}
    >
      <section className="begani-signup-art" aria-label="Begani campus illustration">
        <img
          className="begani-signup-girl"
          src={campusStudentArt}
          alt="A student studying outdoors"
        />
        <img className="begani-signup-logo" src={beganiLogo} alt="Begani — Share the load." />
      </section>

      <section className="begani-signup-panel" aria-label="Create your Begani account">
        <img className="begani-signup-mobile-logo" src={beganiLogo} alt="Begani — Share the load." />
        <div className="begani-signup-glass">
          <header className="begani-signup-heading">
            <h1>Sign up</h1>
            <p>Use your university email to get started.</p>
          </header>

          <div className="begani-signup-social-row">
            <button
              className="begani-google-button"
              type="button"
              onClick={() => setNotice('Google sign-up is not connected yet. Please use your university email below.')}
            >
              <GoogleMark />
              <span>Sign up with Google</span>
            </button>
            <span className="begani-signup-social-divider" aria-hidden="true" />
            <span className="begani-signup-social-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.2V13h2.8v8z" /></svg>
            </span>
            <span className="begani-signup-social-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H9.08l4.713 6.231zm-1.16 17.52h1.833L7.36 4.126H5.393z" /></svg>
            </span>
          </div>

          <div className="begani-signup-divider" aria-hidden="true">
            <span />
            <b>Or</b>
            <span />
          </div>

          <form className="begani-signup-form" onSubmit={handleSubmit}>
            <label className="begani-signup-field">
              <span className="begani-signup-input-icon"><UserRound size={24} strokeWidth={1.75} /></span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Name"
                aria-label="Name"
                maxLength={150}
                required
              />
            </label>

            <label className="begani-signup-field">
              <span className="begani-signup-input-icon"><Mail size={24} strokeWidth={1.75} /></span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address"
                aria-label="Email Address"
                required
              />
            </label>

            <label className="begani-signup-field">
              <span className="begani-signup-input-icon"><LockKeyhole size={24} strokeWidth={1.75} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                aria-label="Password"
                minLength={8}
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

            <label className="begani-signup-field">
              <span className="begani-signup-input-icon"><LockKeyhole size={24} strokeWidth={1.75} /></span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError('');
                }}
                placeholder="Confirm Password"
                aria-label="Confirm Password"
                minLength={8}
                required
              />
              <button
                className="begani-signup-eye"
                type="button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </label>

            <label className="begani-signup-terms">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>I agree to the <u>Terms of Service</u> and <u>Privacy Policy</u></span>
            </label>

            {notice && <p className="begani-signup-notice" role="status">{notice}</p>}
            {error && <p className="begani-signup-error" role="alert">{error}</p>}

            <button className="begani-signup-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              <span>{isSubmitting ? 'Creating account…' : 'Create account'}</span>
              {isSubmitting
                ? <LoaderCircle className="begani-signup-spinner" size={22} aria-hidden="true" />
                : <ArrowRight size={26} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          </form>

          <p className="begani-signup-login">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
        <p className="begani-signup-login-mobile">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

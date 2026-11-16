import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api, { API_BASE_URL } from '../api';
import beganiLogo from '../assets/logo-light.png';
import happyStudents from '../assets/happy students.jpg';
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
      await axios.post(`${API_BASE_URL}/api/auth/register/`, {
        email,
        password: formData.password,
        phone: '',
      });
      accountCreated = true;

      const { data: tokens } = await axios.post(`${API_BASE_URL}/api/token/`, {
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
    <div className="begani-auth-wrapper">
      <header className="begani-auth-top-bar">
        <Link to="/register" className="begani-auth-brand" aria-label="Begani Home">
          <img src={beganiLogo} alt="Begani — Share the load." className="begani-auth-logo" />
        </Link>
        <div className="begani-auth-top-link">
          Already a member? <Link to="/login">Log in</Link>
        </div>
      </header>

      <main className="begani-auth-container" aria-label="Create your space">
        {/* Left Block: Happy students image inside glass panel */}
        <section className="begani-auth-glass-block begani-auth-image-block" aria-label="Campus community">
          <div className="begani-auth-image-frame">
            <img
              src={happyStudents}
              alt="Happy university students together on campus"
              className="begani-auth-happy-img"
            />
            <div className="begani-auth-image-overlay">
              <span className="begani-auth-image-tag">Community & Care</span>
              <h2>A safe space designed for students.</h2>
              <p>Connect with licensed counsellors, explore wellbeing practices, and share the load at your own pace.</p>
            </div>
          </div>
        </section>

        {/* Right Block: Registration form inside matching glass panel (Velora/Begani Soft Glass) */}
        <section className="begani-auth-glass-block begani-auth-form-block" aria-label="Register form">
          <div className="begani-card-brand-lockup">
            <img src={beganiLogo} alt="Begani — Share the load." className="begani-card-brand-logo" />
          </div>

          <header className="begani-form-header">
            <h1>Sign up</h1>
            <p>Use your university email to get started.</p>
          </header>

          <button
            className="begani-auth-google-btn"
            type="button"
            onClick={() => setNotice('Google sign-up is not connected yet. Please use your university email below.')}
          >
            <GoogleMark />
            <span>Sign up with Google</span>
          </button>

          <div className="begani-auth-divider" aria-hidden="true">
            <span></span>
            <b>Or</b>
            <span></span>
          </div>

          <form className="begani-auth-form" onSubmit={handleSubmit}>
            <div className="begani-input-wrapper">
              <UserRound size={19} className="begani-field-icon" aria-hidden="true" />
              <input
                id="reg-name"
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
            </div>

            <div className="begani-input-wrapper">
              <Mail size={19} className="begani-field-icon" aria-hidden="true" />
              <input
                id="reg-email"
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
            </div>

            <div className="begani-input-wrapper">
              <LockKeyhole size={19} className="begani-field-icon" aria-hidden="true" />
              <input
                id="reg-password"
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
                className="begani-eye-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <div className="begani-input-wrapper">
              <LockKeyhole size={19} className="begani-field-icon" aria-hidden="true" />
              <input
                id="reg-confirm"
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
                className="begani-eye-toggle"
                type="button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <label className="begani-auth-terms">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>I agree to the <u>Terms of Service</u> and <u>Privacy Policy</u></span>
            </label>

            {notice && <p className="begani-auth-notice" role="status">{notice}</p>}
            {error && <p className="begani-auth-error" role="alert">{error}</p>}

            <button className="begani-auth-submit-btn" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              <span>{isSubmitting ? 'Creating account…' : 'Create account →'}</span>
              {isSubmitting && <LoaderCircle className="begani-spin" size={20} aria-hidden="true" />}
            </button>
          </form>

          <footer className="begani-form-footer">
            <p>Already have an account? <Link to="/login" className="begani-footer-link">Log in</Link></p>
          </footer>
        </section>
      </main>
    </div>
  );
}

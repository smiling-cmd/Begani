import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LoaderCircle, Mail, UserRound } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api, { API_BASE_URL } from '../api';
import AuthLayout, { AuthDivider, AuthField, GoogleMark, PasswordField } from '../components/AuthLayout';

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

export default function Register() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
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
    <AuthLayout
      align="center"
      heroText={{
        title: 'A little support goes a long way.',
        desc: 'Join BEGANI and be part of a community that cares about your wellbeing.',
        accent: true,
      }}
      label="Create your Begani account"
      switchText="Already have an account?"
      switchLabel="Sign in"
      switchTo="/login"
    >
      <div className="auth-header-block auth-header-block--center">
        <h1 className="auth-card-title">Create an Account</h1>
        <p className="auth-card-subtitle">Let's get you started.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField
          label="Full Name *"
          icon={<UserRound size={18} />}
          id="reg-name"
          type="text"
          name="name"
          autoComplete="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter your full name"
          aria-label="Full Name"
          maxLength={150}
          required
        />

        <AuthField
          label="University Email *"
          icon={<Mail size={18} />}
          id="reg-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@students.jkuat.ac.ke"
          aria-label="University Email"
          required
        />

        <PasswordField
          label="Password *"
          id="reg-password"
          name="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Create a password"
          aria-label="Password"
          minLength={8}
          required
        />

        <PasswordField
          label="Confirm Password *"
          id="reg-confirm"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
          placeholder="Confirm your password"
          aria-label="Confirm Password"
          hideLabel="Hide confirm password"
          showLabel="Show confirm password"
          minLength={8}
          required
        />

        {notice && <p className="auth-message auth-message--notice" role="status">{notice}</p>}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

        <button className="auth-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? (
            <>
              <span>Creating account…</span>
              <LoaderCircle className="auth-spin" size={19} aria-hidden="true" />
            </>
          ) : (
            <span>Create My Account →</span>
          )}
        </button>
      </form>

      <AuthDivider text="or" />

      <button
        className="auth-google auth-google--secondary"
        type="button"
        onClick={() => setNotice('Google sign-up is not connected yet. Please use your university email above.')}
      >
        <GoogleMark />
        <span>Continue with Google</span>
      </button>

      <p className="auth-foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

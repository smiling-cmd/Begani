import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AtSign, LoaderCircle, Mail, UserRound } from 'lucide-react';
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    <AuthLayout
      label="Create your Begani account"
      switchText="Already have an account?"
      switchLabel="Sign in"
      switchTo="/login"
    >
      <h1>Create your account</h1>
      <p className="auth-lede">Join BEGANI and take a step towards better mental wellbeing.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField
          icon={<UserRound size={19} />}
          id="reg-name"
          type="text"
          name="name"
          autoComplete="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Full name"
          aria-label="Full name"
          maxLength={150}
          required
        />
        <AuthField
          icon={<Mail size={19} />}
          trailing={<AtSign size={18} className="auth-field-trailing" aria-hidden="true" />}
          id="reg-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Student email address (.ac.ke)"
          aria-label="Student email address"
          required
        />
        <PasswordField
          id="reg-password"
          name="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password (8+ characters)"
          aria-label="Password"
          minLength={8}
          required
        />
        <PasswordField
          id="reg-confirm"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
          placeholder="Confirm password"
          aria-label="Confirm password"
          hideLabel="Hide confirm password"
          showLabel="Show confirm password"
          minLength={8}
          required
        />

        <label className="auth-terms">
          <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
          <span>I agree to the <b>Terms of Service</b> and <b>Privacy Policy</b></span>
        </label>

        {notice && <p className="auth-message auth-message--notice" role="status">{notice}</p>}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

        <button className="auth-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          <span>{isSubmitting ? 'Creating account…' : 'Sign up →'}</span>
          {isSubmitting && <LoaderCircle className="auth-spin" size={20} aria-hidden="true" />}
        </button>
      </form>

      <AuthDivider />

      <button
        className="auth-google"
        type="button"
        onClick={() => setNotice('Google sign-up is not connected yet. Please use your university email above.')}
      >
        <GoogleMark />
        <span>Continue with Google</span>
      </button>

      <p className="auth-foot">Already have an account?<Link to="/login">Sign in →</Link></p>
    </AuthLayout>
  );
}

import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { LoaderCircle, Mail } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import AuthLayout, { AuthDivider, AuthField, GoogleMark, PasswordField } from '../components/AuthLayout';

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <AuthLayout
      align="right"
      label="Sign in to Begani"
      switchText="Don’t have an account?"
      switchLabel="Sign up"
      switchTo="/register"
    >
      <h1>Welcome back</h1>
      <p className="auth-lede">Sign in to continue to your account.</p>

      <button
        className="auth-google auth-google--primary"
        type="button"
        onClick={() => setNotice('Google sign-in is not connected yet. Please use your email below.')}
      >
        <GoogleMark />
        <span>Sign in with Google</span>
      </button>

      <AuthDivider />

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField
          icon={<Mail size={19} />}
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setError(''); }}
          placeholder="Email address"
          aria-label="Email address"
          required
        />
        <PasswordField
          id="login-password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(''); }}
          placeholder="Password"
          aria-label="Password"
          required
        />

        {notice && <p className="auth-message auth-message--notice" role="status">{notice}</p>}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

        <button className="auth-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          <span>{isSubmitting ? 'Signing in…' : 'Log in →'}</span>
          {isSubmitting && <LoaderCircle className="auth-spin" size={20} aria-hidden="true" />}
        </button>
      </form>

      <p className="auth-foot">Don’t have an account?<Link to="/register">Sign up</Link></p>
    </AuthLayout>
  );
}

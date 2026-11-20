import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { ArrowRight, LoaderCircle, Mail } from 'lucide-react';
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
      align="center"
      showPhoto={true}
      label="Sign in to Begani"
      switchText="Don't have an account?"
      switchLabel="Sign up"
      switchTo="/register"
    >
      <div className="auth-header-block">
        <h1 className="auth-card-title">Welcome back</h1>
        <p className="auth-lede">
          <span className="auth-accent-pill" aria-hidden="true" />
          Sign in to continue to your account.
        </p>
      </div>

      <button
        className="auth-google auth-google--secondary"
        type="button"
        onClick={() => setNotice('Google sign-in is not connected yet. Please use your email below.')}
      >
        <GoogleMark />
        <span>Sign in with Google</span>
      </button>

      <AuthDivider text="or" />

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField
          label="Email address"
          icon={<Mail size={18} />}
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setError(''); }}
          placeholder="you@example.com"
          aria-label="Email address"
          required
        />

        <PasswordField
          label="Password"
          id="login-password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(''); }}
          placeholder="Enter your password"
          aria-label="Password"
          required
        />

        <div className="auth-forgot-row">
          <Link to="/forgot-password" className="auth-forgot-link">Forgot password?</Link>
        </div>

        {notice && <p className="auth-message auth-message--notice" role="status">{notice}</p>}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

        <button className="auth-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? (
            <>
              <span>Signing in…</span>
              <LoaderCircle className="auth-spin" size={19} aria-hidden="true" />
            </>
          ) : (
            <>
              <ArrowRight size={18} aria-hidden="true" />
              <span>Log in</span>
            </>
          )}
        </button>
      </form>

      <p className="auth-foot">
        New to BEGANI? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

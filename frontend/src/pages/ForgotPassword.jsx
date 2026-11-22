import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, LoaderCircle, Mail, MailCheck } from 'lucide-react';
import { API_BASE_URL } from '../api';
import AuthLayout, { AuthField } from '../components/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setError('Enter the email address you signed up with.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/password-reset/`, { email: address });
      setSentTo(address);
    } catch (requestError) {
      setError(
        requestError.response?.status === 429
          ? 'Too many requests. Please wait a little while and try again.'
          : 'We could not send the email right now. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      align="center"
      label="Reset your Begani password"
      switchText="Remembered it?"
      switchLabel="Sign in"
      switchTo="/login"
    >
      <div className="auth-header-block">
        <h1 className="auth-card-title">Forgot your password?</h1>
        <p className="auth-lede">
          <span className="auth-accent-pill" aria-hidden="true" />
          We will email you a link to choose a new one.
        </p>
      </div>

      {sentTo ? (
        <div className="auth-success" role="status">
          <MailCheck className="auth-success-icon" size={26} aria-hidden="true" />
          <h2>Check your email</h2>
          <p>
            If an account exists for <b>{sentTo}</b>, a reset link is on its way. It stays valid for 1 hour.
            Look in your spam folder if you do not see it.
          </p>
          <button className="auth-secondary-link" type="button" onClick={() => setSentTo('')}>
            Use a different email
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <AuthField
            label="Email address"
            icon={<Mail size={18} />}
            id="forgot-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError(''); }}
            placeholder="you@example.com"
            required
          />

          {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <>
                <span>Sending…</span>
                <LoaderCircle className="auth-spin" size={19} aria-hidden="true" />
              </>
            ) : (
              <>
                <ArrowRight size={18} aria-hidden="true" />
                <span>Send reset link</span>
              </>
            )}
          </button>
        </form>
      )}

      <p className="auth-foot">
        Back to <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

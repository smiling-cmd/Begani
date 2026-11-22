import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, CircleCheck, LoaderCircle } from 'lucide-react';
import { API_BASE_URL } from '../api';
import AuthLayout, { PasswordField } from '../components/AuthLayout';

function passwordMessage(data) {
  if (Array.isArray(data?.password)) return data.password.join(' ');
  return '';
}

export default function ResetPassword() {
  const { uid, token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [linkProblem, setLinkProblem] = useState(false);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Your passwords do not match.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/password-reset/confirm/`, { uid, token, password });
      setDone(true);
    } catch (requestError) {
      const data = requestError.response?.data;
      const specific = passwordMessage(data);
      if (specific) setError(specific);
      else if (requestError.response?.status === 429) setError('Too many attempts. Please wait a little while and try again.');
      else if (requestError.response?.status === 400) setLinkProblem(true);
      else setError('We could not update your password right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  let content;
  if (done) {
    content = (
      <div className="auth-success" role="status">
        <CircleCheck className="auth-success-icon" size={26} aria-hidden="true" />
        <h2>Password updated</h2>
        <p>You can now sign in with your new password.</p>
        <Link className="auth-submit" to="/login">
          <ArrowRight size={18} aria-hidden="true" />
          <span>Go to sign in</span>
        </Link>
      </div>
    );
  } else if (linkProblem) {
    content = (
      <div className="auth-success" role="alert">
        <h2>This link has expired</h2>
        <p>Reset links work once and last 1 hour. Request a new one and we will send it straight away.</p>
        <Link className="auth-submit" to="/forgot-password">
          <span>Request a new link</span>
        </Link>
      </div>
    );
  } else {
    content = (
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <PasswordField
          label="New password"
          id="reset-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(''); }}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
        <PasswordField
          label="Confirm new password"
          id="reset-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => { setConfirm(event.target.value); setError(''); }}
          placeholder="Type it again"
          hideLabel="Hide confirm password"
          showLabel="Show confirm password"
          minLength={8}
          required
        />

        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}

        <button className="auth-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? (
            <>
              <span>Saving…</span>
              <LoaderCircle className="auth-spin" size={19} aria-hidden="true" />
            </>
          ) : (
            <>
              <ArrowRight size={18} aria-hidden="true" />
              <span>Save new password</span>
            </>
          )}
        </button>
      </form>
    );
  }

  return (
    <AuthLayout
      align="center"
      label="Choose a new Begani password"
      switchText="Remembered it?"
      switchLabel="Sign in"
      switchTo="/login"
    >
      <div className="auth-header-block">
        <h1 className="auth-card-title">Choose a new password</h1>
        <p className="auth-lede">
          <span className="auth-accent-pill" aria-hidden="true" />
          Pick something you have not used before.
        </p>
      </div>
      {content}
    </AuthLayout>
  );
}

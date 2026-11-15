import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

function getErrorMessage(error) {
  const data = error.response?.data;
  const detail = data?.full_name || data?.alias || data?.detail;
  if (Array.isArray(detail)) return detail.join(' ');
  if (typeof detail === 'string') return detail;
  return 'Could not save your name. Please try again.';
}

export default function OnboardingName() {
  const { user, token, login } = useContext(AuthContext);
  const [name, setName] = useState(user?.full_name || '');
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const fullName = name.trim();
    const publicAlias = alias.trim();
    if (!fullName || !publicAlias || saving) return;

    setSaving(true);
    setError('');
    try {
      const { data } = await axios.patch(
        'http://127.0.0.1:8000/api/auth/me/update/',
        { full_name: fullName, alias: publicAlias },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      login(token, data);
      navigate('/welcome', { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card">
        <span className="eyebrow">Welcome to Begani</span>
        <h1 className="onboarding-title">One last step!</h1>
        <p className="onboarding-copy">Set your name and the public alias counsellors will see.</p>
        <form className="onboarding-form" onSubmit={handleSubmit}>
          <label htmlFor="full-name">Your full name</label>
          <input
            id="full-name"
            type="text"
            value={name}
            onChange={(event) => { setName(event.target.value); setError(''); }}
            placeholder="Your full name"
            autoComplete="name"
            maxLength={150}
            required
          />
          <label htmlFor="public-alias">Public alias</label>
          <input
            id="public-alias"
            type="text"
            value={alias}
            onChange={(event) => { setAlias(event.target.value); setError(''); }}
            placeholder="Choose an alias"
            autoComplete="username"
            maxLength={50}
            pattern="[A-Za-z0-9][A-Za-z0-9_.-]*"
            title="Use letters, numbers, periods, underscores, or hyphens; start with a letter or number."
            required
          />
          {error && <p className="form-message error" role="alert">{error}</p>}
          <button className="button" type="submit" disabled={saving || !name.trim() || !alias.trim()}>
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  );
}

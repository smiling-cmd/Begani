import { useContext, useState } from 'react';
import api from '../api';
import { LogOut, Moon, Save, ShieldCheck, Sun, UserRound } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import ThemeContext from '../context/ThemeContextValue';

function getErrorMessage(error) {
  const detail = error.response?.data?.detail || error.response?.data;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.join(' ');
  if (detail && typeof detail === 'object') {
    const messages = Object.values(detail).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Could not update your profile. Please try again.';
}

export default function Settings() {
  const { user, token, login, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [phoneDraft, setPhoneDraft] = useState(null);
  const [aliasDraft, setAliasDraft] = useState(null);
  const phone = phoneDraft ?? user?.phone ?? '';
  const alias = aliasDraft ?? user?.alias ?? '';
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const aliasChanged = user?.role === 'student' && alias.trim() !== (user?.alias || '');
  const profileChanged = phone.trim() !== (user?.phone || '') || aliasChanged;

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice({ type: '', text: '' });
    try {
      const payload = { phone: phone.trim() };
      if (user?.role === 'student') payload.alias = alias.trim();
      const { data } = await api.patch('/api/auth/me/update/', payload);
      login(token, { ...user, ...data });
      setPhoneDraft(null);
      setAliasDraft(null);
      setNotice({ type: 'success', text: 'Your profile details were updated.' });
    } catch (error) {
      setNotice({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-header">
          <div className="eyebrow"><UserRound size={16} /> Your account</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account details and sign-in preferences.</p>
        </header>

        <section className="card settings-appearance">
          <div className="settings-appearance-copy">
            <div className="section-title-row">
              <h2><Sun size={21} /> Appearance</h2>
            </div>
            <p className="muted-copy">Choose the look that feels comfortable for you.</p>
          </div>
          <button
            type="button"
            className="button button-secondary btn-secondary theme-toggle"
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </button>
        </section>

        <section className="card settings-card">
          <div className="section-title-row">
            <h2><UserRound size={21} /> Profile details</h2>
          </div>
          <p className="muted-copy">Update your phone number and, if you’re a student, the public alias counsellors see. Your email address can’t be changed here.</p>

          <form onSubmit={handleSave} className="settings-form">
            <label>
              <span>Email address</span>
              <input type="email" value={user?.email || ''} disabled />
            </label>
            {user?.role === 'student' && (
              <label>
                <span>Public alias</span>
                <input
                  type="text"
                  value={alias}
                  onChange={(event) => {
                    setAliasDraft(event.target.value);
                    setNotice({ type: '', text: '' });
                  }}
                  placeholder="Choose a public alias"
                  autoComplete="username"
                  maxLength={50}
                  pattern="[A-Za-z0-9][A-Za-z0-9_.-]*"
                  title="Use letters, numbers, periods, underscores, or hyphens; start with a letter or number."
                  required
                />
              </label>
            )}
            <label>
              <span>Phone number</span>
              <input type="tel" value={phone} onChange={(event) => { setPhoneDraft(event.target.value); setNotice({ type: '', text: '' }); }} placeholder="e.g. 0712345678" maxLength={20} autoComplete="tel" />
            </label>
            {notice.text && <p className={`form-message ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
            <button type="submit" className="button btn-primary" disabled={saving || !profileChanged}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          <div className="settings-privacy">
            <ShieldCheck size={20} />
            <p>Your contact details are managed by your account and aren’t shown on your public profile.</p>
          </div>
        </section>

        <section className="card settings-logout">
          <div>
            <h2>Sign out</h2>
            <p>End your current session on this device.</p>
          </div>
          <button type="button" className="button button-danger" onClick={logout}><LogOut size={16} /> Log out</button>
        </section>
      </main>
    </div>
  );
}

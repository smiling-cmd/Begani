import { useContext, useState } from 'react';
import axios from 'axios';
import { LogOut, Moon, Save, ShieldCheck, Sun, UserRound } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import ThemeContext from '../context/ThemeContextValue';

const api = 'http://127.0.0.1:8000/api/auth/me/update/';

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
  const phone = phoneDraft ?? user?.phone ?? '';
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice({ type: '', text: '' });
    try {
      const { data } = await axios.patch(api, { phone: phone.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      login(token, { ...user, ...data });
      setPhoneDraft(null);
      setNotice({ type: 'success', text: 'Your phone number was updated.' });
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
        <header className="page-heading">
          <div className="eyebrow"><UserRound size={16} /> Your account</div>
          <h1>Settings</h1>
          <p>Manage your account details and sign-in preferences.</p>
        </header>

        <section className="panel settings-appearance">
          <div className="settings-appearance-copy">
            <div className="section-title-row">
              <h2><Sun size={21} /> Appearance</h2>
            </div>
            <p className="muted-copy">Choose the look that feels comfortable for you.</p>
          </div>
          <button
            type="button"
            className="button button-secondary theme-toggle"
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </button>
        </section>

        <section className="panel settings-card">
          <div className="section-title-row">
            <h2><UserRound size={21} /> Profile details</h2>
          </div>
          <p className="muted-copy">Your email and public alias can’t be changed here. Update your phone number below.</p>

          <form onSubmit={handleSave} className="settings-form">
            <label>
              <span>Email address</span>
              <input type="email" value={user?.email || ''} disabled />
            </label>
            <label>
              <span>Public alias</span>
              <input type="text" value={user?.alias || 'Not set'} disabled />
            </label>
            <label>
              <span>Phone number</span>
              <input type="tel" value={phone} onChange={(event) => setPhoneDraft(event.target.value)} placeholder="e.g. 0712345678" maxLength={20} autoComplete="tel" />
            </label>
            {notice.text && <p className={`form-message ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
            <button type="submit" className="button" disabled={saving || phone.trim() === (user?.phone || '')}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          <div className="settings-privacy">
            <ShieldCheck size={20} />
            <p>Your contact details are managed by your account and aren’t shown on your public profile.</p>
          </div>
        </section>

        <section className="panel settings-logout">
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

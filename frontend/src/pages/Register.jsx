import { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const messages = Object.values(data).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Registration failed. Please try again.';
}

export default function Register() {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
    role: 'student'
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    let accountCreated = false;
    try {
      await axios.post('http://127.0.0.1:8000/api/auth/register/', formData);
      accountCreated = true;

      const { data: tokens } = await axios.post('http://127.0.0.1:8000/api/token/', {
        email: formData.email,
        password: formData.password,
      });
      const { data: profile } = await axios.get('http://127.0.0.1:8000/api/auth/me/', {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      login(tokens.access, profile);
      navigate('/onboarding', { replace: true });
    } catch (requestError) {
      setError(accountCreated
        ? 'Your account was created, but automatic sign-in failed. Please sign in to continue.'
        : getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Create an Account</h2>
        <p style={s.sub}>Join Begani to share the load.</p>

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} style={s.input} required />
          </div>
          
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} style={s.input} required />
          </div>

          <div style={s.field}>
            <label style={s.label}>Phone Number</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} style={s.input} placeholder="e.g. 0712345678" required />
          </div>

          <div style={s.field}>
            <label style={s.label}>I am a...</label>
            <select name="role" value={formData.role} onChange={handleChange} style={s.input}>
              <option value="student">Student</option>
              <option value="therapist">Therapist</option>
            </select>
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" style={s.btn} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p style={s.foot}>
          Already have an account? <Link to="/" style={s.link}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '16px' },
  card: { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '22px', boxShadow: 'var(--shadow)', padding: '2.5rem', width: '100%', maxWidth: '420px' },
  title: { fontSize: '24px', fontWeight: '800', color: 'var(--heading)', margin: '0 0 4px' },
  sub: { color: 'var(--muted)', fontSize: '14px', margin: '0 0 1.5rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' },
  label: { fontSize: '13px', fontWeight: '600', color: 'var(--heading)' },
  input: { padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--line)', fontSize: '15px', color: 'var(--ink)', outline: 'none', background: 'var(--card)' },
  error: { color: 'var(--ink)', fontSize: '13px', margin: '0 0 10px', borderLeft: '3px solid var(--terra)', background: 'var(--terra-soft)', padding: '8px 12px', borderRadius: '8px' },
  btn: { width: '100%', padding: '12px', background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' },
  foot: { textAlign: 'center', marginTop: '1.25rem', fontSize: '13px', color: 'var(--muted)' },
  link: { color: 'var(--green)', fontWeight: '600', textDecoration: 'none' },
};
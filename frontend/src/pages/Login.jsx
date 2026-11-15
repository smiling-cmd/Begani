import { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import beganiLogo from '../assets/logo.png';

export default function Login() {
  const { login } = useContext(AuthContext); // <-- Get the login function
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      // 1. Get the token from Django
      const res = await axios.post('http://127.0.0.1:8000/api/token/', { email, password });
      
      // 2. Fetch the user's profile using the token
      const userRes = await axios.get('http://127.0.0.1:8000/api/auth/me/', {
        headers: { Authorization: `Bearer ${res.data.access}` }
      });

      const profile = userRes.data;
      login(res.data.access, profile);

      if (!profile.full_name?.trim()) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate(profile.role === 'therapist' ? '/therapist-dashboard' : '/home', { replace: true });
      }
      
    } catch {
      setError('Invalid email or password.');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <img src={beganiLogo} alt="Begani — Share the load." style={{ width: '200px', height: 'auto', objectFit: 'contain' }} />
        </div>

        <h2 style={s.title}>Welcome back</h2>
        <p style={s.sub}>Sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={s.input}
              placeholder="you@university.ac.ke"
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={s.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" style={s.btn}>Log in</button>
        </form>

        <p style={s.foot}>
          No account?{' '}
          <Link to="/register" style={s.link}>Register</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, system-ui, sans-serif',
    padding: '16px',
  },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '420px',
  },
  logo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    color: 'var(--heading)',
    margin: '0 0 4px',
  },
  sub: {
    color: 'var(--muted)',
    fontSize: '14px',
    margin: '0 0 1.5rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--heading)',
  },
  input: {
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1.5px solid var(--line)',
    fontSize: '15px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: 'var(--ink)',
    outline: 'none',
    background: 'var(--card)',
  },
  error: {
    color: 'var(--ink)',
    fontSize: '13px',
    margin: '0 0 10px',
    borderLeft: '3px solid var(--terra)',
    background: 'var(--terra-soft)',
    padding: '8px 12px',
    borderRadius: '8px',
  },
  btn: {
    width: '100%',
    padding: '12px',
    background: 'var(--brand-green)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '4px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  foot: {
    textAlign: 'center',
    marginTop: '1.25rem',
    fontSize: '13px',
    color: 'var(--muted)',
  },
  link: {
    color: 'var(--green)',
    fontWeight: '600',
    textDecoration: 'none',
  },
};

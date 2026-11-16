import { useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import api from '../api';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [initializing, setInitializing] = useState(Boolean(token));
  const profileRequestVersion = useRef(0);

  const logout = () => {
    profileRequestVersion.current += 1;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    setInitializing(false);
  };

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    const requestVersion = profileRequestVersion.current;
    setInitializing(true);

    // The shared client attaches the current token and handles 401 responses.
    api.get('/api/auth/me/')
      .then((response) => {
        if (active && profileRequestVersion.current === requestVersion) {
          setUser(response.data);
        }
      })
      .catch(() => {
        // A failed profile load must never leave the app stuck on a loading screen.
        if (active && profileRequestVersion.current === requestVersion) {
          logout();
        }
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    return () => { active = false; };
  }, [token]);

  const login = (newToken, userData, newRefreshToken) => {
    profileRequestVersion.current += 1;
    localStorage.setItem('access_token', newToken);
    if (newRefreshToken) {
      localStorage.setItem('refresh_token', newRefreshToken);
    }
    setToken(newToken);
    setUser(userData);
    setInitializing(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

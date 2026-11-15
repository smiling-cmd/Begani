import { useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import api from '../api';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const profileRequestVersion = useRef(0);

  const logout = () => {
    profileRequestVersion.current += 1;
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!token) return;
    const requestVersion = profileRequestVersion.current;
    // The shared client attaches the current token and handles 401 responses.
    api.get('/api/auth/me/')
      .then((response) => {
        if (profileRequestVersion.current === requestVersion) setUser(response.data);
      })
      .catch((error) => {
        // Only log out if the token is actually invalid
        if (error.response?.status === 401 && profileRequestVersion.current === requestVersion) {
          logout();
        }
      });
  }, [token]);

  const login = (newToken, userData) => {
    profileRequestVersion.current += 1;
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

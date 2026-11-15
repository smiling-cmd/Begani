import { useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';

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
    fetch('http://127.0.0.1:8000/api/auth/me/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error('Token expired');
      })
      .then((profile) => {
        if (profileRequestVersion.current === requestVersion) setUser(profile);
      })
      .catch(() => {
        if (profileRequestVersion.current === requestVersion) logout();
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

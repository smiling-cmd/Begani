import axios from 'axios';

// Use an environment variable for the base URL, falling back to localhost for dev
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

const clearSession = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

const isAuthEndpoint = (url = '') => url.includes('/api/token/')
  || url.includes('/api/auth/login/')
  || url.includes('/api/auth/register/');

let refreshRequest = null;

const refreshAccessToken = () => {
  if (refreshRequest) return refreshRequest;
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return Promise.reject(new Error('No refresh token available.'));

  refreshRequest = axios.post(`${API_BASE_URL}/api/token/refresh/`, { refresh })
    .then(({ data }) => {
      localStorage.setItem('access_token', data.access);
      return data.access;
    })
    .finally(() => { refreshRequest = null; });

  return refreshRequest;
};

// Automatically attach the JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh the access token once on 401, then retry. Log out if that fails.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (status !== 401 || isAuthEndpoint(url) || error.config?._retry) {
      return Promise.reject(error);
    }

    error.config._retry = true;
    try {
      const token = await refreshAccessToken();
      error.config.headers = {
        ...(error.config.headers || {}),
        Authorization: `Bearer ${token}`,
      };
      return api(error.config);
    } catch {
      clearSession();
      if (!['/login', '/register', '/'].includes(window.location.pathname)) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  }
);

export { API_BASE_URL };
export default api;

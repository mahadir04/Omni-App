import axios from 'axios';

const rawBase = import.meta.env.VITE_API_URL || '/api';
const baseURL = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/+$/, '')}/api`;

const api = axios.create({ baseURL: baseURL.startsWith('http') || baseURL.startsWith('/') ? baseURL : `/${baseURL}` });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('omni_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('omni_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

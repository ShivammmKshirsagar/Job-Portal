import axios from 'axios';

/**
 * Resolves the base URL for the backend REST API.
 * Supports configurable VITE_API_URL for production (e.g. Render).
 * Falls back to relative '/api' for local development via Vite proxy.
 * Automatically avoids duplicate '/api/api' paths.
 */
export const getBaseApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || !envUrl.trim()) {
    return '/api';
  }
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  if (cleanUrl.endsWith('/api')) {
    return cleanUrl;
  }
  return `${cleanUrl}/api`;
};

/**
 * Resolves the backend root origin without trailing /api.
 * Used for absolute file URLs and Socket.IO origin resolution.
 */
export const getBackendOrigin = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || !envUrl.trim()) {
    return '';
  }
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  return cleanUrl.replace(/\/api$/, '');
};

const api = axios.create({
  baseURL: getBaseApiUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('careerconnect_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized and not already on auth page, we can handle token expiry
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      const isAuthRoute =
        url.includes('/auth/login') ||
        url.includes('/auth/register');

      if (!isAuthRoute && localStorage.getItem('careerconnect_token')) {
        // Clear invalid token
        localStorage.removeItem('careerconnect_token');
        localStorage.removeItem('careerconnect_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

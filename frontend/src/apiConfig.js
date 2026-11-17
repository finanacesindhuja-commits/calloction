import { Capacitor } from '@capacitor/core';

// Centralized API configuration
const DEFAULT_CLOUD_URL = 'https://calloction.onrender.com';
let API_URL = (import.meta.env.VITE_API_URL || '').trim();

if (typeof window !== 'undefined' && window.location) {
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  if (isLocal) {
    // In local development, use relative path so Vite proxy forwards to localhost:5007
    API_URL = '';
  } else {
    // In production web (Vercel, Render, etc.) or Capacitor Android app,
    // ALWAYS use the active cloud backend
    if (!API_URL) {
      API_URL = DEFAULT_CLOUD_URL;
    }
  }
} else if (!API_URL) {
  API_URL = DEFAULT_CLOUD_URL;
}

// Remove any trailing slashes
API_URL = API_URL.replace(/\/+$/, '');

const LOAN_APP_URL = import.meta.env.VITE_LOAN_APP_URL || 'http://localhost:5173';

export { API_URL, LOAN_APP_URL };
export default API_URL;

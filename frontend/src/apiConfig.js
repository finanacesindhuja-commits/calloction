// Centralized API configuration
let API_URL = import.meta.env.VITE_API_URL || '';

// If loaded in a browser on localhost or local network, always use relative path ''
// so API requests go directly to the local backend (port 5007 or proxied 3007)
// instead of hitting outdated external cloud instances
if (typeof window !== 'undefined' && window.location) {
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.endsWith('.local')
  ) {
    API_URL = '';
  }
}

const LOAN_APP_URL = import.meta.env.VITE_LOAN_APP_URL || 'http://localhost:5173';

export { API_URL, LOAN_APP_URL };
export default API_URL;


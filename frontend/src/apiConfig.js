// Centralized API configuration
const API_URL = import.meta.env.VITE_API_URL || '';
const LOAN_APP_URL = import.meta.env.VITE_LOAN_APP_URL || 'http://localhost:5173';

export { API_URL, LOAN_APP_URL };
export default API_URL;


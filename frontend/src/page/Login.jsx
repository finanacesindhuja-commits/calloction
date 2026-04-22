import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserShield, FaLock, FaEnvelope } from 'react-icons/fa';
import API_URL from '../apiConfig';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any existing session data when landing on the login page
    localStorage.clear();
  }, []);

  const [staffId, setStaffId] = useState('');

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!staffId || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, password, role: 'Relationship Officer' }),
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('role', data.role);
        localStorage.setItem('staffId', data.staffId);
        localStorage.setItem('name', data.name);
        localStorage.setItem('branch', data.branch || '');
        navigate('/collections');
      } else {
        setError(data.message || 'Invalid credentials.');
      }
    } catch (err) {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
        {/* Animated Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-700"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all duration-700"></div>

        <div className="text-center mb-10 relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 mb-6 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <FaUserShield className="text-4xl text-white" />
          </div>
          <h2 className="text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">Collection Control</h2>
          <p className="text-blue-300/60 font-medium uppercase tracking-[0.2em] text-xs">Relationship Officer Portal</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-2xl mb-6 flex items-center animate-pulse">
            <span className="mr-3 text-lg">⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-300/80 uppercase tracking-widest ml-1">Staff ID</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaEnvelope className="text-blue-400/50 group-focus-within:text-blue-400 transition-colors" />
              </div>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 text-white placeholder-slate-600 transition-all outline-none"
                placeholder="Enter RO Identity"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-300/80 uppercase tracking-widest ml-1">Secure Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaLock className="text-blue-400/50 group-focus-within:text-blue-400 transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 text-white placeholder-slate-600 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-5 px-4 rounded-2xl shadow-xl text-md font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transform hover:-translate-y-1 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
          >
            {loading ? 'Verifying...' : 'Access Portal'}
          </button>
        </form>
        
        <p className="text-center mt-10 text-[10px] text-blue-300/30 uppercase tracking-widest font-bold">
          Strictly for authorized Relationship Officers only
        </p>
      </div>
    </div>
  );
}

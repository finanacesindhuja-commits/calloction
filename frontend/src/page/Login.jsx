import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserShield, FaLock, FaEnvelope, FaWifi } from 'react-icons/fa';
import API_URL from '../apiConfig';

export default function Login() {
  const navigate = useNavigate();

  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Verifying...');
  const [serverReady, setServerReady] = useState(false);
  const [waking, setWaking] = useState(true);

  // Wake up backend on app open (Render free tier sleeps after 15 min)
  useEffect(() => {
    localStorage.clear();

    const wakeBackend = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout
        await fetch(`${API_URL}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        setServerReady(true);
      } catch (_) {
        // Still allow login attempt even if ping fails
        setServerReady(false);
      } finally {
        setWaking(false);
      }
    };

    wakeBackend();
  }, []);

  const attemptLogin = async (staffId, password, retryCount = 0) => {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, password, role: 'Relationship Officer' }),
    });
    return res;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!staffId || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setLoadingMsg('Connecting...');

    let res;
    try {
      res = await attemptLogin(staffId, password);
    } catch (err) {
      // First attempt failed - retry once with wake-up message
      try {
        setLoadingMsg('Server waking up... Please wait ⏳');
        await new Promise(r => setTimeout(r, 4000)); // wait 4s
        setLoadingMsg('Retrying...');
        res = await attemptLogin(staffId, password);
      } catch (err2) {
        setError('⚠️ Server is starting up. Please try again in 30 seconds.');
        setLoading(false);
        return;
      }
    }

    try {
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
    } catch (_) {
      setError('⚠️ Server is starting up. Please try again in 30 seconds.');
    } finally {
      setLoading(false);
      setLoadingMsg('Verifying...');
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
          <h2 className="text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">colloct wish</h2>
          <p className="text-blue-300/60 font-medium uppercase tracking-[0.2em] text-xs">Relationship Officer Portal</p>
        </div>

        {/* Server Status Banner */}
        {waking && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-xs px-4 py-2.5 rounded-2xl mb-4 flex items-center gap-2 relative z-10">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
            Connecting to server... Please wait
          </div>
        )}
        {!waking && serverReady && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-xs px-4 py-2.5 rounded-2xl mb-4 flex items-center gap-2 relative z-10">
            <FaWifi className="text-green-400" />
            Server Ready ✓
          </div>
        )}
        {!waking && !serverReady && (
          <div className="bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs px-4 py-2.5 rounded-2xl mb-4 flex items-center gap-2 relative z-10">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
            Server starting up — first login may take 30 sec
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-2xl mb-6 flex items-center animate-pulse relative z-10">
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
            {loading ? loadingMsg : 'Access Portal'}
          </button>
        </form>
        
        <p className="text-center mt-10 text-[10px] text-blue-300/30 uppercase tracking-widest font-bold">
          Strictly for authorized Relationship Officers only
        </p>
      </div>
    </div>
  );
}

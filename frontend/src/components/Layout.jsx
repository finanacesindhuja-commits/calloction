import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaSignOutAlt, FaShieldAlt, FaBars, FaTimes, FaChartPie,
  FaListUl, FaFileInvoiceDollar, FaUsers, FaChartLine, FaCheckCircle
} from 'react-icons/fa';
import API_URL from '../apiConfig';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const staffId = localStorage.getItem('staffId');
  const userName = localStorage.getItem('name');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ targetToday: 0, activeCenters: 0, efficiency: 0 });
  const [draftSubtracted, setDraftSubtracted] = useState(0);

  useEffect(() => {
    fetchStats();

    // Global listeners for realtime Collection UI updates
    const handleDraftUpdate = (e) => setDraftSubtracted(e.detail || 0);
    const handleCollectionSubmit = () => fetchStats();

    window.addEventListener('draftCollectionUpdate', handleDraftUpdate);
    window.addEventListener('collectionSubmitted', handleCollectionSubmit);

    return () => {
      window.removeEventListener('draftCollectionUpdate', handleDraftUpdate);
      window.removeEventListener('collectionSubmitted', handleCollectionSubmit);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats?staffId=${staffId}`);
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) { console.error('Stats error:', err); }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const navItems = [
    { name: 'Collections', path: '/collections', icon: <FaListUl /> },
    { name: 'Dashboard', path: '/dashboard', icon: <FaChartPie /> },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen w-full flex bg-[#0a0f1c] text-slate-200">
      {/* Sliding Sidebar for Mobile / Permanent for Desktop */}
      <aside className={`fixed top-0 left-0 h-full w-80 bg-[#0f172a] border-r border-white/5 z-50 transform transition-transform duration-300 ease-out shadow-2xl flex flex-col lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Sidebar Header - User Info */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
                <FaShieldAlt className="text-white text-lg" />
              </div>
              <h2 className="font-black text-white uppercase tracking-tighter">Portal Access</h2>
            </div>
            <button
              onClick={closeSidebar}
              className="p-3 bg-white/5 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all lg:hidden"
            >
              <FaTimes />
            </button>
          </div>

          <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-black">
                {userName ? userName.charAt(0).toUpperCase() : 'RO'}
              </div>
              <div>
                <p className="text-sm font-black text-white tracking-tight">{userName || 'Relationship Officer'}</p>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">
                  {staffId || 'ID-OFFICER'} {localStorage.getItem('branch') && `• ${localStorage.getItem('branch')}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-6 space-y-2 border-b border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 pr-2">Navigation</p>
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => { navigate(item.path); closeSidebar(); }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all ${location.pathname === item.path
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              {item.icon}
              {item.name}
            </button>
          ))}
        </nav>

        {/* Quick Stats in Sidebar */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Today's Performance</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <FaFileInvoiceDollar size={12} />
                <p className="text-[9px] font-bold uppercase">Target</p>
              </div>
              <p className="text-sm font-black text-white">₹{Math.max(0, Number(stats.targetToday || 0) - draftSubtracted).toLocaleString()}</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <FaCheckCircle size={12} />
                <p className="text-[9px] font-bold uppercase">Collected</p>
              </div>
              <p className="text-sm font-black text-white">₹{Number(stats.collectedToday || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <FaUsers size={12} />
                <p className="text-[9px] font-bold uppercase">Centers</p>
              </div>
              <p className="text-sm font-black text-white">{stats.activeCenters || 0}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-1 transition-all hover:border-indigo-500/30">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <FaChartLine size={12} />
                <p className="text-[9px] font-bold uppercase">Efficiency</p>
              </div>
              <p className="text-sm font-black text-white">{stats.efficiency || 0}%</p>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-6 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-all active:scale-95"
          >
            <FaSignOutAlt />
            Logout Account
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] transition-opacity lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col lg:ml-80 w-full overflow-x-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-white/5 px-6 flex items-center justify-between sticky top-0 bg-[#0a0f1c]/90 backdrop-blur-xl z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all active:scale-95 lg:hidden"
            >
              <FaBars className="text-blue-400" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none">
                {location.pathname.replace('/', '') || 'Overview'}
              </h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">
                Relationship Officer Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-white leading-none mb-1">{userName || 'Relationship Officer'}</p>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest leading-none">{staffId || 'RO-Terminal'}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-xs font-black text-blue-400 shadow-inner">
              {userName ? userName.charAt(0).toUpperCase() : 'RO'}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-[calc(100vh-5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}

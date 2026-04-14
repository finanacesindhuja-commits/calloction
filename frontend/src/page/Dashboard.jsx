import API_URL from '../apiConfig';

export default function Dashboard() {
  const [centers, setCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [billData, setBillData] = useState({ schedules: [], members: [] });
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const apiUrl = API_URL;

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/centers`);
      const data = await res.json();
      if (res.ok) setCenters(data);
    } catch (err) { console.error('Centers error:', err); }
  };

  const fetchBills = async (centerId) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/bills/${centerId}`);
      const data = await res.json();
      if (res.ok) {
        setBillData(data);
        setSelectedCenter(centers.find(c => c.id === centerId));
        setSelectedMember(null); // Reset member view when center changes
      }
    } catch (err) { console.error('Bills error:', err); }
    finally { setLoading(false); }
  };

  const handleRecordPayment = async (scheduleId) => {
    setProcessing(true);
    try {
      const res = await fetch(`${apiUrl}/api/collections/${scheduleId}/pay`, {
        method: 'POST'
      });
      if (res.ok) {
        // Refresh data locally
        setBillData(prev => ({
          ...prev,
          schedules: prev.schedules.map(s => s.id === scheduleId ? { ...s, status: 'Paid' } : s)
        }));
        alert('Payment Recorded Successfully!');
      }
    } catch (err) { console.error('Payment error:', err); }
    finally { setProcessing(false); }
  };

  // Group schedules by member_id or loan_id for better data access
  const memberSchedules = billData.schedules.reduce((acc, s) => {
    const key = s.loan_id || s.member_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 pb-20">
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 bg-white/[0.02] p-6 rounded-3xl border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl border border-white/10">
              <FaUserCircle className="text-white text-2xl" />
            </div>
            <div>
              <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mb-0.5">RO Terminal</p>
              <h1 className="text-xl font-black text-white tracking-tight">Collection Dashboard</h1>
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
            <FaHistory className="text-slate-400" />
          </button>
        </header>

        {/* Hierarchical View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT PANEL: Center Selection */}
          {!selectedCenter ? (
            <div className="lg:col-span-12 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-soft"></div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Select Field Center</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {centers.map(center => (
                  <button 
                    key={center.id}
                    onClick={() => fetchBills(center.id)}
                    className="group bg-slate-800/40 border border-white/5 p-8 rounded-[2.5rem] text-left transition-all hover:border-blue-500/50 hover:bg-blue-600/5 hover:-translate-y-1"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                        <FaUsers size={20} />
                      </div>
                      <FaArrowRight className="text-slate-700 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{center.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{center.meeting_day || 'Weekly Access'}</p>
                    <div className="text-[10px] text-blue-500/50 font-bold mt-2">ID: #{center.id}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* BACK BUTTON AND CONTEXT */}
              <div className="lg:col-span-12 flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => { setSelectedCenter(null); setSelectedMember(null); }}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                  >
                    <FaArrowLeft size={16} />
                  </button>
                  <div>
                    <h2 className="font-black text-white tracking-tight">{selectedCenter.name}</h2>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Active Center Terminal</p>
                  </div>
                </div>
                {selectedMember && (
                  <button onClick={() => setSelectedMember(null)} className="text-[10px] font-black uppercase text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl hover:bg-indigo-500/10 transition-all">
                    Back to Member List
                  </button>
                )}
              </div>

              {/* MEMBERS LIST OR MEMBER DETAIL */}
              <div className="lg:col-span-12">
                {!selectedMember ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse-soft"></div>
                      <h3 className="text-xs font-black text-white uppercase tracking-widest">Members of {selectedCenter.name}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {billData.members.map(member => (
                        <button 
                          key={member.id}
                          onClick={() => setSelectedMember(member)}
                          className="group bg-slate-800/40 border border-white/5 p-6 rounded-3xl text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-600/5"
                        >
                          <div className="flex justify-between items-center mb-4">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                              <FaUserCircle className="text-slate-400 group-hover:text-indigo-400" />
                            </div>
                            <div className="text-[10px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-2 py-1 rounded-lg">Active</div>
                          </div>
                          <h4 className="text-xl font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{member.member_name}</h4>
                          <p className="text-[11px] text-slate-400 font-bold mt-1">Loan: ₹{Number(member.amount_sanctioned || 0).toLocaleString()}</p>
                          <div className="mt-4 flex justify-between items-center text-xs">
                            <span className="text-slate-500">Weekly Target:</span>
                            <span className="font-black text-white">₹{(memberSchedules[member.id]?.[0]?.amount || 0).toFixed(0)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* MEMBER 12-WEEK REPAYMENT CARD */}
                    <div className="bg-slate-800/40 border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
                      
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <div>
                          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-2">Member Repayment Ledger</p>
                          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{selectedMember.member_name}</h2>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="px-4 py-1.5 bg-white/5 rounded-xl text-[10px] font-bold text-slate-400 uppercase border border-white/5">
                              Center: <span className="text-white">{selectedCenter.name}</span>
                            </div>
                            <div className="px-4 py-1.5 bg-indigo-500/10 rounded-xl text-[10px] font-bold text-indigo-400 uppercase border border-indigo-500/20">
                              Member No: <span className="text-white">{selectedMember.member_no || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <input 
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="bg-slate-900 border border-white/10 text-white px-4 py-3 rounded-2xl text-[10px] font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <button className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase text-slate-200 border border-white/5 transition-all">
                            <FaPrint /> Print Official Ledger
                          </button>
                        </div>
                      </div>

                      {/* Repayment Grid - Filtered Date Only */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {(memberSchedules[selectedMember.id] || [])
                          .filter(week => week.scheduled_date === filterDate)
                          .map((week, idx) => (
                          <div key={week.id} className={`p-6 rounded-3xl border transition-all ${week.status === 'Paid' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0a0f1c] border-white/5 shadow-inner'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Week {idx + 1}</p>
                                <p className="text-[10px] text-blue-400 font-medium font-mono">{week.scheduled_date}</p>
                              </div>
                              {week.status === 'Paid' ? (
                                <FaCheckCircle className="text-emerald-400 shadow-emerald-500/50" />
                              ) : (
                                <FaClock className="text-amber-500/40" />
                              )}
                            </div>
                            <div className="mb-6">
                              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Amount Due</p>
                              <h4 className="text-2xl font-black text-white tracking-tighter">₹{Number(week.amount || 0).toLocaleString()}</h4>
                            </div>
                            
                            {week.status === 'Paid' ? (
                              <button disabled className="w-full py-3 bg-emerald-500/10 text-emerald-400 rounded-2xl text-[10px] font-black uppercase border border-emerald-500/20 flex items-center justify-center gap-2 cursor-not-allowed">
                                <FaRegCheckCircle /> PAID
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleRecordPayment(week.id)}
                                disabled={processing}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                              >
                                {processing ? 'Processing...' : <><FaFingerprint /> Record Payment</>}
                              </button>
                            )}
                          </div>
                        ))}
                        {(memberSchedules[selectedMember.id] || []).filter(w => w.scheduled_date === filterDate).length === 0 && (
                          <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                            <p className="text-slate-500 font-black text-sm uppercase tracking-widest">No schedules match the selected date</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

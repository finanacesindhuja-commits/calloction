import React, { useState, useEffect } from 'react';
import { FaUsers, FaSearch, FaCheckCircle, FaExclamationCircle, FaLock, FaCheck } from 'react-icons/fa';
import API_URL, { LOAN_APP_URL } from '../apiConfig';

export default function Collections() {
  const [centers, setCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // collectionAmounts keyed by member.id to allow inline typing per member
  const [collectionAmounts, setCollectionAmounts] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Entry, Step 2: Tally

  // Denominations State
  const [denominations, setDenominations] = useState({
    2000: '', 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '', 1: ''
  });

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async (date) => {
    try {
      const staffId = localStorage.getItem('staffId');
      const targetDate = date || selectedDate;
      const res = await fetch(`${API_URL}/api/centers?staffId=${staffId}&date=${targetDate}`);
      const data = await res.json();
      setCenters(data);
    } catch (err) {
      console.error('Error fetching centers:', err);
    }
  };

  const handleCenterChange = async (centerId, date = selectedDate) => {
    setSelectedCenter(centerId);
    if (!centerId) {
      setMembers([]);
      setSchedules([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bills/${centerId}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setMembers(data.members || []);
      setSchedules(data.schedules || []);
      
      // Default auto-fill the amounts to full target ONLY if desired. 
      // For manual generation, we leave it blank so RO can type.
      setCollectionAmounts({});
      setDenominations({2000:'',500:'',200:'',100:'',50:'',20:'',10:'',5:'',2:'',1:''});
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedCenter(''); // Reset center selection when date changes
    setMembers([]);
    setSchedules([]);
    fetchCenters(date);
  };

  const handleAmountChange = (memberId, value) => {
    setCollectionAmounts(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleDenomChange = (denom, value) => {
    setDenominations(prev => ({
      ...prev,
      [denom]: value
    }));
  };

  // We show ALL members of the center.
  // The user requested that all members must be visible on the list.
  const activeMembersForDate = members;

  const filteredMembers = activeMembersForDate.filter(m => 
    m.member_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id?.toString().includes(searchTerm) ||
    m.member_no?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Overall calculations for the Center Date View
  let totalCenterTarget = 0;
  let centerGlobalTarget = 0;
  
  const memberTargets = {}; // Map to store each member's target info for quick access
  
  filteredMembers.forEach((member) => {
    // Robust matching: Try ID first, then Name fallback if ID fails
    const memberSchedules = schedules.filter(s => 
      (s.loan_id && String(s.loan_id) === String(member.id)) || 
      (s.member_id && String(s.member_id) === String(member.id)) ||
      (s.member_name && member.member_name && s.member_name.trim().toLowerCase() === member.member_name.trim().toLowerCase())
    );
    
    // Find active schedules that are truly due (outstanding)
    const matchingSchedules = memberSchedules.filter(s => {
      const sDate = new Date(s.scheduled_date.split('T')[0].split(' ')[0]);
      const selDate = new Date(selectedDate);
      return (s.status === 'Pending' || s.status === 'Approved' || s.status === 'Partial' || s.status === 'Active') && (sDate <= selDate);
    });
    
    let targetAmount = 0;
    let penaltyAmount = 0;
    let weekStrings = [];
    
    matchingSchedules.forEach(s => {
      targetAmount += (Number(s.amount) - (Number(s.collected_amount) || 0));
      penaltyAmount += Number(s.penalty) || 0;
      if (s.week_number) weekStrings.push(`Week ${s.week_number}`);
    });
    
    memberTargets[member.id] = {
      amount: targetAmount + penaltyAmount,
      penalty: penaltyAmount,
      week: weekStrings.length > 0 ? weekStrings.join(', ') : null
    };
  });

  // Calculate full center targets (static, unaffected by search)
  totalCenterTarget = 0;
  centerGlobalTarget = 0; 
  members.forEach(member => {
    // Robust matching: Try ID first, then Name fallback if ID fails
    const memberSchedules = schedules.filter(s => 
      (s.loan_id && String(s.loan_id) === String(member.id)) || 
      (s.member_id && String(s.member_id) === String(member.id)) ||
      (s.member_name && member.member_name && s.member_name.trim().toLowerCase() === member.member_name.trim().toLowerCase())
    );
    
    // Find active schedules that are truly due (outstanding)
    const mSchedules = memberSchedules.filter(s => {
      const sDate = new Date(s.scheduled_date.split('T')[0].split(' ')[0]);
      const selDate = new Date(selectedDate);
      return (s.status === 'Pending' || s.status === 'Approved' || s.status === 'Partial' || s.status === 'Active') && (sDate <= selDate);
    });
    
    let mTarget = 0;
    mSchedules.forEach(s => {
      mTarget += ((Number(s.amount) + (Number(s.penalty) || 0)) - (Number(s.collected_amount) || 0));
    });

    totalCenterTarget += mTarget;
  });
  centerGlobalTarget = totalCenterTarget;

  const totalCenterCollected = filteredMembers.reduce((sum, member) => {
    const memberSchedules = schedules.filter(s => s.loan_id === member.id || s.member_id === member.id);
    return sum + memberSchedules.reduce((acc, s) => acc + Number(s.collected_amount || 0), 0);
  }, 0);

  // We show ALL members regardless of due status to allow for data corrections
  const membersWithDue = filteredMembers;

  // Tally Calculations
  const totalDraftCollection = Object.values(collectionAmounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const remainingCenterTarget = Math.max(0, totalCenterTarget - totalDraftCollection);
  const totalDenominations = Object.entries(denominations).reduce((sum, [denom, count]) => sum + (Number(denom) * (Number(count) || 0)), 0);
  
  const isTallyMatched = totalDraftCollection > 0 && totalDraftCollection === totalDenominations;

  // Emit event to update global sidebar target in realtime
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('draftCollectionUpdate', { detail: totalDraftCollection }));
  }, [totalDraftCollection]);

  const handleBatchSubmit = async () => {
    if (!isTallyMatched) return;

    setIsSubmitting(true);
    const paymentsToProcess = [];

    // Waterfall logic for each member's payment
    for (const memberIdStr of Object.keys(collectionAmounts)) {
       const rawValue = collectionAmounts[memberIdStr];
       if (rawValue !== '') {
         const amountEntered = Number(rawValue);
         const memberId = Number(memberIdStr);
         // Get all active schedules that are due on or before selected date (including arrears)
         const mSchedules = schedules
            .filter(s => (s.loan_id === memberId || s.member_id === memberId) && s.status !== 'Paid' && s.scheduled_date <= selectedDate)
            .sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
            
         let remainingToAllocate = amountEntered;

         for (const sch of mSchedules) {
            if (remainingToAllocate <= 0) break;
            
            const target = Number(sch.amount) + (Number(sch.penalty) || 0);
            const collectedSoFar = Number(sch.collected_amount) || 0;
            const due = target - collectedSoFar;
            
            // Allocate whatever is smaller: remaining cash or schedule's due
            const toApply = Math.min(remainingToAllocate, due > 0 ? due : remainingToAllocate);
            paymentsToProcess.push({
               scheduleId: sch.id,
               collectedAmount: collectedSoFar + toApply
            });
            remainingToAllocate -= toApply;
         }
       }
    }

    if (paymentsToProcess.length === 0) {
      alert('No payments mapped. Please check the amounts.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/collections/batch-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: paymentsToProcess })
      });
      if (res.ok) {
        const data = await res.json();
        
        if (data.closedLoans && data.closedLoans.length > 0) {
          const closedLoan = data.closedLoans[0]; // Take the first one for the redirect flow
          alert(`Loan for ${closedLoan.member_name} is completed! Redirecting to new application portal...`);
          
          // Redirect to Loan Application portal with auto-select parameters
          const loanAppUrl = `${LOAN_APP_URL}/centers?auto_center_id=${closedLoan.center_id}&auto_member_id=${closedLoan.member_id}`;
          window.location.href = loanAppUrl;

          return;
        }

        alert('Collections tallied and submitted perfectly!');
        window.dispatchEvent(new Event('collectionSubmitted'));
        setStep(1); // Reset to step 1
        handleCenterChange(selectedCenter, selectedDate); // refresh data
      } else {
        alert('Failed to submit collections');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-40">
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Field Collections</h1>
          <p className="text-blue-400/60 font-medium uppercase tracking-widest text-xs">Tally & Batch Processing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
        {/* Date Selection */}
        <div className="md:col-span-3 bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl">
          <label className="block text-xs font-bold text-blue-300 uppercase tracking-widest mb-3 ml-1">Collection Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer font-mono"
          />
        </div>

        {/* Center Selection */}
        <div className="md:col-span-6 bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl">
          <label className="block text-xs font-bold text-blue-300 uppercase tracking-widest mb-3 ml-1">Select Active Center</label>
          <select
            value={selectedCenter}
            onChange={(e) => handleCenterChange(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white rounded-2xl px-4 py-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
          >
            <option value="">-- Choose Center --</option>
            {centers.map(center => (
              <option key={center.id} value={center.id}>{center.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Indicator */}
      {selectedCenter && !loading && (
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setStep(1)}
            className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border ${step === 1 ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500'}`}
          >
            1. Amount Entry
          </button>
          <div className="w-8 h-[1px] bg-white/10 hidden sm:block"></div>
          <button 
            disabled={totalDraftCollection === 0}
            onClick={() => setStep(2)}
            className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border ${step === 2 ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500'} ${totalDraftCollection === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            2. Cash Verification
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : selectedCenter ? (
        <div className="w-full">
          
          {step === 1 && (
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 border-b border-white/10 bg-slate-900/50">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="w-full md:w-auto bg-white/5 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border border-white/5 md:border-0 text-center md:text-left">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Total Center Target</p>
                  <h2 className="text-4xl text-white tracking-tighter shadow-blue-500/10"><span className="text-2xl opacity-50 mr-1">₹</span>{centerGlobalTarget.toLocaleString()}</h2>
                </div>
                
                <div className="flex-1 w-full relative group">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search Member Name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-white/5 text-white rounded-2xl pl-12 pr-4 py-3 md:py-4 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder-slate-700 text-sm"
                  />
                </div>

                <div className="w-full md:w-auto flex justify-between md:block items-center bg-white/5 md:bg-transparent rounded-2xl md:rounded-none p-4 md:p-0 border border-white/5 md:border-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] md:mb-1">Center History</p>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter opacity-80">₹{totalCenterCollected.toLocaleString()}</h2>
                </div>
              </div>
            </div>
              
              <div className="mt-4 md:mt-0">
                <table className="w-full text-left border-collapse block md:table">
                  <thead className="hidden md:table-header-group">
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-6 py-5 text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Member Info</th>
                      <th className="px-6 py-5 text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Target / Due</th>
                      <th className="px-6 py-5 text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Manual Deposit</th>
                    </tr>
                  </thead>
                  <tbody className="block md:table-row-group space-y-4 md:space-y-0 md:divide-y md:divide-white/5 p-4 md:p-0">
                    {membersWithDue.length > 0 ? (
                      membersWithDue.map((member) => {
                        const targetInfo = memberTargets[member.id] || { amount: 0, week: null };
                        const target = targetInfo.amount;
                        const weekStr = targetInfo.week;
                        
                        return (
                          <tr key={member.id} className="group block md:table-row bg-slate-800/40 md:bg-transparent rounded-2xl md:rounded-none border border-white/5 md:border-0 hover:bg-white/5 transition-colors">
                            <td className="px-5 py-4 md:px-6 md:py-5 flex md:table-cell items-center justify-between border-b border-white/5 md:border-0">
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-white/10 shrink-0 shadow-lg group-hover:border-blue-500/50 transition-all">
                                  {member.member_photo_url ? (
                                    <img 
                                      src={member.member_photo_url} 
                                      alt={member.member_name} 
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                                    />
                                  ) : null}
                                  <FaUsers className={`text-blue-400/40 ${member.member_photo_url ? 'hidden' : 'block'}`} size={24} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <p className="font-bold text-white text-sm md:text-md uppercase tracking-tight">{member.member_name}</p>
                                  <div className="flex gap-2">
                                    <span className="text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-center font-mono font-bold tracking-widest uppercase">
                                      Member No: {member.member_no || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 md:px-6 md:py-5 flex justify-between items-center md:table-cell border-b border-white/5 md:border-0">
                              <span className="md:hidden text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Target / Due</span>
                              {target > 0 ? (
                                <div className="flex flex-col items-end md:items-start gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1.5 bg-red-500/10 text-red-400 text-sm font-black rounded-xl font-mono tracking-tighter border border-red-500/20 shadow-inner">
                                      ₹{target.toLocaleString()}
                                    </span>
                                    {targetInfo.penalty > 0 && (
                                      <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 text-[9px] font-black rounded-lg uppercase tracking-widest border border-yellow-500/20 shadow-inner whitespace-nowrap">
                                          + ₹{targetInfo.penalty} Late Fee
                                      </span>
                                    )}
                                  </div>
                                  {weekStr && <span className="text-[9px] text-red-400/60 font-bold uppercase pl-1">{weekStr}</span>}
                                </div>
                              ) : (
                                <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-black rounded-xl uppercase tracking-widest border border-emerald-500/20">
                                  Cleared
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 md:px-6 md:py-5 block md:table-cell bg-black/20 md:bg-transparent rounded-b-2xl md:rounded-none">
                              <div className="flex flex-col gap-2">
                                <span className="md:hidden text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Manual Deposit</span>
                                <div className="relative w-full md:max-w-[150px]">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                                  <input 
                                    type="number" 
                                    placeholder="0"
                                    value={collectionAmounts[member.id] || ''}
                                    onChange={(e) => handleAmountChange(member.id, e.target.value)}
                                    className={`w-full bg-slate-900 border text-white rounded-xl py-3 pl-8 pr-4 font-mono font-bold focus:outline-none transition-all ${collectionAmounts[member.id] ? 'border-blue-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]' : 'border-white/10 focus:border-white/30'}`}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr className="block md:table-row">
                        <td colSpan="3" className="px-6 py-16 text-center text-slate-500 font-bold italic block md:table-cell">
                          No active targets required for this exact date criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-8 bg-slate-900/50 border-t border-white/10 flex justify-end">
                <button 
                  disabled={totalDraftCollection === 0}
                  onClick={() => setStep(2)}
                  className={`px-8 py-4 md:px-10 md:py-5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${totalDraftCollection > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl active:scale-95 w-full md:w-auto' : 'bg-slate-800 text-slate-500 cursor-not-allowed w-full md:w-auto'}`}
                >
                  Next: Verify Cash Tally
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-300">
               <div className="bg-[#0f172a] border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600"></div>
                  
                  <div className="text-center mb-10">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Final Step</h3>
                    <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Cash Verification</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Match physical cash with entry total</p>
                  </div>

                  {/* BIG ENTRY TOTAL AT THE TOP */}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-8 mb-10 text-center shadow-inner group">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 group-hover:tracking-[0.3em] transition-all">Total Collection Generated</p>
                    <h2 className="text-5xl font-black text-white tracking-tighter">₹{totalDraftCollection.toLocaleString()}</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-10">
                    {[2000, 500, 200, 100, 50, 20, 10, 5, 2, 1].map(denom => (
                      <div key={denom} className="flex items-center gap-4 py-2 border-b border-white/5">
                        <div className="w-16 text-right text-xs font-mono font-bold text-slate-400">× ₹{denom}</div>
                        <div className="flex-1">
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={denominations[denom]}
                            onChange={(e) => handleDenomChange(denom, e.target.value)}
                            className="w-full bg-slate-800/50 border border-white/5 text-white rounded-xl py-3 px-4 text-md font-mono text-center focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder-slate-700"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-900/80 rounded-3xl p-6 mb-10 border border-white/10 shadow-inner">
                    <div className="flex justify-between items-center text-slate-400 mb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest">Calculated Physical Cash</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className={`font-mono text-4xl font-black ${isTallyMatched ? 'text-emerald-400 drop-shadow-md' : (totalDenominations > 0 ? 'text-red-400' : 'text-slate-500')}`}>
                        ₹{totalDenominations.toLocaleString()}
                      </span>
                      {totalDraftCollection > 0 && !isTallyMatched && (
                        <span className="text-xs font-bold text-red-500/80">
                          Diff: ₹{Math.abs(totalDraftCollection - totalDenominations).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setStep(1)}
                      className="flex-1 py-5 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all outline-none"
                    >
                      Back to Entry
                    </button>
                    <button 
                      onClick={handleBatchSubmit}
                      disabled={!isTallyMatched || isSubmitting}
                      className={`flex-[2] py-5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest transition-all ${
                        isTallyMatched && !isSubmitting
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-2xl active:scale-95'
                          : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      {isSubmitting ? (
                        <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-900"></span>
                      ) : isTallyMatched ? (
                        <><FaCheck /> Submit All Collections</>
                      ) : (
                        <><FaLock /> Matched Tally Required</>
                      )}
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-dashed border-white/10 rounded-[2.5rem] p-20 text-center tracking-tighter">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6 text-4xl">🔎</div>
          <h2 className="text-2xl font-bold text-white/60 mb-2 uppercase">Ready to Collect</h2>
          <p className="text-white/30 max-w-sm mx-auto">Select a collection date and active center to begin inputting cash counts.</p>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { FaUsers, FaSearch, FaCheckCircle, FaExclamationCircle, FaLock, FaCheck, FaTrophy, FaWhatsapp, FaCoins } from 'react-icons/fa';
import API_URL, { LOAN_APP_URL } from '../apiConfig';

export default function Collections() {
  const [centers, setCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // WhatsApp connection status state
  const [waStatus, setWaStatus] = useState({ isConnected: false, status: 'DISCONNECTED' });

  // Separate EMI and Saving inputs keyed by member.id so Saving Amount is tracked distinctly
  const [emiAmounts, setEmiAmounts] = useState({});
  const [savingAmounts, setSavingAmounts] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Entry, Step 2: Tally

  // Denominations State
  const [denominations, setDenominations] = useState({
    2000: '', 500: '', 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '', 1: ''
  });

  // Custom modal notification state
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchCenters();
    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkWhatsAppStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      }
    } catch (_) {}
  };

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
      setEmiAmounts({});
      setSavingAmounts({});
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
    setEmiAmounts({});
    setSavingAmounts({});
    fetchCenters(date);
  };

  const handleEmiChange = (memberId, value) => {
    setEmiAmounts(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleSavingChange = (memberId, value) => {
    setSavingAmounts(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleFillFullMember = (memberId, targetInfo) => {
    setEmiAmounts(prev => ({
      ...prev,
      [memberId]: targetInfo.emiDue > 0 ? String(targetInfo.emiDue) : ''
    }));
    if (targetInfo.isSavingPlan && targetInfo.savingDue > 0) {
      setSavingAmounts(prev => ({
        ...prev,
        [memberId]: String(targetInfo.savingDue)
      }));
    }
  };

  const handleDenomChange = (denom, value) => {
    setDenominations(prev => ({
      ...prev,
      [denom]: value
    }));
  };

  const computeScheduleSplit = (s, member) => {
    const totalAmount = Number(s.amount) || 0;
    const penalty = Number(s.penalty) || 0;
    const collectedSoFar = Number(s.collected_amount) || 0;
    const explicitSaving = s.saving_amount !== null && s.saving_amount !== undefined ? Number(s.saving_amount) : null;
    const schedSavingTarget = explicitSaving !== null
      ? explicitSaving
      : (member?.is_saving_plan ? (Number(member.saving_per_week) || 100) : 0);
    const explicitEmi = s.emi_amount !== null && s.emi_amount !== undefined && Number(s.emi_amount) > 0
      ? Number(s.emi_amount)
      : null;
    const schedEmiTarget = explicitEmi !== null ? explicitEmi : Math.max(0, totalAmount - schedSavingTarget);

    const emiPlusPenaltyTarget = schedEmiTarget + penalty;
    const emiCollected = Math.min(collectedSoFar, emiPlusPenaltyTarget);
    const savingCollected = Math.max(0, Math.min(schedSavingTarget, collectedSoFar - emiPlusPenaltyTarget));

    const emiDue = Math.max(0, emiPlusPenaltyTarget - emiCollected);
    const savingDue = Math.max(0, schedSavingTarget - savingCollected);

    return {
      isSavingPlan: schedSavingTarget > 0 || Boolean(member?.is_saving_plan),
      emiDue,
      savingDue,
      totalDue: emiDue + savingDue,
      penalty
    };
  };

  const memberTargets = {}; // Map to store each member's target info (split EMI + Saving)
  
  members.forEach((member) => {
    const memberSchedules = schedules.filter(s => 
      (s.loan_id && String(s.loan_id) === String(member.id)) || 
      (s.member_name && member.member_name && s.member_name.trim().toLowerCase() === member.member_name.trim().toLowerCase())
    );
    
    const matchingSchedules = memberSchedules.filter(s => {
      const sDate = s.scheduled_date.split('T')[0].split(' ')[0];
      const cleanStatus = s.status ? String(s.status).trim() : '';
      return (cleanStatus === 'Pending' || cleanStatus === 'Approved' || cleanStatus === 'Partial' || cleanStatus === 'Active') && (sDate === selectedDate);
    });
    
    let emiDueSum = 0;
    let savingDueSum = 0;
    let penaltyAmount = 0;
    let isSavingPlan = Boolean(member.is_saving_plan);
    let weekStrings = [];
    
    matchingSchedules.forEach(s => {
      const split = computeScheduleSplit(s, member);
      emiDueSum += split.emiDue;
      savingDueSum += split.savingDue;
      penaltyAmount += split.penalty;
      if (split.isSavingPlan) isSavingPlan = true;
      if (s.week_number) weekStrings.push(`Week ${s.week_number}`);
    });
    
    memberTargets[member.id] = {
      amount: emiDueSum + savingDueSum,
      emiDue: emiDueSum,
      savingDue: savingDueSum,
      isSavingPlan,
      planName: member.scheme_name || (isSavingPlan ? 'Saving Plan' : ''),
      penalty: penaltyAmount,
      week: weekStrings.length > 0 ? weekStrings.join(', ') : null
    };
  });

  // Only show members who actually have a pending target for the selected date
  const activeMembersForDate = members.filter(m => memberTargets[m.id]?.amount > 0);

  const filteredMembers = activeMembersForDate.filter(m => {
    const q = searchTerm.trim().toLowerCase();
    const cleanQ = q.replace(/[\s-]/g, '');
    const memNo = (m.member_no || m.members?.member_no || '').toString().toLowerCase();
    const cleanMemNo = memNo.replace(/[\s-]/g, '');

    return (
      m.member_name?.toLowerCase().includes(q) ||
      m.id?.toString().includes(q) ||
      (memNo && (memNo.includes(q) || cleanMemNo.includes(cleanQ)))
    );
  });

  // Overall calculations for the Center Date View (with EMI vs Saving breakdown)
  let totalCenterTarget = 0;
  let totalCenterEmiTarget = 0;
  let totalCenterSavingTarget = 0;
  let centerGlobalTarget = 0;
  
  members.forEach(member => {
    const t = memberTargets[member.id];
    if (t) {
      totalCenterEmiTarget += t.emiDue || 0;
      totalCenterSavingTarget += t.savingDue || 0;
      totalCenterTarget += t.amount || 0;
    }
  });
  centerGlobalTarget = totalCenterTarget;

  const totalCenterCollected = filteredMembers.reduce((sum, member) => {
    // Only count collections that belong to the currently viewed scheduled date
    const memberSchedules = schedules.filter(s => 
      (s.loan_id === member.id || (s.member_name && member.member_name && s.member_name.trim().toLowerCase() === member.member_name.trim().toLowerCase())) && 
      s.scheduled_date === selectedDate
    );
    return sum + memberSchedules.reduce((acc, s) => acc + Number(s.collected_amount || 0), 0);
  }, 0);

  // We show only members who haven't paid yet for this date criteria
  const membersWithDue = filteredMembers.filter(member => {
    const target = (memberTargets[member.id]?.amount || 0);
    return target > 0;
  });

  // Tally Calculations (Separate EMI + Saving sums)
  const totalDraftEmi = Object.values(emiAmounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const totalDraftSaving = Object.values(savingAmounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const totalDraftCollection = totalDraftEmi + totalDraftSaving;
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
    const manualSavingsToProcess = [];
    const staffName = localStorage.getItem('name') || localStorage.getItem('staffId') || 'Collection RO';

    // Collect union of all member IDs that have either EMI or Saving input entered
    const enteredMemberIds = new Set([...Object.keys(emiAmounts), ...Object.keys(savingAmounts)]);

    // Waterfall logic for each member's payment
    for (const memberIdStr of enteredMemberIds) {
       const emiEntered = Number(emiAmounts[memberIdStr]) || 0;
       const savingEntered = Number(savingAmounts[memberIdStr]) || 0;
       const amountEntered = emiEntered + savingEntered;
       if (amountEntered > 0) {
          const memberId = Number(memberIdStr);
          const member = members.find(m => m.id === memberId);
          const tInfo = memberTargets[memberId] || { isSavingPlan: false };
          // Get all active schedules that are due on selected date
          const mSchedules = schedules
            .filter(s => {
              const isMatch = (s.loan_id && String(s.loan_id) === String(memberId)) ||
                (!s.loan_id && s.member_name && member && member.member_name && s.member_name.trim().toLowerCase() === member.member_name.trim().toLowerCase());
              const cleanStatus = s.status ? String(s.status).trim() : '';
              return isMatch && cleanStatus !== 'Paid' && cleanStatus !== 'Received' && cleanStatus !== 'Verified' && s.scheduled_date.split('T')[0].split(' ')[0] === selectedDate;
            })
            .sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

          if (tInfo.isSavingPlan) {
            // Saving Plan schedules include emi_amount + saving_amount in schedule.amount
            // Allocate EMI-first across due schedules; any extra beyond schedule due is saved as manual deposit
            let remainingToAllocate = amountEntered;
            for (const sch of mSchedules) {
              if (remainingToAllocate <= 0) break;
              const target = Number(sch.amount) + (Number(sch.penalty) || 0);
              const collectedSoFar = Number(sch.collected_amount) || 0;
              const due = Math.max(0, target - collectedSoFar);
              if (due <= 0) continue;
              const toApply = Math.min(remainingToAllocate, due);
              paymentsToProcess.push({
                scheduleId: sch.id,
                collectedAmount: collectedSoFar + toApply
              });
              remainingToAllocate -= toApply;
            }
            if (remainingToAllocate > 0) {
              const refSch = mSchedules[0] || null;
              manualSavingsToProcess.push({
                loanId: memberId,
                memberId: member?.member_id || null,
                memberName: member?.member_name || '',
                centerId: selectedCenter,
                scheduleId: refSch?.id || null,
                weekNumber: refSch?.week_number || null,
                amount: remainingToAllocate,
                notes: refSch?.week_number ? `Week ${refSch.week_number} extra manual saving` : 'Extra manual saving deposit'
              });
            }
          } else {
            // Regular / Non-Saving-Plan member: keep EMI strictly on schedule bills and Saving as separate manual deposit
            let remainingEmi = emiEntered;
            for (const sch of mSchedules) {
              if (remainingEmi <= 0) break;
              const target = Number(sch.amount) + (Number(sch.penalty) || 0);
              const collectedSoFar = Number(sch.collected_amount) || 0;
              const due = Math.max(0, target - collectedSoFar);
              if (due <= 0) continue;
              const toApply = Math.min(remainingEmi, due);
              paymentsToProcess.push({
                scheduleId: sch.id,
                collectedAmount: collectedSoFar + toApply
              });
              remainingEmi -= toApply;
            }
            const manualSavingTotal = savingEntered + remainingEmi;
            if (manualSavingTotal > 0) {
              const refSch = mSchedules[0] || null;
              manualSavingsToProcess.push({
                loanId: memberId,
                memberId: member?.member_id || null,
                memberName: member?.member_name || '',
                centerId: selectedCenter,
                scheduleId: refSch?.id || null,
                weekNumber: refSch?.week_number || null,
                amount: manualSavingTotal,
                notes: refSch?.week_number ? `Week ${refSch.week_number} manual saving deposit` : 'Manual saving deposit'
              });
            }
          }
       }
    }

    if (paymentsToProcess.length === 0 && manualSavingsToProcess.length === 0) {
      setNotification({ type: 'error', message: 'No payments mapped. Please check the amounts.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/collections/batch-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: paymentsToProcess, manualSavings: manualSavingsToProcess, staffName })
      });
      if (res.ok) {
        const data = await res.json();
        
        if (data.closedLoans && data.closedLoans.length > 0) {
          const closedNames = data.closedLoans.map(l => l.member_name).join(', ');
          setNotification({
            type: 'closed',
            message: `🎉 ${closedNames} — Loan fully settled! Loan Status: CLOSED`,
            action: () => {
              window.dispatchEvent(new Event('collectionSubmitted'));
              setStep(1);
              setSelectedCenter('');
              setMembers([]);
              setSchedules([]);
              setEmiAmounts({});
              setSavingAmounts({});
              fetchCenters(selectedDate);
            }
          });
          return;
        }

        setNotification({
          type: 'success',
          message: 'Collections tallied and submitted! WhatsApp bills are being sent automatically to all paid members.',
          action: () => {
            window.dispatchEvent(new Event('collectionSubmitted'));
            setStep(1);
            // Reset center view so user sees fresh center list
            setSelectedCenter('');
            setMembers([]);
            setSchedules([]);
            setEmiAmounts({});
            setSavingAmounts({});
            fetchCenters(selectedDate); // Refresh centers list to reflect paid status
          }
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setNotification({
          type: 'error',
          message: errData.error || 'Failed to submit collections. Please try again.'
        });
      }
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: err.message || 'Network connection error while submitting collections.'
      });
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

        <div className="flex items-center gap-3">
          <a
            href={`${API_URL}/whatsapp`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all shadow-md active:scale-95 ${
              waStatus.isConnected 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
            }`}
            title={waStatus.isConnected ? 'WhatsApp Auto-Bill is active' : 'Click to scan WhatsApp QR code'}
          >
            <FaWhatsapp size={16} />
            <span>
              {waStatus.isConnected 
                ? `WhatsApp Active ${waStatus.user?.phone ? `(+${waStatus.user.phone})` : ''}` 
                : 'Link WhatsApp for Auto-Bill'}
            </span>
          </a>
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
                  {totalCenterSavingTarget > 0 && (
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-1.5 text-[10px] font-black uppercase tracking-wider">
                      <span className="text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">EMI: ₹{totalCenterEmiTarget.toLocaleString()}</span>
                      <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">Saving: ₹{totalCenterSavingTarget.toLocaleString()}</span>
                    </div>
                  )}
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
                      <th className="px-6 py-5 text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Target / Due (EMI & Saving)</th>
                      <th className="px-6 py-5 text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Manual Deposit (Separate Saving)</th>
                    </tr>
                  </thead>
                  <tbody className="block md:table-row-group space-y-4 md:space-y-0 md:divide-y md:divide-white/5 p-4 md:p-0">
                    {membersWithDue.length > 0 ? (
                      membersWithDue.map((member) => {
                        const targetInfo = memberTargets[member.id] || { amount: 0, emiDue: 0, savingDue: 0, isSavingPlan: false, week: null };
                        const target = targetInfo.amount;
                        const weekStr = targetInfo.week;
                        const enteredEmi = Number(emiAmounts[member.id]) || 0;
                        const enteredSaving = Number(savingAmounts[member.id]) || 0;
                        const showEmiFirstWarn = targetInfo.isSavingPlan && enteredSaving > 0 && enteredEmi < targetInfo.emiDue;
                        
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
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-center font-mono font-bold tracking-widest uppercase">
                                      Member No: {member.member_no || 'N/A'}
                                    </span>
                                    {targetInfo.isSavingPlan && (
                                      <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-black tracking-wider uppercase flex items-center gap-1">
                                        <FaCoins size={9} /> Saving Plan
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 md:px-6 md:py-5 flex justify-between items-center md:table-cell border-b border-white/5 md:border-0">
                              <span className="md:hidden text-[10px] font-black text-blue-300/60 uppercase tracking-[0.2em]">Target / Due</span>
                              {target > 0 ? (
                                <div className="flex flex-col items-end md:items-start gap-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-3 py-1 bg-red-500/10 text-red-400 text-sm font-black rounded-xl font-mono tracking-tighter border border-red-500/20 shadow-inner">
                                      ₹{target.toLocaleString()}
                                    </span>
                                    {targetInfo.isSavingPlan && (
                                      <>
                                        <span className="px-2 py-1 bg-blue-500/10 text-blue-300 text-[10px] font-black rounded-lg font-mono border border-blue-500/20">
                                          EMI: ₹{targetInfo.emiDue.toLocaleString()}
                                        </span>
                                        <span className="px-2 py-1 bg-emerald-500/15 text-emerald-300 text-[10px] font-black rounded-lg font-mono border border-emerald-500/30">
                                          Saving: ₹{targetInfo.savingDue.toLocaleString()}
                                        </span>
                                      </>
                                    )}
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
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-blue-300/80 uppercase tracking-widest mb-1 pl-1">EMI Amount</span>
                                    <div className="relative w-32 md:w-36">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                                      <input 
                                        type="number" 
                                        min="0"
                                        placeholder={targetInfo.emiDue > 0 ? String(targetInfo.emiDue) : '0'}
                                        value={emiAmounts[member.id] || ''}
                                        onChange={(e) => handleEmiChange(member.id, e.target.value)}
                                        className={`w-full bg-slate-900 border text-white rounded-xl py-2.5 pl-8 pr-3 font-mono font-bold focus:outline-none transition-all ${emiAmounts[member.id] ? 'border-blue-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]' : 'border-white/10 focus:border-white/30'}`}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1 pl-1">
                                      {targetInfo.isSavingPlan ? 'Saving Amount' : 'Saving (Manual)'}
                                    </span>
                                    <div className="relative w-28 md:w-32">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/70 font-bold">₹</span>
                                      <input 
                                        type="number" 
                                        min="0"
                                        placeholder={targetInfo.savingDue > 0 ? String(targetInfo.savingDue) : '0'}
                                        value={savingAmounts[member.id] || ''}
                                        onChange={(e) => handleSavingChange(member.id, e.target.value)}
                                        className={`w-full bg-emerald-950/30 border text-emerald-200 rounded-xl py-2.5 pl-8 pr-3 font-mono font-bold focus:outline-none transition-all ${savingAmounts[member.id] ? 'border-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.45)]' : 'border-emerald-500/30 focus:border-emerald-400'}`}
                                      />
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleFillFullMember(member.id, targetInfo)}
                                    className="self-end mb-0.5 px-2.5 py-2.5 bg-white/5 hover:bg-blue-500/20 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-blue-300 border border-white/10 hover:border-blue-500/30 rounded-xl transition-all"
                                    title="Auto-fill full EMI and Saving target"
                                  >
                                    Full
                                  </button>
                                </div>
                                {(enteredEmi > 0 || enteredSaving > 0) && (
                                  <div className="flex items-center gap-2 text-[10px] font-bold">
                                    <span className="text-slate-400">Row Total: <span className="text-white font-mono">₹{(enteredEmi + enteredSaving).toLocaleString()}</span></span>
                                    {showEmiFirstWarn && (
                                      <span className="text-amber-400">• Partial note: EMI ₹{targetInfo.emiDue} fills first before Saving</span>
                                    )}
                                  </div>
                                )}
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

              <div className="p-8 bg-slate-900/50 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-wider">
                  <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
                    EMI Entry: ₹{totalDraftEmi.toLocaleString()}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    Saving Entry: ₹{totalDraftSaving.toLocaleString()}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white">
                    Total Cash: ₹{totalDraftCollection.toLocaleString()}
                  </span>
                </div>
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
                    {totalDraftSaving > 0 && (
                      <div className="flex justify-center items-center gap-3 mt-4 text-xs font-black uppercase tracking-wider">
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-xl">EMI: ₹{totalDraftEmi.toLocaleString()}</span>
                        <span className="text-slate-500">+</span>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-xl">Saving: ₹{totalDraftSaving.toLocaleString()}</span>
                      </div>
                    )}
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
      {/* Custom premium modal notification instead of browser alert */}
      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`border rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 ${
            notification.type === 'closed'
              ? 'bg-[#1a1200] border-yellow-500/30'
              : 'bg-[#0f172a] border-white/10'
          }`}>
            {/* Top color highlight line */}
            <div className={`absolute top-0 left-0 w-full h-1.5 ${
              notification.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
              notification.type === 'closed'  ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
              notification.type === 'error'   ? 'bg-gradient-to-r from-red-500 to-rose-500' :
              'bg-gradient-to-r from-blue-500 to-indigo-500'
            }`}></div>

            <div className="text-center mt-4">
              <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${
                notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                notification.type === 'closed'  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' :
                notification.type === 'error'   ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {notification.type === 'success' && <FaCheckCircle size={32} />}
                {notification.type === 'closed'  && <FaTrophy size={32} />}
                {notification.type === 'error'   && <FaExclamationCircle size={32} />}
                {notification.type === 'info'    && <FaCheckCircle size={32} />}
              </div>

              <h3 className={`text-xl font-bold mb-3 tracking-tight ${
                notification.type === 'closed' ? 'text-yellow-400' : 'text-white'
              }`}>
                {notification.type === 'success' ? 'Success' :
                 notification.type === 'closed'  ? 'Loan Closed! 🏆' :
                 notification.type === 'error'   ? 'Oops!' :
                 'Notice'}
              </h3>

              {notification.type === 'closed' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-2 mb-4 inline-block">
                  <span className="text-yellow-400 text-xs font-black uppercase tracking-widest">Status: CLOSED ✓</span>
                </div>
              )}
              
              <p className={`text-sm leading-relaxed mb-8 ${
                notification.type === 'closed' ? 'text-yellow-200/70' : 'text-slate-400'
              }`}>
                {notification.message}
              </p>

              <button
                onClick={() => {
                  const action = notification.action;
                  setNotification(null);
                  if (action) action();
                }}
                className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                  notification.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/10' :
                  notification.type === 'closed'  ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-yellow-500/20' :
                  notification.type === 'error'   ? 'bg-red-500 hover:bg-red-400 text-slate-900 shadow-red-500/10' :
                  'bg-blue-500 hover:bg-blue-400 text-slate-900 shadow-blue-500/10'
                }`}
              >
                {notification.type === 'closed' ? '✓ Okay, Noted' : 'Okay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

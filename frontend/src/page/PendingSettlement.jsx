import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaCoins, FaSearch, FaCheckCircle, FaExclamationCircle, 
  FaCalendarAlt, FaTimes, FaShieldAlt, FaReceipt, FaArrowRight,
  FaCheck, FaUndo, FaPercentage, FaHistory, FaHandHoldingUsd
} from 'react-icons/fa';
import API_URL, { LOAN_APP_URL } from '../apiConfig';

export default function PendingSettlement() {
  const navigate = useNavigate();
  const staffId = localStorage.getItem('staffId');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Selected Member / Loan for Settlement Modal
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('settle'); // 'settle' | 'history'

  // Settlement Form State
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
  const [amountPaid, setAmountPaid] = useState('');
  const [waivePenalty, setWaivePenalty] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification state
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchPendingMembers();
  }, []);

  const fetchPendingMembers = async (search = searchTerm) => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/pending-settlement/members?staffId=${staffId || ''}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPendingMembers(data);
      }
    } catch (err) {
      console.error('Error fetching pending members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    fetchPendingMembers(val);
  };

  const handleOpenSettlement = async (loanId) => {
    setSelectedLoanId(loanId);
    setDetailsLoading(true);
    setWaivePenalty(false);
    setPaymentMode('Cash');
    setRemarks('');

    try {
      const res = await fetch(`${API_URL}/api/pending-settlement/loan/${loanId}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
        // By default, select all pending schedules
        const allPendingIds = (data.pendingSchedules || []).map(s => s.id);
        setSelectedScheduleIds(allPendingIds);

        // Pre-fill amount paid with grand total
        const defaultTotal = data.summary?.grandTotalDue || 0;
        setAmountPaid(defaultTotal > 0 ? String(defaultTotal) : '');
      } else {
        setNotification({ type: 'error', message: 'Failed to load loan pending schedules' });
        setSelectedLoanId(null);
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error loading pending details' });
      setSelectedLoanId(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedLoanId(null);
    setDetailData(null);
    setSelectedScheduleIds([]);
    setAmountPaid('');
    setWaivePenalty(false);
  };

  // Toggle specific schedule selection
  const handleToggleSchedule = (id) => {
    let updated;
    if (selectedScheduleIds.includes(id)) {
      updated = selectedScheduleIds.filter(sId => sId !== id);
    } else {
      updated = [...selectedScheduleIds, id];
    }
    setSelectedScheduleIds(updated);

    // Re-calculate target total for selected
    recalculateTarget(updated, waivePenalty);
  };

  // Toggle Penalty Waiver
  const handleToggleWaive = (checked) => {
    setWaivePenalty(checked);
    recalculateTarget(selectedScheduleIds, checked);
  };

  const recalculateTarget = (scheduleIds, isWaived) => {
    if (!detailData) return;
    const selectedSchedules = (detailData.pendingSchedules || []).filter(s => scheduleIds.includes(s.id));
    let total = 0;
    selectedSchedules.forEach(s => {
      const penalty = isWaived ? 0 : (s.penalty || 0);
      total += (s.remEMI || 0) + penalty;
    });
    setAmountPaid(total > 0 ? String(total) : '');
  };

  // Calculate selected total due
  const calculateSelectedTotal = () => {
    if (!detailData) return 0;
    const selected = (detailData.pendingSchedules || []).filter(s => selectedScheduleIds.includes(s.id));
    let total = 0;
    selected.forEach(s => {
      const p = waivePenalty ? 0 : (s.penalty || 0);
      total += (s.remEMI || 0) + p;
    });
    return total;
  };

  const targetTotal = calculateSelectedTotal();
  const enteredNum = Number(amountPaid) || 0;

  // Waterfall Allocation Preview for UI
  const getAllocationPreview = () => {
    if (!detailData || enteredNum <= 0) return [];
    const selected = (detailData.pendingSchedules || []).filter(s => selectedScheduleIds.includes(s.id));
    let remaining = enteredNum;
    const result = [];

    for (const s of selected) {
      const penalty = waivePenalty ? 0 : (s.penalty || 0);
      const target = (s.remEMI || 0) + penalty;
      const apply = Math.min(remaining, target);
      remaining -= apply;

      result.push({
        weekNumber: s.week_number,
        target,
        applied: apply,
        isCleared: apply >= target,
        isPartial: apply > 0 && apply < target
      });
    }
    return result;
  };

  const allocationPreview = getAllocationPreview();

  const handleSubmitSettlement = async () => {
    if (!selectedLoanId || enteredNum <= 0) {
      setNotification({ type: 'error', message: 'Please enter a valid payment amount!' });
      return;
    }

    if (selectedScheduleIds.length === 0) {
      setNotification({ type: 'error', message: 'Please select at least one week to settle!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/pending-settlement/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoanId,
          amountPaid: enteredNum,
          waivePenalty,
          selectedScheduleIds,
          paymentMode,
          remarks
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        handleCloseModal();
        fetchPendingMembers(searchTerm);

        if (data.closedLoan) {
          setNotification({
            type: 'success',
            title: 'All Dues Cleared & Loan Completed!',
            message: `Entire loan for ${data.closedLoan.member_name} is now paid in full! WhatsApp receipt sent. Would you like to apply for their next loan?`,
            actionBtn: 'Apply Next Loan',
            action: () => {
              const url = `${LOAN_APP_URL}/centers?auto_center_id=${data.closedLoan.center_id}&auto_member_id=${data.closedLoan.member_id}`;
              window.location.href = url;
            }
          });
        } else {
          setNotification({
            type: 'success',
            title: 'Settlement Recorded Successfully!',
            message: `Received ₹${enteredNum.toLocaleString()}! Cleared: ${data.settledWeeks?.join(', ') || 'Partial settlement'}. Remaining Loan Balance: ₹${(data.remainingLoanBalance || 0).toLocaleString()}. WhatsApp receipt dispatched!`
          });
        }
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to process settlement' });
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Network / Server error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-40">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-wider mb-2">
            <FaCoins /> Arrears & Dues Settlement
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Arrears Dues Collection & Settlement
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-1">
            Collect accumulated pending weeks, settle arrears in total, or adjust with penalty waiver
          </p>
        </div>
      </div>

      {/* Hero Member Search Bar */}
      <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-xl mb-8">
        <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 ml-1">
          Search Member by ID, Member No, Name or Loan ID
        </label>
        <div className="relative">
          <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-400 text-lg" />
          <input
            type="text"
            placeholder="Type Member ID (e.g. 133), Member No (e.g. LN-370408), Name, Loan ID..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-amber-500/30 text-white rounded-2xl pl-14 pr-12 py-4 text-base focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2"
              title="Clear search"
            >
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      {/* Member Cards List */}
      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : pendingMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pendingMembers.map(item => (
            <div
              key={item.loanId}
              className="bg-white/5 border border-white/10 hover:border-amber-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all group hover:shadow-2xl hover:shadow-amber-500/10"
            >
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10 shrink-0 shadow-lg">
                    {item.memberPhotoUrl ? (
                      <img
                        src={item.memberPhotoUrl}
                        alt={item.memberName}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-xl font-bold text-amber-400">
                        {item.memberName?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-black">
                        ID: #{item.memberId || 'N/A'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300 text-[10px] font-mono font-semibold">
                        {item.memberNo}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base truncate group-hover:text-amber-400 transition-colors uppercase">
                      {item.memberName}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Loan #{item.loanId} • <span className="text-amber-300 font-bold uppercase">{item.centerName}</span>
                    </p>
                  </div>
                </div>

                {/* Overdue info pills */}
                <div className="bg-slate-900/60 rounded-2xl p-3 border border-white/5 mb-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Pending Weeks:</span>
                    {item.pendingWeeksCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-bold text-[11px]">
                        {item.pendingWeeksCount} wks ({item.weeks.map(w => `W${w}`).join(', ')})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                        ✓ All Paid to Date (0 Arrears)
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">EMI Arrears:</span>
                    <span className="font-mono font-bold text-white">₹{item.pendingEMITotal.toLocaleString()}</span>
                  </div>

                  {item.totalPenalty > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-yellow-400 font-medium">Late Penalty:</span>
                      <span className="font-mono font-bold text-yellow-400">+ ₹{item.totalPenalty.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/5 flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase text-amber-400">Total Pending Due:</span>
                    <span className={`text-xl font-black font-mono ${item.totalPendingDue > 0 ? 'text-white' : 'text-emerald-400'}`}>
                      {item.totalPendingDue > 0 ? `₹${item.totalPendingDue.toLocaleString()}` : '₹0 (Clear)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleOpenSettlement(item.loanId)}
                className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg ${
                  item.pendingWeeksCount > 0
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                }`}
              >
                {item.pendingWeeksCount > 0 ? (
                  <>
                    <FaReceipt /> Settle Dues ({item.pendingWeeksCount} Wks) <FaArrowRight size={10} />
                  </>
                ) : (
                  <>
                    <FaHistory /> View History / Foreclose <FaArrowRight size={10} />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-dashed border-white/10 rounded-3xl p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 text-3xl">
            ✨
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Pending Arrears Found!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All collections are up-to-date for the selected filter criteria.
          </p>
        </div>
      )}

      {/* Settlement & Adjustment Modal */}
      {selectedLoanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl relative my-8 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Top Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all"
            >
              <FaTimes />
            </button>

            {/* Modal Title & Member Info */}
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">
                <FaCoins /> Member Arrears & Settlement Portal
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {detailData?.loan?.member_name || 'Member Settlement'}
              </h2>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-1.5">
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold text-[11px] border border-amber-500/20">
                  Member ID: #{detailData?.loan?.member_id || detailData?.loan?.members?.id || 'N/A'}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[11px]">
                  No: {detailData?.loan?.members?.member_no || 'N/A'}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[11px]">
                  Loan #{selectedLoanId}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-bold uppercase text-[11px] border border-blue-500/20">
                  Center: {detailData?.loan?.centers?.name}
                </span>
                {detailData?.loan?.mobile_no && (
                  <span className="text-slate-400 font-mono text-[11px]">
                    📱 {detailData.loan.mobile_no}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-white/10 mb-4 gap-2">
              <button
                onClick={() => setActiveModalTab('settle')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeModalTab === 'settle'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FaReceipt size={12} />
                Settle Dues ({detailData?.pendingSchedules?.length || 0} Pending)
              </button>
              <button
                onClick={() => setActiveModalTab('history')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeModalTab === 'history'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FaHistory size={12} />
                Collection History ({detailData?.allSchedules?.length || 0} Weeks)
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-20 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
              </div>
            ) : detailData ? (
              <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                {activeModalTab === 'history' ? (
                  /* FULL COLLECTION HISTORY VIEW */
                  <div className="space-y-4">
                    {/* History Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-900/80 border border-white/5 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-slate-500">Total Weeks</p>
                        <p className="text-base font-black text-white">{detailData.allSchedules?.length || 0}</p>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-emerald-400">Paid Weeks</p>
                        <p className="text-base font-black text-emerald-400">
                          {detailData.allSchedules?.filter(s => s.isPaid).length || 0}
                        </p>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-rose-400">Pending / Overdue</p>
                        <p className="text-base font-black text-rose-400">
                          {detailData.pendingSchedules?.length || 0}
                        </p>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-amber-400">Total Due</p>
                        <p className="text-base font-black text-white font-mono">
                          ₹{(detailData.summary?.grandTotalDue || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Timeline List of All Weeks */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Complete Repayment Timeline:
                      </p>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                        {(detailData.allSchedules || []).map(sch => (
                          <div
                            key={sch.id}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                              sch.isPaid
                                ? 'bg-emerald-500/[0.04] border-emerald-500/10'
                                : sch.isPastOrToday
                                ? 'bg-rose-500/[0.04] border-rose-500/20'
                                : 'bg-slate-900/40 border-white/5 opacity-70'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                                  sch.isPaid
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : sch.isPastOrToday
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : 'bg-slate-800 text-slate-500'
                                }`}
                              >
                                W{sch.week_number}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-white">Date: {sch.scheduled_date}</p>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                                      sch.isPaid
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : sch.status === 'Partial'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : sch.isPastOrToday
                                        ? 'bg-rose-500/20 text-rose-400'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {sch.isPaid ? 'Paid' : sch.status === 'Partial' ? 'Partial' : sch.isPastOrToday ? 'Overdue' : 'Upcoming'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  EMI: ₹{Number(sch.amount).toLocaleString()}
                                  {Number(sch.collected_amount || 0) > 0 && (
                                    <span className="text-emerald-400 font-bold ml-1.5">
                                      • Collected: ₹{Number(sch.collected_amount).toLocaleString()}
                                    </span>
                                  )}
                                  {sch.penalty > 0 && (
                                    <span className="text-yellow-400 font-bold ml-1.5">
                                      • Late Fee: +₹{sch.penalty}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div>
                              {!sch.isPaid && sch.isPastOrToday && (
                                <button
                                  onClick={() => {
                                    setSelectedScheduleIds([sch.id]);
                                    recalculateTarget([sch.id], waivePenalty);
                                    setActiveModalTab('settle');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
                                >
                                  Settle
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Bottom Actions from History View */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-white/5">
                      {detailData.pendingSchedules && detailData.pendingSchedules.length > 0 && (
                        <button
                          onClick={() => {
                            const allIds = detailData.pendingSchedules.map(s => s.id);
                            setSelectedScheduleIds(allIds);
                            recalculateTarget(allIds, waivePenalty);
                            setActiveModalTab('settle');
                          }}
                          className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                          <FaReceipt /> Settle All {detailData.pendingSchedules.length} Overdue Weeks
                        </button>
                      )}
                      <button
                        onClick={() => {
                          handleCloseModal();
                          navigate('/foreclosure');
                        }}
                        className="py-3 px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                      >
                        <FaHandHoldingUsd /> Full Foreclosure
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SETTLE DUES FORM VIEW */
                  <>
                {/* Pending Schedules Selection List */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Select Pending Weeks to Clear:
                    </span>
                    <button
                      onClick={() => {
                        const allIds = (detailData.pendingSchedules || []).map(s => s.id);
                        if (selectedScheduleIds.length === allIds.length) {
                          setSelectedScheduleIds([]);
                          setAmountPaid('0');
                        } else {
                          setSelectedScheduleIds(allIds);
                          recalculateTarget(allIds, waivePenalty);
                        }
                      }}
                      className="text-[10px] font-bold text-amber-400 hover:underline uppercase"
                    >
                      {selectedScheduleIds.length === detailData.pendingSchedules.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {detailData.pendingSchedules.map(sch => {
                      const isChecked = selectedScheduleIds.includes(sch.id);
                      const penalty = waivePenalty ? 0 : (sch.penalty || 0);
                      const weekTotal = sch.remEMI + penalty;

                      return (
                        <div
                          key={sch.id}
                          onClick={() => handleToggleSchedule(sch.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isChecked
                              ? 'bg-amber-500/10 border-amber-500/40 text-white'
                              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold ${isChecked ? 'bg-amber-500 text-slate-950' : 'border border-white/20'}`}>
                              {isChecked && <FaCheck size={10} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold">
                                Week {sch.week_number} <span className="text-[10px] text-slate-400 font-normal">({sch.scheduled_date})</span>
                              </p>
                              {sch.penalty > 0 && !waivePenalty && (
                                <p className="text-[10px] text-yellow-400 font-bold">
                                  Includes +₹{sch.penalty} Late Fee
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-black text-sm text-white">
                              ₹{weekTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Penalty Waiver Option */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-yellow-300">
                      Waive Off Late Penalties
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Zero out late fees so member only pays pure EMI dues
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waivePenalty}
                      onChange={(e) => handleToggleWaive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Amount Paid Input & Target */}
                <div className="bg-slate-900/90 rounded-2xl p-5 border border-white/10 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">Selected Target Dues:</span>
                    <span className="font-mono font-bold text-white text-sm">₹{targetTotal.toLocaleString()}</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-amber-400 tracking-wider mb-1.5">
                      Amount Member is Paying Now:
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₹</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="0"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="w-full bg-[#0a0f1c] border border-amber-500/30 text-white rounded-xl py-3.5 pl-9 pr-4 text-xl font-mono font-black focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Waterfall Allocation Live Preview */}
                  {allocationPreview.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Adjustment Split Preview:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allocationPreview.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-xl text-center text-xs border ${
                              item.isCleared
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : item.isPartial
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-white/5 border-white/5 text-slate-500'
                            }`}
                          >
                            <p className="font-bold">W{item.weekNumber}</p>
                            <p className="text-[10px] font-mono">
                              {item.isCleared ? '✓ Cleared' : item.isPartial ? `Partial ₹${item.applied}` : 'Unpaid'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Mode & Remarks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Arrears full clear"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Submit Action Buttons */}
                <div className="pt-3 flex gap-3">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 py-3.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isSubmitting || enteredNum <= 0}
                    onClick={handleSubmitSettlement}
                    className={`flex-[2] py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${
                      !isSubmitting && enteredNum > 0
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95 shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-950"></span>
                    ) : (
                      <>
                        <FaCheckCircle /> Confirm Settlement
                      </>
                    )}
                  </button>
                </div>
                </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative text-center animate-in zoom-in-95 duration-200">
            <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
              notification.type === 'success' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {notification.type === 'success' ? <FaCheckCircle size={32} /> : <FaExclamationCircle size={32} />}
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              {notification.title || (notification.type === 'success' ? 'Success' : 'Error')}
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              {notification.message}
            </p>

            <div className="flex gap-2">
              {notification.action && (
                <button
                  onClick={() => {
                    const action = notification.action;
                    setNotification(null);
                    action();
                  }}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider transition-all"
                >
                  {notification.actionBtn || 'Proceed'}
                </button>
              )}
              <button
                onClick={() => setNotification(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

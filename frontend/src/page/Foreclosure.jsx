import React, { useState, useEffect, useRef } from 'react';
import { 
  FaHandHoldingUsd, FaSearch, FaCheckCircle, FaExclamationCircle, 
  FaCalendarCheck, FaPercentage, FaMoneyBillWave, FaArrowRight, 
  FaUserCheck, FaInfoCircle, FaTimes, FaShieldAlt, FaPhoneAlt, FaHistory, FaReceipt
} from 'react-icons/fa';
import API_URL, { LOAN_APP_URL } from '../apiConfig';

export default function Foreclosure() {
  const staffId = localStorage.getItem('staffId');
  const [searchTerm, setSearchTerm] = useState('');
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  // Selected loan for foreclosure settlement modal
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loanDetails, setLoanDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('foreclose'); // 'foreclose' | 'history'

  // Settlement Form State
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification state
  const [notification, setNotification] = useState(null);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Full loans hidden by default — only fetched when user types search
  useEffect(() => {
    // Keep empty on initial load
  }, []);

  const fetchLoans = async (search) => {
    if (!search || !search.trim()) {
      setLoans([]);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const url = `${API_URL}/api/foreclosure/loans?search=${encodeURIComponent(search.trim())}`;
      const res = await fetch(url, { signal: abortRef.current.signal });
      if (res.ok) {
        const data = await res.json();
        setLoans(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    if (!val || !val.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      setLoans([]);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLoans(val.trim());
    }, 350);
  };

  const handleSelectLoan = async (loan) => {
    setSelectedLoan(loan);
    setDiscountAmount(0);
    setPaymentMode('Cash');
    setRemarks('');
    setActiveModalTab('foreclose');
    setDetailsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/loans/${loan.id}/foreclosure-details`);
      if (res.ok) {
        const data = await res.json();
        setLoanDetails(data);
      } else {
        setNotification({ type: 'error', message: 'Failed to load loan details' });
        setSelectedLoan(null);
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error loading loan details' });
      setSelectedLoan(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedLoan(null);
    setLoanDetails(null);
    setDiscountAmount(0);
  };

  // Calculations
  const grossAmount = loanDetails?.summary?.grossSettlementAmount || 0;
  const discountNum = Math.max(0, Number(discountAmount) || 0);
  const netSettlementPayable = Math.max(0, grossAmount - discountNum);

  const handleConfirmForeclosure = async () => {
    if (!selectedLoan || !loanDetails) return;

    if (discountNum > grossAmount) {
      setNotification({ type: 'error', message: 'Discount cannot be greater than the settlement amount!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/loans/${selectedLoan.id}/foreclose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementAmount: netSettlementPayable,
          discountAmount: discountNum,
          paymentMode,
          remarks
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const closedLoan = data.closedLoan;
        handleCloseModal();
        fetchLoans(searchTerm);

        setNotification({
          type: 'success',
          title: 'Loan Foreclosed & Closed!',
          message: `Loan for ${closedLoan.member_name} has been closed completely. WhatsApp NOC sent! Would you like to apply for their next loan now?`,
          actionBtn: 'Apply New Loan',
          action: () => {
            const loanAppUrl = `${LOAN_APP_URL}/centers?auto_center_id=${closedLoan.center_id}&auto_member_id=${closedLoan.member_id}`;
            window.location.href = loanAppUrl;
          }
        });
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to complete foreclosure' });
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Server communication failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-40">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold uppercase tracking-wider mb-2">
            <FaHandHoldingUsd /> Loan Foreclosure Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Early Loan Foreclosure
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-1">
            Complete active loan settlement ahead of time with instant loan closure & NOC
          </p>
        </div>
      </div>

      {/* Hero Member Search Bar */}
      <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-xl mb-8">
        <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 ml-1">
          Search Member by ID, Member No, Name or Loan ID
        </label>
        <div className="relative">
          <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 text-lg" />
          <input
            type="text"
            placeholder="Type Member ID (e.g. 133), Member No (e.g. LN-370408), Name, Loan ID..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-blue-500/30 text-white rounded-2xl pl-14 pr-12 py-4 text-base focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-500"
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

      {/* Loan List Section */}
      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : loans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loans.map(loan => (
            <div
              key={loan.id}
              className="bg-white/5 border border-white/10 hover:border-blue-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all group hover:shadow-2xl hover:shadow-blue-500/10"
            >
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10 shrink-0 shadow-lg">
                    {loan.member_photo_url ? (
                      <img
                        src={loan.member_photo_url}
                        alt={loan.member_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-xl font-bold text-blue-400">
                        {loan.member_name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-black">
                        ID: #{loan.member_id || loan.members?.id || 'N/A'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300 text-[10px] font-mono font-semibold">
                        {loan.members?.member_no || 'N/A'}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base truncate group-hover:text-blue-400 transition-colors uppercase">
                      {loan.member_name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Loan #{loan.id} • <span className="text-blue-300 font-bold uppercase">{loan.centers?.name || 'Center N/A'}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/60 rounded-2xl p-3 border border-white/5 mb-4 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Sanctioned</p>
                    <p className="text-sm font-black text-white">₹{Number(loan.amount_sanctioned || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Status</p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {loan.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSelectLoan(loan)}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-blue-600/20"
              >
                <FaHandHoldingUsd /> Foreclosure Settlement <FaArrowRight size={10} />
              </button>
            </div>
          ))}
        </div>
      ) : !searchTerm.trim() ? (
        <div className="bg-slate-900/40 border border-dashed border-white/10 rounded-3xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg">
            <FaSearch />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Search Member to Foreclose Loan</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Type Member ID, Member No (e.g. LN-973153), Name or Loan ID above to view principal outstanding, collection history, and close loan.
          </p>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400">
            <span>💡 Try:</span> Type <span className="font-mono text-blue-400 font-bold">LN-973153</span>, <span className="font-mono text-blue-400 font-bold">LN-370408</span> or member name
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-dashed border-white/10 rounded-3xl p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 text-3xl">
            🔍
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Loan Found!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No active loan found matching "<span className="text-blue-400 font-mono font-bold">{searchTerm}</span>". Please check the Member ID or LN number.
          </p>
        </div>
      )}

      {/* Foreclosure Calculation & Settlement Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl relative my-8 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Top Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all"
            >
              <FaTimes />
            </button>

            {/* Modal Title */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                <FaShieldAlt /> Loan Settlement & Closure
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Foreclosure: {selectedLoan.member_name}
              </h2>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-1">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-bold text-[11px] border border-blue-500/20">
                  Member ID: #{selectedLoan.member_id || selectedLoan.members?.id || 'N/A'}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[11px]">
                  No: {selectedLoan.members?.member_no || 'N/A'}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[11px]">
                  Loan #{selectedLoan.id}
                </span>
                <span className="text-blue-300 font-bold uppercase">
                  • Center: {selectedLoan.centers?.name}
                </span>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-white/10 mb-5 gap-2">
              <button
                onClick={() => setActiveModalTab('foreclose')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeModalTab === 'foreclose'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FaShieldAlt size={12} />
                Foreclosure Settlement
              </button>
              <button
                onClick={() => setActiveModalTab('history')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeModalTab === 'history'
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FaHistory size={12} />
                Collection History ({loanDetails?.schedules?.length || 0} Weeks)
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-20 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : loanDetails ? (
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                {activeModalTab === 'history' ? (
                  /* FULL COLLECTION HISTORY VIEW */
                  <div className="space-y-4">
                    {/* Summary Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-slate-900/80 border border-white/5 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-slate-500">Total Weeks</p>
                        <p className="text-base font-black text-white">{loanDetails.summary.totalWeeks}</p>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-emerald-400">Paid Weeks</p>
                        <p className="text-base font-black text-emerald-400">{loanDetails.summary.paidWeeks}</p>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-amber-400">Total Collected</p>
                        <p className="text-base font-black text-white font-mono">
                          ₹{loanDetails.summary.totalCollected.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-2xl text-center">
                        <p className="text-[9px] uppercase font-bold text-blue-400">Payoff Amount</p>
                        <p className="text-base font-black text-blue-400 font-mono">
                          ₹{grossAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Timeline List */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Complete Repayment Timeline:
                      </p>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                        {(loanDetails.schedules || []).map(sch => {
                          const isPaid = ['Paid', 'Received', 'Verified'].includes(sch.status);
                          return (
                            <div
                              key={sch.id}
                              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                                isPaid
                                  ? 'bg-emerald-500/[0.04] border-emerald-500/10'
                                  : 'bg-amber-500/[0.04] border-amber-500/20'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                                    isPaid
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  W{sch.week_number}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-white">Date: {sch.scheduled_date}</p>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                                        isPaid
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : 'bg-amber-500/20 text-amber-400'
                                      }`}
                                    >
                                      {isPaid ? 'Paid' : 'Unpaid'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Amount: ₹{Number(sch.amount).toLocaleString()}
                                    {Number(sch.collected || 0) > 0 && (
                                      <span className="text-emerald-400 font-bold ml-1.5">
                                        • Collected: ₹{Number(sch.collected).toLocaleString()}
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

                              <span className="font-mono text-xs font-bold text-slate-300">
                                {isPaid ? '₹' + Number(sch.collected || sch.amount).toLocaleString() : 'Due ₹' + Number(sch.due || sch.amount).toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <button
                        onClick={() => setActiveModalTab('foreclose')}
                        className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                      >
                        <FaShieldAlt /> Proceed to Foreclose Loan (₹{grossAmount.toLocaleString()})
                      </button>
                    </div>
                  </div>
                ) : (
                  /* FORECLOSURE CALCULATION VIEW */
                  <>
                {/* Repayment Progress Visual */}
                <div className="bg-slate-900/80 rounded-2xl p-4 border border-white/5">
                  <div className="flex justify-between items-center text-xs font-bold mb-2">
                    <span className="text-slate-400">Repayment Status:</span>
                    <span className="text-emerald-400">
                      {loanDetails.summary.paidWeeks} of {loanDetails.summary.totalWeeks} Weeks Paid
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${Math.round((loanDetails.summary.paidWeeks / (loanDetails.summary.totalWeeks || 1)) * 100)}%`
                      }}
                    ></div>
                  </div>

                  {/* Week Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {loanDetails.schedules.map(s => {
                      const isPaid = ['Paid', 'Received', 'Verified'].includes(s.status);
                      return (
                        <span
                          key={s.id}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          W{s.week_number}: {isPaid ? '✓' : `₹${s.amount}`}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Calculation Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-center">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Sanctioned</p>
                    <p className="text-sm font-black text-white">₹{Number(selectedLoan.amount_sanctioned || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-500/5 rounded-2xl p-3 border border-emerald-500/10 text-center">
                    <p className="text-[9px] uppercase font-bold text-emerald-400">Total Paid</p>
                    <p className="text-sm font-black text-emerald-400">₹{Number(loanDetails.summary.totalCollected || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-amber-500/5 rounded-2xl p-3 border border-amber-500/10 text-center col-span-2 md:col-span-1">
                    <p className="text-[9px] uppercase font-bold text-amber-400">Unpaid EMIs ({loanDetails.summary.pendingWeeks} wks)</p>
                    <p className="text-sm font-black text-amber-400">₹{Number(loanDetails.summary.remainingEMISum || 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Foreclosure Calculation Form */}
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-300 font-bold">Remaining EMI Total:</span>
                    <span className="font-mono font-bold text-white">₹{loanDetails.summary.remainingEMISum.toLocaleString()}</span>
                  </div>

                  {loanDetails.summary.totalPenalty > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-yellow-400 font-bold">Late Fee / Penalties:</span>
                      <span className="font-mono font-bold text-yellow-400">+ ₹{loanDetails.summary.totalPenalty.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Special Discount / Waiver */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <div>
                      <span className="text-xs font-bold text-slate-300 block">Interest Rebate / Discount:</span>
                      <span className="text-[10px] text-slate-500">Waive off interest for early bulk closure</span>
                    </div>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 text-white rounded-xl py-2 pl-7 pr-3 text-sm font-mono font-bold focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Concession Preset Buttons */}
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-slate-400 font-bold self-center mr-1">Quick Rebate:</span>
                    {[
                      { label: '0%', val: 0 },
                      { label: '10%', val: Math.round(grossAmount * 0.10) },
                      { label: '25%', val: Math.round(grossAmount * 0.25) },
                      { label: '50%', val: Math.round(grossAmount * 0.50) },
                      ...(loanDetails.summary.totalPenalty > 0 ? [{ label: '100% Late Fee', val: loanDetails.summary.totalPenalty }] : [])
                    ].map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setDiscountAmount(p.val)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          Number(discountAmount) === p.val
                            ? 'bg-blue-500 text-white border-blue-400 shadow-sm'
                            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Big Settlement Amount */}
                  <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-300">
                      Net Settlement Payable:
                    </span>
                    <span className="text-3xl font-black text-white font-mono">
                      ₹{netSettlementPayable.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 text-white rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                      Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Early full settlement"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 text-white rounded-xl px-3 py-2.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Final Action Button */}
                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 py-3.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isSubmitting || netSettlementPayable < 0}
                    onClick={handleConfirmForeclosure}
                    className={`flex-[2] py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${
                      !isSubmitting
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-950"></span>
                    ) : (
                      <>
                        <FaCheckCircle /> Confirm & Close Loan
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
              notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
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

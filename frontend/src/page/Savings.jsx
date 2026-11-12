import React, { useState, useEffect } from 'react';
import {
  FaSearch, FaCoins, FaUsers, FaCheckCircle, FaTimesCircle,
  FaSpinner, FaArrowDown, FaArrowUp, FaHistory, FaWallet, FaShieldAlt, FaTimes
} from 'react-icons/fa';
import API_URL from '../apiConfig';

export default function Savings() {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Passbook & Withdrawal Modal State
  const [selectedMember, setSelectedMember] = useState(null);
  const [passbookData, setPassbookData] = useState(null);
  const [passbookLoading, setPassbookLoading] = useState(false);

  // Manual Add Saving & Withdrawal Form State
  const [actionTab, setActionTab] = useState('deposit'); // 'deposit' | 'withdraw'
  const [actionAmount, setActionAmount] = useState('');
  const [actionLoanId, setActionLoanId] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchMembers(trimmed);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchMembers = async (query) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/savings/members?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error searching saving members:', err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const openPassbook = async (memberRow, defaultTab = 'deposit') => {
    setSelectedMember(memberRow);
    setPassbookData(null);
    setPassbookLoading(true);
    setActionTab(defaultTab);
    setActionAmount('');
    setActionNotes('');
    setActionLoanId(memberRow.latestLoanId ? String(memberRow.latestLoanId) : '');

    try {
      const res = await fetch(`${API_URL}/api/savings/member/${encodeURIComponent(memberRow.memberKey)}`);
      const data = await res.json();
      if (res.ok) {
        setPassbookData(data);
        if (!memberRow.latestLoanId && data.loans?.length > 0) {
          setActionLoanId(String(data.loans[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching saving passbook:', err);
    } finally {
      setPassbookLoading(false);
    }
  };

  const handleSavingAction = async (e) => {
    e.preventDefault();
    if (!passbookData || !selectedMember) return;

    const amt = Number(actionAmount);
    const available = passbookData.summary?.availableBalance || 0;
    if (!amt || amt <= 0) {
      setNotification({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }

    if (actionTab === 'withdraw' && amt > available) {
      setNotification({ type: 'error', message: `Withdrawal exceeds available saving balance (₹${available.toLocaleString()}).` });
      return;
    }

    setSubmittingAction(true);
    try {
      const staffName = localStorage.getItem('name') || localStorage.getItem('staffId') || 'Collection RO';
      const endpoint = actionTab === 'deposit' ? '/api/savings/deposit' : '/api/savings/withdraw';
      const defaultNote = actionTab === 'deposit' ? 'Manual saving deposit' : 'Saving withdrawal / refund';

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.memberId || selectedMember.memberNo,
          loanId: actionLoanId ? Number(actionLoanId) : selectedMember.latestLoanId,
          amount: amt,
          notes: actionNotes.trim() || defaultNote,
          staffName
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        window.dispatchEvent(new Event('collectionSubmitted'));
        setNotification({
          type: 'success',
          message: actionTab === 'deposit'
            ? `₹${amt.toLocaleString()} Saving added for ${selectedMember.memberName}. New Balance: ₹${Number(data.availableBalance).toLocaleString()}`
            : `₹${amt.toLocaleString()} Saving withdrawn for ${selectedMember.memberName}. Remaining Balance: ₹${Number(data.availableBalance).toLocaleString()}`
        });
        setActionAmount('');
        setActionNotes('');
        await openPassbook(selectedMember, actionTab);
        if (searchTerm.trim()) {
          fetchMembers(searchTerm.trim());
        }
      } else {
        setNotification({ type: 'error', message: data.error || 'Operation failed.' });
      }
    } catch (err) {
      console.error('Saving action error:', err);
      setNotification({ type: 'error', message: 'Network error while updating member savings.' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const formatTxStyle = (type) => {
    if (type === 'WEEKLY_SAVING') {
      return {
        label: 'WEEKLY SAVING',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        amountPrefix: '+',
        amountClass: 'text-emerald-400',
        icon: <FaArrowDown className="text-emerald-400" size={12} />
      };
    }
    if (type === 'WITHDRAWAL') {
      return {
        label: 'WITHDRAWAL',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        amountPrefix: '-',
        amountClass: 'text-rose-400',
        icon: <FaArrowUp className="text-rose-400" size={12} />
      };
    }
    return {
      label: 'STP CHARGE',
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      amountPrefix: '',
      amountClass: 'text-amber-400',
      icon: <FaShieldAlt className="text-amber-400" size={12} />
    };
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Member Savings & Refund Portal
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter mt-2">
            Savings Passbook
          </h1>
          <p className="text-slate-400 text-xs md:text-sm font-medium mt-1">
            Check weekly saving credits, carry-forward balances after loan closure, and issue member withdrawals.
          </p>
        </div>
      </div>

      {/* Inline Toast Notification */}
      {notification && (
        <div className={`rounded-2xl p-4 border flex items-center justify-between gap-4 animate-in fade-in duration-300 ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-3 text-sm font-bold">
            {notification.type === 'success' ? <FaCheckCircle className="shrink-0" /> : <FaTimesCircle className="shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs uppercase font-black tracking-wider opacity-70 hover:opacity-100">
            Close
          </button>
        </div>
      )}

      {/* Search Hero Box (hidden member list until RO searches) */}
      <div className="bg-slate-900/60 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl">
        <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-[0.25em] mb-3">
          Search Member by Name, Member ID, LN No, Mobile or Loan ID
        </label>
        <div className="relative group">
          <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
          <input
            type="text"
            placeholder="e.g., LN-973153, Priya, 98765..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0a0f1c] border border-white/10 text-white rounded-2xl pl-12 pr-12 py-4 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 outline-none transition-all placeholder-slate-600 text-sm md:text-base font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
              title="Clear search"
            >
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      {/* Results Area */}
      {!searchTerm.trim() ? (
        <div className="bg-white/5 border border-dashed border-white/10 rounded-[2rem] p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <FaWallet size={26} />
          </div>
          <h3 className="text-lg font-black text-white tracking-tight">Search a Member to View Saving Passbook</h3>
          <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
            Member directory is kept hidden for privacy. Type a Member Name, Member Number (LN-...), Loan ID, or Mobile Number above to inspect saving balances or process a withdrawal.
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center p-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-12 text-center text-slate-400 font-bold">
          No saving-plan member found matching "{searchTerm}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {members.map((m) => (
            <div
              key={m.memberKey}
              className="bg-slate-900/70 border border-white/10 hover:border-emerald-500/40 rounded-[1.75rem] p-6 flex flex-col justify-between gap-5 transition-all shadow-xl group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {m.memberPhotoUrl ? (
                    <img
                      src={m.memberPhotoUrl}
                      alt={m.memberName}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    />
                  ) : null}
                  <FaUsers className={`text-emerald-400/40 ${m.memberPhotoUrl ? 'hidden' : 'block'}`} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-white text-base uppercase tracking-tight truncate">{m.memberName}</h3>
                  <p className="text-[10px] font-mono font-bold text-indigo-300 mt-0.5">
                    {m.memberNo || m.memberId}
                  </p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                    {m.centerName || 'Unknown Center'} {m.mobileNo ? `• ${m.mobileNo}` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-black/30 rounded-2xl p-3.5 border border-white/5">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Saved</p>
                  <p className="text-sm font-black font-mono text-emerald-400 mt-0.5">₹{Number(m.totalWeeklySaving || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Withdrawn</p>
                  <p className="text-sm font-black font-mono text-rose-400 mt-0.5">₹{Number(m.totalWithdrawn || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-emerald-300/80 uppercase tracking-wider">Balance</p>
                  <p className="text-base font-black font-mono text-white mt-0.5">₹{Number(m.availableBalance || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {m.loans?.slice(0, 2).map((ln) => (
                    <span
                      key={ln.id}
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${
                        String(ln.status).toUpperCase() === 'CLOSED'
                          ? 'bg-slate-800 text-slate-400 border-white/10'
                          : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                      }`}
                    >
                      #{ln.id} ({ln.status})
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => openPassbook(m, 'deposit')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 shrink-0"
                >
                  + Add / Passbook
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Passbook & Withdrawal Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#0f172a] border border-white/15 rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-white/10 bg-slate-900/70 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FaCoins className="text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
                    Member Saving Passbook
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase mt-1">
                  {selectedMember.memberName}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedMember.memberNo || selectedMember.memberId} • {selectedMember.centerName}
                </p>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                <FaTimes size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6">
              {passbookLoading ? (
                <div className="flex justify-center py-16">
                  <FaSpinner className="animate-spin text-emerald-400" size={28} />
                </div>
              ) : passbookData ? (
                <>
                  {/* Balance Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4">
                      <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">Available Balance</p>
                      <p className="text-2xl font-black font-mono text-white mt-1">
                        ₹{Number(passbookData.summary?.availableBalance || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Saving In</p>
                      <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                        ₹{Number(passbookData.summary?.totalWeeklySaving || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Withdrawn</p>
                      <p className="text-xl font-black font-mono text-rose-400 mt-1">
                        ₹{Number(passbookData.summary?.totalWithdrawn || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Initial STP Paid</p>
                      <p className="text-xl font-black font-mono text-amber-400 mt-1">
                        ₹{Number(passbookData.summary?.totalSTP || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Manual Add / Withdrawal Form */}
                  <form onSubmit={handleSavingAction} className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="inline-flex bg-[#0a0f1c] p-1 rounded-xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => { setActionTab('deposit'); setActionAmount(''); setActionNotes(''); }}
                          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            actionTab === 'deposit'
                              ? 'bg-emerald-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          + Add Saving
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActionTab('withdraw'); setActionAmount(''); setActionNotes(''); }}
                          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            actionTab === 'withdraw'
                              ? 'bg-rose-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          - Withdraw
                        </button>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        Carry-forward balance across closed & active loans
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Loan Reference
                        </label>
                        <select
                          value={actionLoanId}
                          onChange={(e) => setActionLoanId(e.target.value)}
                          className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-emerald-500"
                        >
                          {(passbookData.loans || []).map((ln) => (
                            <option key={ln.id} value={ln.id}>
                              Loan #{ln.id} ({ln.status})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          {actionTab === 'deposit' ? 'Saving Deposit Amount (₹)' : 'Withdraw Amount (₹)'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={actionTab === 'withdraw' ? (passbookData.summary?.availableBalance || 0) : undefined}
                          placeholder={actionTab === 'deposit' ? 'e.g., 100' : `Max ₹${passbookData.summary?.availableBalance || 0}`}
                          value={actionAmount}
                          onChange={(e) => setActionAmount(e.target.value)}
                          className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Notes / Remarks
                        </label>
                        <input
                          type="text"
                          placeholder={actionTab === 'deposit' ? 'e.g., Manual weekly saving' : 'e.g., Full refund on settlement'}
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {actionTab === 'deposit' ? (
                        [50, 100, 200, 500].map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setActionAmount(String(preset))}
                            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-black font-mono text-emerald-300 border border-emerald-500/20"
                          >
                            +₹{preset}
                          </button>
                        ))
                      ) : (
                        <button
                          type="button"
                          disabled={(passbookData.summary?.availableBalance || 0) <= 0}
                          onClick={() => setActionAmount(String(passbookData.summary?.availableBalance || 0))}
                          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 border border-white/10 disabled:opacity-40"
                        >
                          Withdraw Full (₹{Number(passbookData.summary?.availableBalance || 0).toLocaleString()})
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={submittingAction || (actionTab === 'withdraw' && (passbookData.summary?.availableBalance || 0) <= 0)}
                        className={`px-6 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-40 flex items-center gap-2 ${
                          actionTab === 'deposit'
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-rose-600 hover:bg-rose-500'
                        }`}
                      >
                        {submittingAction && <FaSpinner className="animate-spin" />}
                        {actionTab === 'deposit' ? 'Add Saving Amount' : 'Confirm Withdrawal'}
                      </button>
                    </div>
                  </form>

                  {/* Transaction History */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FaHistory className="text-slate-400" size={12} />
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">
                        Transaction Ledger ({passbookData.transactions?.length || 0})
                      </h3>
                    </div>

                    {passbookData.transactions?.length > 0 ? (
                      <div className="space-y-2">
                        {[...passbookData.transactions].reverse().map((tx) => {
                          const style = formatTxStyle(tx.transaction_type);
                          return (
                            <div
                              key={tx.id}
                              className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-xl border ${style.badgeClass} mt-0.5`}>
                                  {style.icon}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase ${style.badgeClass}`}>
                                      {style.label}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Loan #{tx.loan_id} {tx.week_number ? `• Week ${tx.week_number}` : ''}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300 mt-1">{tx.notes || '-'}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {tx.created_at ? new Date(tx.created_at).toLocaleString('en-IN') : ''} {tx.created_by ? `• By ${tx.created_by}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-base font-black font-mono ${style.amountClass}`}>
                                  {style.amountPrefix}₹{Number(tx.amount || 0).toLocaleString()}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400">
                                  Bal: ₹{Number(tx.runningBalance || 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-6 text-center bg-white/5 rounded-2xl">
                        No saving ledger entries recorded yet for this member.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-rose-400 text-center py-8">Failed to load passbook details.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

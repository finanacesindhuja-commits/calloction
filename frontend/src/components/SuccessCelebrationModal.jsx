import React, { useEffect, useRef } from 'react';
import {
  FaCheckCircle, FaTrophy, FaExclamationCircle, FaWhatsapp,
  FaCoins, FaUsers, FaArrowRight, FaCheck
} from 'react-icons/fa';

export default function SuccessCelebrationModal({ notification, onClose }) {
  const canvasRef = useRef(null);

  const isSuccess = notification?.type === 'success';
  const isClosed = notification?.type === 'closed';
  const isCelebration = isSuccess || isClosed;

  // Confetti Physics Engine (Canvas-based, highly optimized for web and mobile)
  useEffect(() => {
    if (!isCelebration) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle Palette
    const colors = isClosed
      ? ['#fbbf24', '#f59e0b', '#d97706', '#fef08a', '#ffffff', '#10b981', '#38bdf8']
      : ['#10b981', '#34d399', '#059669', '#38bdf8', '#818cf8', '#fbbf24', '#f43f5e', '#ffffff'];

    const particles = [];
    const particleCount = 140;

    // Create 3 burst origins: bottom-left, bottom-center, bottom-right
    for (let i = 0; i < particleCount; i++) {
      let originX = width / 2;
      let angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // center upwards cone
      let speed = 12 + Math.random() * 16;

      if (i % 3 === 0) {
        originX = width * 0.15;
        angle = -Math.PI / 3 + (Math.random() - 0.5) * 0.8; // towards right
        speed = 14 + Math.random() * 18;
      } else if (i % 3 === 1) {
        originX = width * 0.85;
        angle = (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.8; // towards left
        speed = 14 + Math.random() * 18;
      }

      particles.push({
        x: originX,
        y: height * 0.85,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 7 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngle: Math.random() * Math.PI,
        tiltAngleInc: 0.05 + Math.random() * 0.08,
        gravity: 0.28 + Math.random() * 0.12,
        decay: 0.985,
        shape: Math.random() > 0.4 ? 'rect' : Math.random() > 0.5 ? 'circle' : 'star',
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: 1
      });
    }

    let startTime = performance.now();
    const duration = 4000; // 4 seconds total animation duration

    const render = (currentTime) => {
      const elapsed = currentTime - startTime;
      ctx.clearRect(0, 0, width, height);

      const fadeProgress = elapsed > 2800 ? (elapsed - 2800) / 1200 : 0;
      const globalAlpha = Math.max(0, 1 - fadeProgress);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= p.decay;
        p.vy *= p.decay;
        p.tiltAngle += p.tiltAngleInc;
        p.tilt = Math.sin(p.tiltAngle) * 12;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.globalAlpha = p.opacity * globalAlpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.tilt / 12));
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Sparkle star shape
          ctx.beginPath();
          for (let s = 0; s < 4; s++) {
            ctx.rotate(Math.PI / 2);
            ctx.lineTo(p.size, 0);
            ctx.lineTo(p.size * 0.2, p.size * 0.2);
          }
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < duration) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isCelebration, isClosed]);

  if (!notification) return null;

  const handleClose = () => {
    const action = notification.action;
    if (onClose) onClose();
    if (action) action();
  };

  const totalAmount = Number(notification.totalAmount) || 0;
  const emiAmount = Number(notification.emiAmount) || 0;
  const savingAmount = Number(notification.savingAmount) || 0;
  const memberCount = notification.memberCount || 0;
  const centerName = notification.centerName || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
      {/* Celebration Confetti Canvas overlay */}
      {isCelebration && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-50 w-full h-full"
        />
      )}

      {/* Main Celebration Modal Card */}
      <div
        className={`relative z-10 w-full max-w-lg rounded-[2.5rem] p-7 md:p-9 shadow-2xl border overflow-hidden animate-celebrate-pop my-auto ${
          isClosed
            ? 'bg-gradient-to-b from-[#1f1602] via-[#120e03] to-[#0a0f1c] border-amber-500/40 shadow-[0_0_60px_-15px_rgba(245,158,11,0.35)]'
            : isSuccess
            ? 'bg-gradient-to-b from-[#092219] via-[#091815] to-[#0a0f1c] border-emerald-500/40 shadow-[0_0_60px_-15px_rgba(16,185,129,0.35)]'
            : 'bg-[#0f172a] border-white/10 shadow-2xl'
        }`}
      >
        {/* Animated Top Glow Gradient Bar */}
        <div
          className={`absolute top-0 left-0 w-full h-1.5 ${
            isClosed
              ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500'
              : isSuccess
              ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500'
              : 'bg-gradient-to-r from-rose-500 to-red-500'
          }`}
        />

        {/* Ambient Glow in Background */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-40 ${
            isClosed ? 'bg-amber-500' : isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />

        {/* Header Icon Section with Concentric Radiating Rings */}
        <div className="relative flex items-center justify-center mb-6 pt-2">
          {/* Animated Concentric Radiating Rings for Celebration */}
          {isCelebration && (
            <>
              <div
                className={`absolute w-24 h-24 rounded-full border-2 animate-ripple-1 ${
                  isClosed ? 'border-amber-400/40' : 'border-emerald-400/40'
                }`}
              />
              <div
                className={`absolute w-24 h-24 rounded-full border-2 animate-ripple-2 ${
                  isClosed ? 'border-yellow-300/30' : 'border-teal-400/30'
                }`}
              />
              <div
                className={`absolute w-24 h-24 rounded-full border-2 animate-ripple-3 ${
                  isClosed ? 'border-amber-500/20' : 'border-emerald-500/20'
                }`}
              />
            </>
          )}

          {/* Center Badge Icon */}
          {isClosed ? (
            /* Loan Closed Trophy Badge */
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-xl border-2 border-yellow-200/50 animate-float-badge">
              <span className="text-4xl filter drop-shadow-md">🏆</span>
              <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-yellow-300 text-amber-950 text-[9px] font-black tracking-widest uppercase shadow">
                CLOSED
              </div>
            </div>
          ) : isSuccess ? (
            /* Animated Drawing SVG Checkmark Circle Badge */
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center border-2 border-emerald-400/40 shadow-inner">
              <svg className="w-20 h-20" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.15)"
                  strokeWidth="5"
                />
                {/* Animated Drawing Outer Circle */}
                <circle
                  className="animate-checkmark-circle"
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Animated Drawing Checkmark Path */}
                <path
                  className="animate-checkmark-check"
                  d="M 30 52 L 44 66 L 70 36"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : (
            /* Error Icon */
            <div className="w-20 h-20 rounded-3xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
              <FaExclamationCircle size={40} />
            </div>
          )}
        </div>

        {/* Modal Titles & Subtitle */}
        <div className="text-center relative z-10">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1.5 ${
              isClosed ? 'text-amber-400' : isSuccess ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isClosed ? 'LOAN SETTLEMENT COMPLETE' : isSuccess ? 'SUBMISSION SUCCESSFUL' : 'ACTION NOTICE'}
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {notification.title || (isClosed ? 'Loan Fully Settled! 🏆' : isSuccess ? 'Collection Tallied & Paid!' : 'Oops!')}
          </h2>
          <p className="text-xs md:text-sm text-slate-300/80 mt-2 leading-relaxed px-2">
            {notification.message}
          </p>
        </div>

        {/* Summary Card for Collections */}
        {totalAmount > 0 && (
          <div className="mt-6 bg-slate-900/80 border border-white/10 rounded-2xl p-5 shadow-inner space-y-3 relative z-10">
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Total Cash Recorded & Tallied
              </span>
              <div className="text-4xl md:text-5xl font-black font-mono tracking-tighter mt-1 bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                ₹{totalAmount.toLocaleString()}
              </div>
            </div>

            {/* Split pills: EMI & Saving */}
            {(emiAmount > 0 || savingAmount > 0) && (
              <div className="flex justify-center items-center gap-2 pt-1 flex-wrap">
                <span className="px-3 py-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  EMI: ₹{emiAmount.toLocaleString()}
                </span>
                <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                  <FaCoins size={10} />
                  Saving: ₹{savingAmount.toLocaleString()}
                </span>
              </div>
            )}

            {/* Center & Member metadata pill */}
            {(centerName || memberCount > 0) && (
              <div className="text-center text-[11px] font-bold text-slate-400 pt-1 border-t border-white/5">
                {memberCount > 0 && <span>{memberCount} Members • </span>}
                {centerName && <span>{centerName}</span>}
              </div>
            )}
          </div>
        )}

        {/* WhatsApp Auto-Bill Dispatch Notice Banner */}
        {isSuccess && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-3.5 flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FaWhatsapp size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  Automated WhatsApp Bills Sent
                </p>
              </div>
              <p className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                Detailed bill receipt with remaining balance delivered.
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 relative z-10 flex gap-3">
          {notification.actionBtn ? (
            <>
              <button
                onClick={() => {
                  const action = notification.action;
                  if (onClose) onClose();
                  if (action) action();
                }}
                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 relative overflow-hidden ${
                  isClosed
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black shadow-amber-500/20'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black shadow-emerald-500/20'
                }`}
              >
                <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 animate-shimmer-sweep pointer-events-none" />
                <span className="relative z-10 flex items-center gap-2">
                  <FaCheck size={13} />
                  {notification.actionBtn}
                </span>
              </button>
              <button
                onClick={() => {
                  if (onClose) onClose();
                }}
                className="py-4 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider transition-all"
              >
                Close
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 relative overflow-hidden group ${
                isClosed
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black shadow-amber-500/20'
                  : isSuccess
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black shadow-emerald-500/20'
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
              }`}
            >
              {/* Shimmer sweep effect */}
              <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 animate-shimmer-sweep pointer-events-none" />
              <span className="relative z-10 flex items-center gap-2">
                <FaCheck size={13} />
                {isClosed ? 'Awesome! Loan Closed ✓' : isSuccess ? 'Done, Continue to Centers ✓' : 'Dismiss'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

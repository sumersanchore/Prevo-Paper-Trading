import React, { useState } from 'react';
import { X, Wallet, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR } from '../../lib/utils.js';

export const WalletModal: React.FC = () => {
  const { wallet, isWalletModalOpen, setWalletModalOpen, resetWallet } = useTradingStore();
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isWalletModalOpen) return null;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetWallet();
      setSuccessMsg('Paper funds reset to ₹10,00,000 successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-groww-card border border-groww-border rounded-2xl p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-groww-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00D09C]/10 border border-[#00D09C]/20 flex items-center justify-center text-[#00D09C]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Paper Trading Wallet</h3>
              <p className="text-xs text-groww-textSubtle">Equity & F&O Margin Management</p>
            </div>
          </div>
          <button
            onClick={() => setWalletModalOpen(false)}
            className="p-1.5 rounded-lg text-groww-textMuted hover:text-white hover:bg-groww-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-[#00D09C]/30 text-[#00D09C] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Balance Overview Card */}
        <div className="mt-5 p-4 rounded-xl bg-groww-surface border border-groww-border/80">
          <div className="text-xs text-groww-textSubtle">Available to Trade</div>
          <div className="text-2xl font-black text-white font-mono-num mt-1">
            {formatINR(wallet?.availableMargin ?? 1000000)}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-groww-textMuted pt-3 border-t border-groww-border">
            <span>Currency</span>
            <span className="font-semibold text-white">INR (₹)</span>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between p-3 rounded-lg bg-groww-surface/50 border border-groww-border text-xs">
            <span className="text-groww-textMuted">Cash Balance</span>
            <span className="font-bold text-white font-mono-num">
              {formatINR(wallet?.cashBalance ?? 1000000)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-groww-surface/50 border border-groww-border text-xs">
            <span className="text-groww-textMuted">Utilized Margin (Blocked)</span>
            <span className="font-bold text-[#EB5B5B] font-mono-num">
              {formatINR(wallet?.utilizedMargin ?? 0)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-groww-surface/50 border border-groww-border text-xs">
            <span className="text-groww-textMuted">Pledge Margin</span>
            <span className="font-bold text-white font-mono-num">
              {formatINR(wallet?.pledgeMargin ?? 0)}
            </span>
          </div>
        </div>

        {/* Notice Info */}
        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Paper trading funds are simulated for practicing options trading risk-free.
          </span>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-groww-surface hover:bg-groww-hover text-white text-xs font-semibold border border-groww-border transition-all active:scale-98 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Reset Margin (₹10 Lakhs)</span>
          </button>
          <button
            onClick={() => setWalletModalOpen(false)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-bold transition-all shadow-lg shadow-emerald-950/30"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

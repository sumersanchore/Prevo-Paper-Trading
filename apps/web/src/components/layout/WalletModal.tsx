import React, { useState } from 'react';
import {
  X,
  Wallet,
  RefreshCw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Zap,
  Clock,
  BarChart3,
  Search,
} from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { useToast } from '../ui/Toast.js';
import { formatINR } from '../../lib/utils.js';
import type { WalletTransactionEntity } from '@trademitra/shared';

type TabId = 'overview' | 'transactions';

const TXN_META: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }>; colorClass: string; bg: string }
> = {
  BUY_DEBIT: {
    label: 'Buy Premium Debit',
    icon: ArrowDownLeft,
    colorClass: 'text-[#d93838]',
    bg: 'bg-rose-50 border-rose-200',
  },
  SELL_CREDIT: {
    label: 'Sell Premium Credit',
    icon: ArrowUpRight,
    colorClass: 'text-[#008f6b]',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  MARGIN_BLOCK: {
    label: 'SPAN Margin Blocked',
    icon: TrendingDown,
    colorClass: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  MARGIN_RELEASE: {
    label: 'SPAN Margin Released',
    icon: TrendingUp,
    colorClass: 'text-sky-600',
    bg: 'bg-sky-50 border-sky-200',
  },
  RESET: {
    label: 'Virtual Funds Reset',
    icon: Zap,
    colorClass: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200',
  },
  ADJUSTMENT: {
    label: 'Wallet Adjustment',
    icon: BarChart3,
    colorClass: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200',
  },
};

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TransactionRowProps {
  txn: WalletTransactionEntity;
}

const TransactionRow: React.FC<TransactionRowProps> = ({ txn }) => {
  const meta = TXN_META[txn.type] ?? TXN_META['ADJUSTMENT']!;
  const Icon = meta.icon;
  const isCredit = txn.direction === 'CREDIT';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/80 transition-all shadow-2xs">
      {/* Left: Icon & Details */}
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center border ${meta.bg}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${meta.colorClass} stroke-[2.5]`} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
              {meta.label}
            </span>
            {txn.orderId && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600 shrink-0">
                Ord #{txn.orderId}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 line-clamp-2 mt-0.5 leading-snug">
            {txn.description}
          </p>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(txn.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Right: Amount & Running Balance */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
        <div
          className={`text-sm sm:text-base font-black font-mono-num ${isCredit ? 'text-[#008f6b]' : 'text-[#d93838]'
            }`}
        >
          {isCredit ? '+' : '−'}
          {formatINR(txn.amount)}
        </div>
        {txn.balanceAfter !== undefined && (
          <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 font-mono-num mt-0.5">
            Bal: <span className="text-slate-800">{formatINR(txn.balanceAfter)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const WalletModal: React.FC = () => {
  const toast = useToast();
  const {
    wallet,
    transactions,
    isWalletModalOpen,
    setWalletModalOpen,
    resetWallet,
    fetchWalletTransactions,
  } = useTradingStore();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [txnFilter, setTxnFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  if (!isWalletModalOpen) return null;

  const available = wallet?.availableMargin ?? 1000000;
  const cash = wallet?.cashBalance ?? 1000000;
  const utilized = wallet?.utilizedMargin ?? 0;
  const pledge = wallet?.pledgeMargin ?? 0;
  const total = cash + pledge;

  // Utilization percentage for the ring
  const utilPct = total > 0 ? Math.min(100, (utilized / total) * 100) : 0;
  const circumference = 2 * Math.PI * 36; // r=36
  const dashOffset = circumference * (1 - utilPct / 100);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetWallet();
      toast.success('Funds Reset Successfully', 'Your paper trading wallet is reset to ₹10,00,000');
    } catch (err: any) {
      toast.error('Reset Failed', err?.message || 'Could not reset wallet.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'transactions') {
      fetchWalletTransactions();
    }
  };

  // Filtered transactions
  const filteredTxns = transactions.filter((t) => {
    if (txnFilter === 'CREDIT' && t.direction !== 'CREDIT') return false;
    if (txnFilter === 'DEBIT' && t.direction !== 'DEBIT') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchOrder = t.orderId && t.orderId.toLowerCase().includes(q);
      const matchType = t.type.toLowerCase().includes(q);
      return matchDesc || matchOrder || matchType;
    }
    return true;
  });

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Wallet Overview' },
    { id: 'transactions', label: `Passbook & Ledger (${transactions.length})` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5 text-[#008f6b]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                Paper Trading Wallet
              </h3>
              <p className="text-[11px] font-semibold text-slate-500">Margin & Transaction History</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWalletModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-0 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`px-3.5 py-2 text-xs font-black rounded-t-xl transition-all cursor-pointer ${activeTab === tab.id
                  ? 'text-slate-900 bg-slate-100 border-b-2 border-[#00D09C]'
                  : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Thin divider */}
        <div className="h-px mx-5 bg-slate-100 shrink-0" />

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="px-5 pb-5 pt-4 space-y-4 overflow-y-auto">
            {/* Ring + Available Margin Hero */}
            <div className="rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 bg-slate-50 border border-slate-200">
              {/* SVG Ring */}
              <div className="relative shrink-0 w-20 h-20">
                <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90" aria-hidden="true">
                  <circle cx="44" cy="44" r="36" fill="none" stroke="#E2E8F0" strokeWidth="8" />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    fill="none"
                    stroke="#00D09C"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">Used</span>
                  <span className="text-xs font-black text-slate-800 leading-tight">
                    {utilPct.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Amount Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Available to Trade
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-num tracking-tight mt-0.5 truncate">
                  {formatINR(available)}
                </div>
                <div className="text-[11px] font-bold text-slate-500 mt-1">
                  Total Capital: <span className="text-slate-800 font-extrabold">{formatINR(total)}</span>
                </div>
              </div>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Available Margin', value: available, color: 'text-slate-900', badge: 'Ready' },
                { label: 'Utilized Margin', value: utilized, color: 'text-amber-600', badge: 'Blocked' },
                { label: 'Opening Cash', value: cash, color: 'text-slate-700', badge: 'Free' },
                { label: 'Collateral Pledge', value: pledge, color: 'text-slate-700', badge: 'Pledge' },
              ].map(({ label, value, color, badge }) => (
                <div
                  key={label}
                  className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>{label}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-100 text-slate-600">
                      {badge}
                    </span>
                  </div>
                  <div className={`text-sm sm:text-base font-black font-mono-num ${color} mt-1.5 truncate`}>
                    {formatINR(value)}
                  </div>
                </div>
              ))}
            </div>

            {/* Info notice */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-800 leading-relaxed font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <span>
                All transactions are executed against strict real-market margin rules with instant row-level ledger verification.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-[#008f6b]' : ''}`} />
                <span>Reset to ₹10,00,000</span>
              </button>
              <button
                type="button"
                onClick={() => setWalletModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl text-black text-xs font-black bg-[#00D09C] hover:bg-[#00B386] transition-all shadow-xs active:scale-[0.97] cursor-pointer text-center"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── TRANSACTIONS / PASSBOOK TAB ── */}
        {activeTab === 'transactions' && (
          <div className="px-4 pb-4 pt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Search & Filter Bar */}
            <div className="space-y-2 mb-3 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Order ID, Symbol, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#00D09C] focus:outline-none transition-all"
                />
              </div>

              {/* Filter Pills: All | Credits | Debits */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {(['ALL', 'CREDIT', 'DEBIT'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTxnFilter(f)}
                      className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer ${txnFilter === f
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                    >
                      {f === 'ALL' ? 'All' : f === 'CREDIT' ? 'Credits (+)' : 'Debits (−)'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => fetchWalletTransactions()}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Refresh Passbook"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 styled-scrollbar">
              {filteredTxns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-800">No Transaction Records Found</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                    Orders and portfolio exits will automatically create immutable debit and credit entries.
                  </p>
                </div>
              ) : (
                filteredTxns.map((txn) => <TransactionRow key={txn.id} txn={txn} />)
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between shrink-0">
              <div className="text-[11px] font-bold text-slate-400">
                Showing <span className="text-slate-900 font-extrabold">{filteredTxns.length}</span> of{' '}
                <span className="text-slate-900 font-extrabold">{transactions.length}</span> records
              </div>
              <button
                type="button"
                onClick={() => setWalletModalOpen(false)}
                className="px-5 py-1.5 rounded-xl text-black text-xs font-black bg-[#00D09C] hover:bg-[#00B386] transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

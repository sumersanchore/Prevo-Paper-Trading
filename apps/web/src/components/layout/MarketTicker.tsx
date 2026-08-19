import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatNumber } from '../../lib/utils.js';

// Maps the display symbol name → API symbol and URL slug
const SYMBOL_MAP: Record<string, { symbol: string; slug: string }> = {
  'NIFTY 50': { symbol: 'NIFTY', slug: 'nifty50' },
  'NIFTY': { symbol: 'NIFTY', slug: 'nifty50' },
  'BANK NIFTY': { symbol: 'BANKNIFTY', slug: 'banknifty' },
  'BANKNIFTY': { symbol: 'BANKNIFTY', slug: 'banknifty' },
  'SENSEX': { symbol: 'SENSEX', slug: 'sensex' },
  'BSE SENSEX': { symbol: 'SENSEX', slug: 'sensex' },
  'FIN NIFTY': { symbol: 'FINNIFTY', slug: 'finnifty' },
  'FINNIFTY': { symbol: 'FINNIFTY', slug: 'finnifty' },
  'MIDCAP NIFTY': { symbol: 'MIDCPNIFTY', slug: 'midcpnifty' },
  'MIDCPNIFTY': { symbol: 'MIDCPNIFTY', slug: 'midcpnifty' },
  'BANKEX': { symbol: 'BANKEX', slug: 'bankex' },
};

export const MarketTicker: React.FC = () => {
  const { indices, setActiveTab, fetchOptionChain } = useTradingStore();

  const handleCardClick = async (idxSymbol: string) => {
    const item = SYMBOL_MAP[idxSymbol] ?? {
      symbol: idxSymbol,
      slug: idxSymbol.toLowerCase().replace(/\s+/g, ''),
    };

    const url = `/options/${item.slug}`;
    if (window.location.pathname !== url) {
      window.history.pushState({ symbol: item.symbol }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    setActiveTab('option-chain');
    await fetchOptionChain(item.symbol);
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200 py-2 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 sm:gap-4 min-w-max">
          {indices.map((idx) => {
            const isPositive = idx.change >= 0;
            return (
              <div
                key={idx.symbol}
                onClick={() => handleCardClick(idx.symbol)}
                className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#00D09C] hover:shadow-sm px-3 py-1.5 rounded-xl transition-all cursor-pointer select-none active:scale-95 shadow-xs group"
                title={`Open ${idx.name} Option Chain (/options/${SYMBOL_MAP[idx.symbol]?.slug || 'nifty50'})`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#008f6b] transition-colors tracking-tight">
                    {idx.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 font-mono-num">
                    {formatNumber(idx.ltp)}
                  </span>
                  <div
                    className={`flex items-center gap-0.5 text-[11px] font-bold font-mono-num px-1.5 py-0.5 rounded-md ${
                      isPositive
                        ? 'bg-emerald-50 text-[#008f6b] border border-emerald-200/60'
                        : 'bg-rose-50 text-[#d93838] border border-rose-200/60'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 stroke-[2.5]" />
                    ) : (
                      <TrendingDown className="w-3 h-3 stroke-[2.5]" />
                    )}
                    <span>
                      {isPositive ? '+' : ''}
                      {formatNumber(idx.change)} ({isPositive ? '+' : ''}
                      {formatNumber(idx.pChange)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Market Status Pill */}
        <div className="hidden sm:flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-full text-[11px] font-medium min-w-max shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-600 font-semibold">Real NSE/BSE Market Feed</span>
        </div>
      </div>
    </div>
  );
};

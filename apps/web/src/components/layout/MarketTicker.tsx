import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatNumber } from '../../lib/utils.js';

// Maps the display symbol name → API symbol used in fetchOptionChain
const SYMBOL_MAP: Record<string, string> = {
  'NIFTY 50': 'NIFTY',
  'BANK NIFTY': 'BANKNIFTY',
  'SENSEX': 'SENSEX',
};

export const MarketTicker: React.FC = () => {
  const { indices, setActiveTab, fetchOptionChain } = useTradingStore();

  const handleCardClick = async (idxSymbol: string) => {
    const apiSymbol = SYMBOL_MAP[idxSymbol] ?? 'NIFTY';
    await fetchOptionChain(apiSymbol);
    setActiveTab('option-chain');
  };

  return (
    <div className="bg-[#0f111a] border-b border-groww-border py-2 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-6 min-w-max">
          {indices.map((idx) => {
            const isPositive = idx.change >= 0;
            return (
              <div
                key={idx.symbol}
                onClick={() => handleCardClick(idx.symbol)}
                className="flex items-center gap-3 bg-groww-card/80 hover:bg-groww-surface border border-groww-border px-3.5 py-1.5 rounded-lg transition-all cursor-pointer select-none active:scale-95"
                title={`View ${idx.name} Option Chain`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white tracking-tight">
                    {idx.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white font-mono-num">
                    {formatNumber(idx.ltp)}
                  </span>
                  <div
                    className={`flex items-center gap-0.5 text-[11px] font-semibold font-mono-num px-1.5 py-0.5 rounded ${isPositive
                        ? 'bg-groww-greenBg text-[#00D09C]'
                        : 'bg-groww-redBg text-[#EB5B5B]'
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
        <div className="hidden sm:flex items-center gap-2 bg-[#1A1E2C] border border-groww-border px-2.5 py-1 rounded-full text-[11px] font-medium min-w-max">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-gray-300">Market Closed • Real NSE/BSE Close Data</span>
        </div>
      </div>
    </div>
  );
};

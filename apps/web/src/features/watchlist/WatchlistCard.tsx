import React from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatNumber } from '../../lib/utils.js';
import { TrendingUp, TrendingDown, Plus, Sparkles } from 'lucide-react';

export const WatchlistCard: React.FC = () => {
  const { optionChain, openOrderPad } = useTradingStore();

  const mockWatchlist = [
    {
      symbol: 'NIFTY 50',
      type: 'INDEX',
      ltp: optionChain?.spotPrice ?? 24512.40,
      change: 42.40,
      pChange: 0.17,
    },
    {
      symbol: 'RELIANCE',
      type: 'EQUITY',
      ltp: 2980.50,
      change: 18.20,
      pChange: 0.61,
    },
    {
      symbol: 'HDFCBANK',
      type: 'EQUITY',
      ltp: 1640.80,
      change: -6.40,
      pChange: -0.39,
    },
    {
      symbol: 'TCS',
      type: 'EQUITY',
      ltp: 4120.00,
      change: 24.50,
      pChange: 0.60,
    },
    {
      symbol: 'INFY',
      type: 'EQUITY',
      ltp: 1890.30,
      change: -12.10,
      pChange: -0.64,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00D09C]" />
          <span>Market Watchlist</span>
        </h3>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-groww-surface hover:bg-groww-hover border border-groww-border text-white text-xs font-semibold transition-colors">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Symbol</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockWatchlist.map((item) => {
          const isPos = item.change >= 0;
          return (
            <div
              key={item.symbol}
              className="p-4 rounded-2xl bg-groww-card border border-groww-border hover:border-groww-borderLight transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#00D09C] transition-colors">
                    {item.symbol}
                  </h4>
                  <span className="text-[10px] text-groww-textSubtle">{item.type} • NSE</span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-bold font-mono-num px-2 py-0.5 rounded ${
                    isPos ? 'bg-groww-greenBg text-[#00D09C]' : 'bg-groww-redBg text-[#EB5B5B]'
                  }`}
                >
                  {isPos ? (
                    <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>
                    {isPos ? '+' : ''}
                    {formatNumber(item.pChange)}%
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between mt-3 pt-3 border-t border-groww-border/60">
                <div>
                  <div className="text-[10px] text-groww-textSubtle">LTP</div>
                  <div className="text-base font-extrabold text-white font-mono-num">
                    ₹{formatNumber(item.ltp)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (optionChain?.chain[2]?.ce) {
                        openOrderPad({
                          contractId: optionChain.chain[2].ce.contractId,
                          tradingSymbol: optionChain.chain[2].ce.tradingSymbol,
                          symbol: 'NIFTY',
                          strikePrice: optionChain.chain[2].strikePrice,
                          optionType: 'CE',
                          lotSize: 25,
                          ltp: optionChain.chain[2].ce.ltp,
                          defaultAction: 'BUY',
                        });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#00D09C]/15 hover:bg-[#00D09C] text-[#00D09C] hover:text-black text-xs font-bold transition-colors"
                  >
                    B
                  </button>
                  <button
                    onClick={() => {
                      if (optionChain?.chain[2]?.ce) {
                        openOrderPad({
                          contractId: optionChain.chain[2].ce.contractId,
                          tradingSymbol: optionChain.chain[2].ce.tradingSymbol,
                          symbol: 'NIFTY',
                          strikePrice: optionChain.chain[2].strikePrice,
                          optionType: 'CE',
                          lotSize: 25,
                          ltp: optionChain.chain[2].ce.ltp,
                          defaultAction: 'SELL',
                        });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#EB5B5B]/15 hover:bg-[#EB5B5B] text-[#EB5B5B] hover:text-white text-xs font-bold transition-colors"
                  >
                    S
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

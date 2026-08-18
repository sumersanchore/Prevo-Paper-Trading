import React from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR, formatNumber } from '../../lib/utils.js';
import { TrendingUp, TrendingDown, Layers, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export const PositionsList: React.FC = () => {
  const { positionsSummary, exitPosition, setActiveTab } = useTradingStore();

  if (!positionsSummary || positionsSummary.positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-groww-card border border-groww-border rounded-2xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-groww-surface border border-groww-border flex items-center justify-center text-groww-textMuted mb-4">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">No Open Positions</h3>
        <p className="text-xs text-groww-textSubtle max-w-sm mb-6">
          You don't have any active F&O positions. Open the Option Chain to place your first paper trade.
        </p>
        <button
          onClick={() => setActiveTab('option-chain')}
          className="py-2.5 px-6 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-bold transition-all shadow-lg shadow-emerald-950/30 flex items-center gap-2"
        >
          <span>Explore Option Chain</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const { positions, totalRealizedPnl, totalUnrealizedPnl, netPnl } = positionsSummary;
  const isNetPositive = netPnl >= 0;

  const openPositions = positions.filter((p) => p.status === 'OPEN' && p.netQuantity !== 0);
  const closedPositions = positions.filter((p) => p.status === 'CLOSED' || p.netQuantity === 0);

  return (
    <div className="space-y-6">
      {/* PnL Summary Dashboard Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-gradient-to-br from-groww-card to-groww-surface border border-groww-border shadow-xl">
        <div className="p-4 rounded-xl bg-groww-card/80 border border-groww-border">
          <div className="text-xs text-groww-textSubtle">Total Unrealized P&L</div>
          <div
            className={`text-xl font-black font-mono-num mt-1 flex items-center gap-1 ${
              totalUnrealizedPnl >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
            }`}
          >
            {totalUnrealizedPnl >= 0 ? '+' : ''}
            {formatINR(totalUnrealizedPnl)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-groww-card/80 border border-groww-border">
          <div className="text-xs text-groww-textSubtle">Total Realized P&L</div>
          <div
            className={`text-xl font-black font-mono-num mt-1 flex items-center gap-1 ${
              totalRealizedPnl >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
            }`}
          >
            {totalRealizedPnl >= 0 ? '+' : ''}
            {formatINR(totalRealizedPnl)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-groww-card/80 border border-groww-border">
          <div className="text-xs text-groww-textSubtle">Total Net P&L</div>
          <div
            className={`text-2xl font-black font-mono-num mt-1 flex items-center gap-1 ${
              isNetPositive ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
            }`}
          >
            {isNetPositive ? (
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <TrendingDown className="w-5 h-5 stroke-[2.5]" />
            )}
            <span>
              {isNetPositive ? '+' : ''}
              {formatINR(netPnl)}
            </span>
          </div>
        </div>
      </div>

      {/* Open Positions List */}
      <div className="rounded-2xl border border-groww-border bg-groww-card overflow-hidden shadow-xl">
        <div className="p-4 border-b border-groww-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Open Positions</span>
            <span className="text-[11px] bg-groww-surface border border-groww-border px-2 py-0.5 rounded-full text-groww-textMuted">
              {openPositions.length} Active
            </span>
          </h3>
        </div>

        {openPositions.length === 0 ? (
          <div className="py-10 text-center text-xs text-groww-textSubtle">
            All positions have been squared off.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-groww-surface/60 border-b border-groww-border text-groww-textSubtle font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Net Qty</th>
                  <th className="py-3 px-4 text-right">Avg Price</th>
                  <th className="py-3 px-4 text-right">LTP (₹)</th>
                  <th className="py-3 px-4 text-right">Current Value</th>
                  <th className="py-3 px-4 text-right">P&L (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-groww-border/40 font-mono-num">
                {openPositions.map((pos) => {
                  const isPosProfit = pos.totalPnl >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-groww-hover/50 transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{pos.tradingSymbol}</span>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              pos.optionType === 'CE'
                                ? 'bg-emerald-500/20 text-[#00D09C]'
                                : 'bg-rose-500/20 text-[#EB5B5B]'
                            }`}
                          >
                            {pos.optionType}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-groww-textMuted">{pos.productType}</td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          pos.netQuantity > 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
                        }`}
                      >
                        {pos.netQuantity > 0 ? `+${pos.netQuantity}` : pos.netQuantity}
                      </td>
                      <td className="py-3 px-4 text-right text-white">
                        ₹{formatNumber(pos.averageBuyPrice || pos.averageSellPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        ₹{formatNumber(pos.ltp)}
                      </td>
                      <td className="py-3 px-4 text-right text-groww-textMuted">
                        ₹{formatNumber(pos.currentValue)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-extrabold ${
                          isPosProfit ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
                        }`}
                      >
                        {isPosProfit ? '+' : ''}
                        {formatINR(pos.totalPnl)}
                        <span className="block text-[10px] font-medium opacity-80">
                          ({isPosProfit ? '+' : ''}
                          {formatNumber(pos.pnlPercentage)}%)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <button
                          onClick={() => exitPosition(pos)}
                          className="px-3 py-1 rounded-lg bg-groww-surface hover:bg-rose-500/20 border border-groww-border text-white text-xs font-bold transition-all hover:border-rose-500/60 hover:text-[#EB5B5B] shadow-sm"
                          title="Instant Market Exit at Current Price"
                        >
                          Exit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Positions History */}
      {closedPositions.length > 0 && (
        <div className="rounded-2xl border border-groww-border bg-groww-card/60 p-4 shadow-lg">
          <h4 className="text-xs font-bold text-groww-textMuted mb-3 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-groww-textSubtle" />
            <span>Closed Positions</span>
          </h4>
          <div className="space-y-2">
            {closedPositions.map((pos) => (
              <div
                key={pos.id}
                className="flex items-center justify-between p-3 rounded-xl bg-groww-surface/50 border border-groww-border text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">{pos.tradingSymbol}</span>
                  <span className="text-[10px] text-groww-textSubtle">{pos.productType}</span>
                </div>
                <div className="flex items-center gap-4 font-mono-num">
                  <span className="text-groww-textSubtle">Realized PnL:</span>
                  <span
                    className={`font-bold ${
                      pos.realizedPnl >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
                    }`}
                  >
                    {pos.realizedPnl >= 0 ? '+' : ''}
                    {formatINR(pos.realizedPnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR, formatNumber } from '../../lib/utils.js';
import { ActivePositionModal } from './ActivePositionModal.js';
import {
  Layers,
  ArrowUpRight,
  Plus,
  Target,
  Zap,
  SlidersHorizontal,
  TrendingUp,
  LogOut,
  Shield,
  X,
  TrendingDown,
  Check,
} from 'lucide-react';

export const PositionsList: React.FC = () => {
  const {
    positionsSummary,
    setActiveTab,
    openOrderPad,
    exitAllPositions,
    placeOrder,
    isLoading,
  } = useTradingStore();

  const [selectedPositionForDetail, setSelectedPositionForDetail] = useState<any | null>(null);
  const [isInstantExitingId, setIsInstantExitingId] = useState<string | null>(null);
  const [isExitingAll, setIsExitingAll] = useState(false);

  // Filter state (Open, Closed, All)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Safe Exit Modal State
  const [isSafeExitModalOpen, setIsSafeExitModalOpen] = useState(false);
  const [safeMaxLoss, setSafeMaxLoss] = useState<string>('2000');
  const [safeTargetProfit, setSafeTargetProfit] = useState<string>('5000');
  const [safeExitActive, setSafeExitActive] = useState(false);
  const [safeExitMsg, setSafeExitMsg] = useState('');


  // Skeleton loader while loading
  if (isLoading && !positionsSummary) {
    return (
      <div className="space-y-4 animate-pulse max-w-xl mx-auto">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="h-3 w-28 bg-slate-100 rounded"></div>
          <div className="h-8 w-44 bg-slate-200 rounded"></div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-2xl border border-slate-100"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!positionsSummary || positionsSummary.positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-white border border-slate-200 rounded-3xl text-center shadow-xs max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-2xs">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">No Positions Found</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-6">
          You don't have any active or closed positions for today. Open the Option Chain to trade.
        </p>
        <button
          onClick={() => setActiveTab('option-chain')}
          className="py-2.5 px-6 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-black transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <span>Explore Option Chain</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const { positions, netPnl } = positionsSummary;
  const isNetPositive = netPnl >= 0;

  const openPositions = positions.filter((p) => p.status === 'OPEN' && p.netQuantity !== 0);
  const closedPositions = positions.filter((p) => p.status === 'CLOSED' || p.netQuantity === 0);

  // Active trades on TOP, closed below
  const sortedAll = [...positions].sort((a, b) => {
    const aOpen = a.status === 'OPEN' && a.netQuantity !== 0;
    const bOpen = b.status === 'OPEN' && b.netQuantity !== 0;
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    return 0;
  });

  const displayedPositions =
    activeFilter === 'OPEN'
      ? openPositions
      : activeFilter === 'CLOSED'
        ? closedPositions
        : sortedAll;

  // Quick Add Lots / Re-Trade -> opens Groww Order Pad Modal (BUY/SELL Popup) without placing instant order
  const handleOpenOrderPad = (pos: any, defaultSide: 'BUY' | 'SELL' = 'BUY', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isLong = pos.netQuantity >= 0;
    const action = (pos.status === 'CLOSED' || pos.netQuantity === 0) ? defaultSide : (isLong ? 'BUY' : 'SELL');
    const lotSize = pos.lotSize || 25;
    const ltp = Number(pos.ltp) || Number(pos.averageBuyPrice) || Number(pos.averageSellPrice) || 100;

    openOrderPad({
      contractId: pos.contractId,
      tradingSymbol: pos.tradingSymbol,
      symbol: pos.symbol || 'NIFTY',
      strikePrice: pos.strikePrice || 24000,
      optionType: pos.optionType || (pos.tradingSymbol.endsWith('PE') ? 'PE' : 'CE'),
      lotSize: lotSize,
      ltp: ltp,
      defaultAction: action,
      defaultProductType: pos.productType || 'NRML',
      defaultLots: 1,
    });
  };

  // 1-Click Instant Market Exit
  const handleExecuteExit = async (pos: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsInstantExitingId(pos.id);
    const isLong = pos.netQuantity > 0;
    const reverseAction = isLong ? 'SELL' : 'BUY';
    const qty = Math.abs(pos.netQuantity);

    try {
      await placeOrder({
        contractId: pos.contractId,
        orderType: 'MARKET',
        transactionType: reverseAction,
        productType: pos.productType,
        quantity: qty,
      });
    } catch (err: any) {
      console.error('Instant exit failed:', err);
    } finally {
      setIsInstantExitingId(null);
    }
  };

  // Instant 1-Click Exit All
  const handleExecuteExitAll = async () => {
    if (openPositions.length === 0) return;
    setIsExitingAll(true);
    try {
      await exitAllPositions();
    } catch (err: any) {
      console.error('Exit all failed:', err);
    } finally {
      setIsExitingAll(false);
    }
  };

  const handleCardClick = (pos: any) => {
    // Open Complete Active F&O Position Screen / Modal
    setSelectedPositionForDetail(pos);
  };

  // Format clean symbol: NIFTY 06 Feb 23500 Call
  const formatDisplaySymbol = (sym: string) => {
    let clean = sym.replace(/_/g, ' ');
    if (clean.endsWith(' CE')) clean = clean.replace(/ CE$/, ' Call');
    else if (clean.endsWith(' PE')) clean = clean.replace(/ PE$/, ' Put');
    return clean;
  };

  return (
    <div className="space-y-3 font-sans max-w-xl mx-auto select-none">
      {/* ── 1. GROWW EXACT TOTAL RETURNS CARD ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Total returns</div>
            <div
              className={`text-2xl sm:text-[28px] font-extrabold font-mono-num tracking-tight mt-0.5 ${
                isNetPositive ? 'text-[#008f6b]' : 'text-[#d93838]'
              }`}
            >
              {isNetPositive ? '+' : ''}
              {formatINR(netPnl)}
            </div>
          </div>

          {/* Set Safe Exit link with Shield icon */}
          <button
            type="button"
            onClick={() => setIsSafeExitModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border-b border-dotted border-slate-400 pb-0.5 cursor-pointer transition-colors"
          >
            <span>{safeExitActive ? 'Safe Exit ON' : 'Set Safe Exit'}</span>
            <Shield className={`w-3.5 h-3.5 ${safeExitActive ? 'text-[#008f6b]' : 'text-slate-600'}`} />
          </button>
        </div>
      </div>

      {/* ── 2. SUB-TOOLBAR (Filters on Left, Chart + Exit on Right) ── */}
      <div className="flex items-center justify-between gap-2 px-1 relative">
        {/* Left: Filters Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterDropdown((prev) => !prev)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer active:scale-95"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span>
              {activeFilter === 'ALL' ? 'Filters' : activeFilter === 'OPEN' ? 'Open' : 'Closed'}
            </span>
          </button>

          {/* Dropdown for Filters */}
          {showFilterDropdown && (
            <div className="absolute left-0 top-full mt-1.5 w-36 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-1 font-sans animate-fadeIn">
              {(['ALL', 'OPEN', 'CLOSED'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setActiveFilter(f);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-3.5 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                    activeFilter === f ? 'text-[#008f6b] bg-emerald-50/50' : 'text-slate-700'
                  }`}
                >
                  <span>{f === 'ALL' ? `All (${positions.length})` : f === 'OPEN' ? `Open (${openPositions.length})` : `Closed (${closedPositions.length})`}</span>
                  {activeFilter === f && <Check className="w-3 h-3 text-[#008f6b]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Chart Icon + Exit All Button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('option-chain')}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Option Chain"
          >
            <TrendingUp className="w-4 h-4" />
          </button>

          {openPositions.length > 0 && (
            <button
              type="button"
              disabled={isExitingAll}
              onClick={handleExecuteExitAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-600 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Square Off All Open Positions"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isExitingAll ? 'Exiting...' : 'Exit'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3. POSITIONS LIST CARDS ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
        {displayedPositions.length === 0 ? (
          <div className="p-10 text-center text-xs font-medium text-slate-400">
            No positions in {activeFilter.toLowerCase()} filter.
          </div>
        ) : (
          displayedPositions.map((pos) => {
            const isOpen = pos.status === 'OPEN' && pos.netQuantity !== 0;
            const isProfit = pos.totalPnl >= 0;
            const isLong = pos.netQuantity > 0;
            const qty = Math.abs(pos.netQuantity);
            const isExitingThis = isInstantExitingId === pos.id;
            const lotSize = pos.lotSize || 25;
            const lots = Math.max(1, Math.round(qty / lotSize));
            const buyPrice = pos.averageBuyPrice || 0;
            const sellPrice = pos.averageSellPrice || 0;
            const avgPrice = isLong ? (buyPrice || pos.averagePrice || 0) : (sellPrice || buyPrice || pos.averagePrice || 0);

            // True Return ROI Percentage:
            // For Open Position: based on active capital deployed (qty * avgPrice)
            // For Closed Position: based on unit entry/exit price differential ((sellPrice - buyPrice) / buyPrice)
            const roiPct = isOpen
              ? (qty * avgPrice > 0 ? (((pos.totalPnl) / (qty * avgPrice)) * 100).toFixed(2) : null)
              : (buyPrice > 0 && sellPrice > 0 ? (((sellPrice - buyPrice) / buyPrice) * 100).toFixed(2) : null);

            return (
              <div
                key={pos.id}
                onClick={() => handleCardClick(pos)}
                className={`transition-colors cursor-pointer relative group ${
                  !isOpen
                    ? 'hover:bg-slate-50/60 active:bg-slate-50'
                    : 'hover:bg-slate-50/70 active:bg-slate-50'
                }`}
              >
                {/* Main Row: High-Density, Clean Responsive Layout */}
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-1 sm:space-y-1.5 transition-all">
                  {/* Line 1: Delivery/Intraday + BUY/SELL Tag (Left) & Exit + Qty Action Buttons (Top Right) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10.5px] sm:text-[11px] font-medium text-slate-400 tracking-tight">
                        {pos.productType === 'NRML' ? 'Delivery' : 'Intraday'} • {pos.exchange || 'NSE'}
                      </span>
                      {isOpen && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider uppercase ${
                          isLong ? 'bg-emerald-50 text-[#008f6b]' : 'bg-rose-50 text-[#d93838]'
                        }`}>
                          {isLong ? 'BUY' : 'SELL'}
                        </span>
                      )}
                    </div>

                    {/* Top Right: Action Buttons (Exit & + Qty) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOpen && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => handleExecuteExit(pos, e)}
                          disabled={isExitingThis}
                          className="h-5.5 px-2 rounded-md text-[10px] sm:text-[10.5px] font-black tracking-tight flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-[#d93838] border border-rose-200/70 transition-all active:scale-95 cursor-pointer shadow-2xs"
                          title="Instant Market Exit"
                        >
                          <Zap className="w-2.5 h-2.5 fill-[#d93838] text-[#d93838]" />
                          <span>{isExitingThis ? '...' : 'Exit'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => handleOpenOrderPad(pos, isLong ? 'BUY' : 'SELL', e)}
                        className={`h-5.5 px-2 rounded-md text-[10px] sm:text-[10.5px] font-black tracking-tight flex items-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-2xs ${
                          isOpen
                            ? isLong
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-[#008f6b] border border-emerald-200/60'
                              : 'bg-rose-50 hover:bg-rose-100 text-[#d93838] border border-rose-200/60'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/70'
                        }`}
                        title={isOpen ? "Add More Quantity" : "Re-Trade Contract (+ Qty)"}
                      >
                        <Plus className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Qty</span>
                      </button>
                    </div>
                  </div>

                  {/* Line 2: Instrument Name (Left) & P&L + Return% (Right) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-xs sm:text-[13.5px] font-bold tracking-tight truncate ${
                      isOpen ? 'text-slate-900' : 'text-slate-500'
                    }`}>
                      {formatDisplaySymbol(pos.tradingSymbol)}
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs sm:text-[13.5px] font-bold font-mono-num leading-tight ${
                          isOpen
                            ? isProfit
                              ? 'text-[#008f6b]'
                              : 'text-[#d93838]'
                            : 'text-slate-500 font-semibold'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {formatINR(pos.totalPnl)}
                        {roiPct !== null && (
                          <span className={`text-[10px] sm:text-[11px] font-semibold ml-1 ${
                            isOpen
                              ? isProfit ? 'text-[#008f6b]' : 'text-[#d93838]'
                              : 'text-slate-400'
                          }`}>
                            ({isProfit ? '+' : ''}{roiPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line 3: Pricing & Execution Metrics */}
                  {isOpen ? (
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono-num text-slate-500 pt-0.5 gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">Avg <strong className="text-slate-800 font-bold">₹{formatNumber(avgPrice)}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span className="truncate">Qty <strong className="text-slate-900 font-bold">{qty} ({lots}L)</strong></span>
                      </div>
                      <div className="text-right shrink-0">
                        <span>LTP <strong className="text-slate-800 font-bold">₹{formatNumber(pos.ltp)}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono-num text-slate-400 pt-0.5 gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">Buy Avg ₹{formatNumber(buyPrice)}</span>
                        <span className="text-slate-300">•</span>
                        <span className="truncate">Sell Avg ₹{formatNumber(sellPrice)}</span>
                      </div>
                      <div className="text-right shrink-0 text-slate-400">
                        <span>LTP ₹{formatNumber(pos.ltp)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 4. ACTIVE POSITION FULL DETAILS MODAL ── */}
      {selectedPositionForDetail && (
        <ActivePositionModal
          position={selectedPositionForDetail}
          onClose={() => setSelectedPositionForDetail(null)}
        />
      )}

      {/* ── 5. SAFE EXIT PORTFOLIO RISK GUARD MODAL ── */}
      {isSafeExitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#008f6b]" />
                <span>Safe Exit Guard</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSafeExitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {safeExitMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#008f6b] text-xs font-bold">
                {safeExitMsg}
              </div>
            )}

            <div className="space-y-3">
              {/* Max Portfolio Loss Threshold */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    <span>Auto Exit on Max Loss (₹)</span>
                  </span>
                  <input
                    type="number"
                    value={safeMaxLoss}
                    onChange={(e) => setSafeMaxLoss(e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-bold text-slate-900 font-mono-num focus:outline-none focus:border-[#00D09C]"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Automatically exits all positions if portfolio loss reaches ₹{safeMaxLoss}
                </p>
              </div>

              {/* Target Profit Threshold */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-[#008f6b]" />
                    <span>Lock Profits Target (₹)</span>
                  </span>
                  <input
                    type="number"
                    value={safeTargetProfit}
                    onChange={(e) => setSafeTargetProfit(e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-bold text-slate-900 font-mono-num focus:outline-none focus:border-[#00D09C]"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Locks in returns when total profit reaches ₹{safeTargetProfit}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSafeExitModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSafeExitActive(true);
                  setSafeExitMsg(`🛡️ Safe Exit Active: Loss limit ₹${safeMaxLoss} | Profit target ₹${safeTargetProfit}`);
                  setTimeout(() => setIsSafeExitModalOpen(false), 1200);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-black transition-all shadow-md cursor-pointer active:scale-95"
              >
                Enable Safe Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

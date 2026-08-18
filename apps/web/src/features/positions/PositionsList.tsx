import React, { useState } from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR, formatNumber } from '../../lib/utils.js';
import {
  Layers,
  ArrowUpRight,
  Plus,
  Target,
  Zap,
  X,
  ChevronRight,
  Shield,
  AlertTriangle,
} from 'lucide-react';

export const PositionsList: React.FC = () => {
  const {
    positionsSummary,
    setActiveTab,
    placeOrder,
    exitAllPositions,
    wallet,
    isLoading,
  } = useTradingStore();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [isInstantExitingId, setIsInstantExitingId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Modal State for Modifying SL, Target & Trailing SL for Active Positions
  const [modifyModalPos, setModifyModalPos] = useState<any | null>(null);
  const [modTargetPrice, setModTargetPrice] = useState<string>('');
  const [modTriggerPrice, setModTriggerPrice] = useState<string>('');
  const [modTrailingSL, setModTrailingSL] = useState<string>('5');
  const [modError, setModError] = useState('');
  const [modSuccess, setModSuccess] = useState('');
  const [isModSubmitting, setIsModSubmitting] = useState(false);

  // Modal State for Safe Exit (Portfolio Level Risk Guard)
  const [isSafeExitModalOpen, setIsSafeExitModalOpen] = useState(false);
  const [safeMaxLoss, setSafeMaxLoss] = useState<string>('2000');
  const [safeTargetProfit, setSafeTargetProfit] = useState<string>('5000');
  const [safeExitActive, setSafeExitActive] = useState(false);
  const [safeExitMsg, setSafeExitMsg] = useState('');

  // Quick Side Drawer / Modal for Instant Order Add
  const [quickOrderPos, setQuickOrderPos] = useState<any | null>(null);
  const [quickOrderLots, setQuickOrderLots] = useState<number>(1);
  const [quickOrderLoading, setQuickOrderLoading] = useState(false);

  // Skeleton loader while loading
  if (isLoading && !positionsSummary) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="p-5 rounded-2xl bg-[#121620] border border-[#232B3B] space-y-3">
          <div className="h-3 w-28 bg-white/10 rounded"></div>
          <div className="h-8 w-44 bg-white/10 rounded"></div>
        </div>
        <div className="rounded-2xl border border-[#232B3B] bg-[#121620] p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl border border-white/5"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!positionsSummary || positionsSummary.positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-groww-card border border-groww-border rounded-2xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-groww-surface border border-groww-border flex items-center justify-center text-groww-textMuted mb-4">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">No Positions Found</h3>
        <p className="text-xs text-groww-textSubtle max-w-sm mb-6">
          You don't have any active F&O positions. Open the Option Chain to place your first trade.
        </p>
        <button
          onClick={() => setActiveTab('option-chain')}
          className="py-2.5 px-6 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-bold transition-all shadow-lg shadow-emerald-950/30 flex items-center gap-2 cursor-pointer"
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

  // Active / Open trades always UP (top), Closed / Inactive trades at the BOTTOM
  const displayedPositions =
    activeFilter === 'ALL'
      ? [...openPositions, ...closedPositions]
      : activeFilter === 'OPEN'
        ? openPositions
        : closedPositions;

  // 1-Click Instant Market Exit with Red Energy Icon (⚡)
  const handleInstantExit = async (pos: any, e?: React.MouseEvent) => {
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
      console.error('Instant exit failed', err);
    } finally {
      setIsInstantExitingId(null);
    }
  };

  // 1-Click Instant Add / Averaging via Quick Drawer
  const handleOpenQuickAdd = (pos: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickOrderPos(pos);
    setQuickOrderLots(1);
  };

  const handleExecuteQuickAdd = async () => {
    if (!quickOrderPos) return;
    setQuickOrderLoading(true);
    const lotSize = quickOrderPos.lotSize || 25;
    const qty = quickOrderLots * lotSize;
    const action = quickOrderPos.netQuantity >= 0 ? 'BUY' : 'SELL';

    try {
      await placeOrder({
        contractId: quickOrderPos.contractId,
        orderType: 'MARKET',
        transactionType: action,
        productType: quickOrderPos.productType,
        quantity: qty,
      });
      setQuickOrderPos(null);
    } catch (err: any) {
      console.error('Quick add failed', err);
    } finally {
      setQuickOrderLoading(false);
    }
  };

  // Open Modify SL & Target Dialog
  const handleOpenModifyDialog = (pos: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModifyModalPos(pos);
    const isLong = pos.netQuantity >= 0;
    const defaultTarget = isLong ? (pos.ltp * 1.2).toFixed(2) : (pos.ltp * 0.8).toFixed(2);
    const defaultTrigger = isLong ? (pos.ltp * 0.9).toFixed(2) : (pos.ltp * 1.1).toFixed(2);
    setModTargetPrice(defaultTarget);
    setModTriggerPrice(defaultTrigger);
    setModTrailingSL('5');
    setModError('');
    setModSuccess('');
  };

  const handleSaveModifyProtection = async () => {
    if (!modifyModalPos) return;
    setModError('');
    setModSuccess('');
    setIsModSubmitting(true);

    const isLong = modifyModalPos.netQuantity > 0;
    const ltp = modifyModalPos.ltp;
    const targetNum = modTargetPrice && parseFloat(modTargetPrice) > 0 ? parseFloat(modTargetPrice) : undefined;
    const triggerNum = modTriggerPrice && parseFloat(modTriggerPrice) > 0 ? parseFloat(modTriggerPrice) : undefined;
    const trailNum = modTrailingSL && parseFloat(modTrailingSL) > 0 ? parseFloat(modTrailingSL) : undefined;

    if (!triggerNum && !targetNum) {
      setModError('Please enter at least a Stop Loss Trigger Price or Target Price.');
      setIsModSubmitting(false);
      return;
    }

    // Stop Loss and Target validation for protecting position
    if (triggerNum && triggerNum >= ltp) {
      setModError(`Stop Loss (₹${triggerNum.toFixed(2)}) must be LOWER than current LTP (₹${formatNumber(ltp)}).`);
      setIsModSubmitting(false);
      return;
    }
    if (targetNum && targetNum <= ltp) {
      setModError(`Target price (₹${targetNum.toFixed(2)}) must be HIGHER than current LTP (₹${formatNumber(ltp)}).`);
      setIsModSubmitting(false);
      return;
    }

    try {
      const exitAction = isLong ? 'SELL' : 'BUY';
      const exitQty = Math.abs(modifyModalPos.netQuantity);

      await placeOrder({
        contractId: modifyModalPos.contractId,
        orderType: triggerNum ? 'SL' : 'LIMIT',
        transactionType: exitAction,
        productType: modifyModalPos.productType,
        quantity: exitQty,
        price: targetNum || modifyModalPos.ltp,
        triggerPrice: triggerNum,
        targetPrice: targetNum,
        trailingStopLoss: trailNum,
      });

      setModSuccess('Protection order placed successfully!');
      setTimeout(() => {
        setModifyModalPos(null);
      }, 1000);
    } catch (err: any) {
      setModError(err?.response?.data?.error?.message || 'Failed to apply protection.');
    } finally {
      setIsModSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOTAL P&L Summary Card (Matching Groww Screenshot exactly) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0F131C] border border-[#1E2638] shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              TOTAL P&L
            </div>
            <div
              className={`text-2xl sm:text-3xl font-black font-mono-num mt-1 flex items-center gap-1 ${isNetPositive ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
                }`}
            >
              <span>{isNetPositive ? '+' : ''}{formatINR(netPnl)}</span>
            </div>
          </div>


        </div>

        {/* Realized / Unrealized mini strip */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#1E2638]/70 text-xs font-mono-num">
          <div className="flex justify-between text-gray-400">
            <span>Unrealized MTM:</span>
            <span className={totalUnrealizedPnl >= 0 ? 'text-[#00D09C] font-bold' : 'text-[#EB5B5B] font-bold'}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}{formatINR(totalUnrealizedPnl)}
            </span>
          </div>
          <div className="flex justify-between text-gray-400 pl-2 border-l border-[#1E2638]/70">
            <span>Realized:</span>
            <span className={totalRealizedPnl >= 0 ? 'text-[#00D09C] font-bold' : 'text-[#EB5B5B] font-bold'}>
              {totalRealizedPnl >= 0 ? '+' : ''}{formatINR(totalRealizedPnl)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Toolbar Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {(['OPEN', 'ALL', 'CLOSED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeFilter === tab
                  ? 'bg-[#182030] text-white border border-[#2B3850] shadow-sm'
                  : 'text-gray-400 hover:text-white bg-[#0F131C] border border-[#1E2638]'
                }`}
            >
              {tab === 'OPEN' && `Open (${openPositions.length})`}
              {tab === 'ALL' && `All (${positions.length})`}
              {tab === 'CLOSED' && `Closed (${closedPositions.length})`}
            </button>
          ))}
        </div>

        {/* Red Energy Instant Square-Off All Button */}
        {openPositions.length > 0 && (
          <button
            onClick={() => exitAllPositions()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-extrabold transition-all shadow-md cursor-pointer"
            title="Instant Market Exit All Active Positions"
          >
            <Zap className="w-3.5 h-3.5 fill-current text-rose-500 animate-pulse" />
            <span>Exit All ({openPositions.length})</span>
          </button>
        )}
      </div>

      {/* 3. Positions List (Groww Mobile & Desktop Design) */}
      <div className="rounded-2xl border border-[#1E2638] bg-[#0F131C] overflow-hidden shadow-2xl divide-y divide-[#1E2638]">
        {displayedPositions.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No positions in <span className="text-white font-bold">{activeFilter}</span> category.
          </div>
        ) : (
          displayedPositions.map((pos) => {
            const isProfit = pos.totalPnl >= 0;
            const isLong = pos.netQuantity > 0;
            const isOpen = pos.status === 'OPEN' && pos.netQuantity !== 0;
            const lotSize = pos.lotSize || 25;
            const lots = Math.max(1, Math.round(Math.abs(pos.netQuantity) / lotSize));
            const isExitingThis = isInstantExitingId === pos.id;

            const isExpanded = expandedCardId === pos.id;

            return (
              <div
                key={pos.id}
                className={`space-y-0 transition-colors cursor-pointer ${isExpanded ? 'bg-[#141A26]' : 'hover:bg-[#141A26]/50'}`}
                onClick={() => setExpandedCardId(isExpanded ? null : pos.id)}
              >
                {/* Main Card Content */}
                <div className="p-4 space-y-3">
                  {/* Top Line: Delivery • NSE (Left) & B > + ⚡Exit Pill (Right) */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                      <span>{pos.productType === 'NRML' ? 'Delivery' : 'Intraday'}</span>
                      <span>•</span>
                      <span>{pos.exchange || 'NSE'}</span>
                    </div>

                    {/* Groww-style 'B >' Pill Button + Red Energy Exit Button ⚡ */}
                    {isOpen ? (
                      <div className="flex items-center gap-2">
                        {/* 'B >' Quick Add Pill */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenQuickAdd(pos, e);
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                            isLong
                              ? 'bg-[#00D09C]/15 hover:bg-[#00D09C]/25 text-[#00D09C] border border-[#00D09C]/40'
                              : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/40'
                          }`}
                          title="1-Click Quick Add / Average Order"
                        >
                          <span>{isLong ? 'B' : 'S'}</span>
                          <ChevronRight className="w-3 h-3 stroke-[3]" />
                        </button>

                        {/* Red Energy Instant Exit Button ⚡ */}
                        <button
                          type="button"
                          disabled={isExitingThis}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstantExit(pos, e);
                          }}
                          className="px-2.5 py-0.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-extrabold flex items-center gap-1 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                          title="Instant 1-Click Market Square Off"
                        >
                          <Zap className="w-3 h-3 fill-current text-rose-500" />
                          <span>{isExitingThis ? '...' : 'Exit'}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 font-bold">
                        CLOSED
                      </span>
                    )}
                  </div>

                  {/* Middle Line: Instrument Name (Left) & P&L (Right) */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                      <span>{pos.tradingSymbol}</span>
                      {pos.optionType && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            pos.optionType === 'CE'
                              ? 'bg-emerald-500/20 text-[#00D09C]'
                              : 'bg-rose-500/20 text-[#EB5B5B]'
                          }`}
                        >
                          {pos.optionType}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-base sm:text-lg font-black font-mono-num ${
                          isProfit ? 'text-[#00D09C]' : 'text-[#EB5B5B]'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {formatINR(pos.totalPnl)}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Line: Avg Price & Qty (Left) & Live Market LTP (Right) */}
                  <div className="flex items-center justify-between text-xs font-mono-num text-gray-400">
                    <div className="flex items-center gap-2">
                      <span>Avg ₹{formatNumber(pos.averageBuyPrice || pos.averageSellPrice || 0)}</span>
                      <span>•</span>
                      <span className="text-gray-300">
                        {isOpen ? (
                          <>Qty {Math.abs(pos.netQuantity)} ({lots} {lots === 1 ? 'Lot' : 'Lots'})</>
                        ) : (
                          <>Qty 0 (Closed)</>
                        )}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 mr-1">Mkt</span>
                      <span className="text-white font-bold">₹{formatNumber(pos.ltp)}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Action Bar — only visible when card is clicked */}
                {isExpanded && isOpen && (
                  <div className="px-4 pb-4 animate-fadeIn">
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1E2638]/80">
                      {/* 1. Red Energy Instant Exit Button ⚡ */}
                      <button
                        type="button"
                        disabled={isExitingThis}
                        onClick={(e) => { e.stopPropagation(); handleInstantExit(pos, e); }}
                        className="py-2.5 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current text-rose-500" />
                        <span>{isExitingThis ? 'Exiting...' : 'Exit ⚡'}</span>
                      </button>

                      {/* 2. Quick Add More Lots */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenQuickAdd(pos, e); }}
                        className="py-2.5 px-2 rounded-xl bg-[#00D09C]/15 hover:bg-[#00D09C]/25 border border-[#00D09C]/35 text-[#00D09C] text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Add More</span>
                      </button>

                      {/* 3. SL / Target Protection */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenModifyDialog(pos, e); }}
                        className="py-2.5 px-2 rounded-xl bg-[#1A2130] hover:bg-[#252D40] border border-[#2E3A52] text-gray-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Target className="w-3.5 h-3.5 text-amber-400" />
                        <span>SL / TGT</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded detail for CLOSED positions */}
                {isExpanded && !isOpen && (
                  <div className="px-4 pb-4 animate-fadeIn">
                    <div className="pt-3 border-t border-[#1E2638]/60 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono-num">
                        <span className="text-gray-400">Buy Avg</span>
                        <span className="text-white font-bold">₹{formatNumber(pos.averageBuyPrice)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono-num">
                        <span className="text-gray-400">Sell Avg</span>
                        <span className="text-white font-bold">₹{formatNumber(pos.averageSellPrice)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono-num">
                        <span className="text-gray-400">Realized P&L</span>
                        <span className={`font-bold ${pos.realizedPnl >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}`}>
                          {pos.realizedPnl >= 0 ? '+' : ''}{formatINR(pos.realizedPnl)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Instant 1-Click Quick Order Drawer (Triggered by 'B >' or 'Add More') */}
      {quickOrderPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#0F131C] border border-[#1E2638] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-[#1E2638]">
              <div>
                <div className="text-base font-black text-white flex items-center gap-2">
                  <span>{quickOrderPos.tradingSymbol}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#00D09C]/20 text-[#00D09C]">
                    1-Click Add
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Live LTP: <span className="text-[#00D09C] font-bold">₹{formatNumber(quickOrderPos.ltp)}</span> • Available Margin: <span className="text-white font-bold">{formatINR(wallet?.availableMargin ?? 1000000)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickOrderPos(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lot Selector */}
            <div className="p-4 rounded-xl bg-[#161C28] border border-[#273248] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Select Additional Quantity</div>
                  <div className="text-[11px] text-gray-400 font-mono-num">
                    {quickOrderLots * (quickOrderPos.lotSize || 25)} Units ({quickOrderLots} {quickOrderLots === 1 ? 'Lot' : 'Lots'})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickOrderLots((l) => Math.max(1, l - 1))}
                    className="w-8 h-8 rounded-lg bg-[#0F131C] border border-[#273248] text-white font-bold hover:bg-[#202838]"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-extrabold text-white font-mono-num">
                    {quickOrderLots}L
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickOrderLots((l) => l + 1)}
                    className="w-8 h-8 rounded-lg bg-[#0F131C] border border-[#273248] text-white font-bold hover:bg-[#202838]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#273248]/60">
                {[1, 2, 5, 10].map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setQuickOrderLots(ct)}
                    className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors ${quickOrderLots === ct
                        ? 'bg-[#00D09C] text-black'
                        : 'bg-[#0F131C] text-gray-300 hover:text-white border border-[#273248]'
                      }`}
                  >
                    {ct}L
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Total */}
            <div className="flex justify-between items-center text-xs font-mono-num px-1">
              <span className="text-gray-400">Required Capital:</span>
              <span className="text-white font-black text-sm">
                ₹{formatNumber(quickOrderLots * (quickOrderPos.lotSize || 25) * quickOrderPos.ltp)}
              </span>
            </div>

            {/* 1-Click Instant Submit */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setQuickOrderPos(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#161C28] text-gray-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteQuickAdd}
                disabled={quickOrderLoading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00D09C] to-[#00B386] hover:from-[#00B386] hover:to-[#009E77] text-black text-xs font-black transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {quickOrderLoading ? (
                  <span>Executing...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Instant Market BUY</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Safe Exit Risk Guard Modal */}
      {isSafeExitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#0F131C] border border-[#1E2638] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-[#1E2638]">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00D09C]" />
                  <span>Set Safe Portfolio Exit</span>
                </h3>
                <div className="text-xs text-gray-400 mt-0.5">
                  Automated risk guard for overall MTM profit & loss
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSafeExitModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {safeExitMsg && (
              <div className="p-2.5 rounded-xl bg-[#00D09C]/10 border border-[#00D09C]/30 text-[#00D09C] text-xs font-bold">
                {safeExitMsg}
              </div>
            )}

            <div className="space-y-3">
              {/* Max Portfolio Loss Threshold */}
              <div className="p-3 rounded-xl bg-[#161C28] border border-[#273248] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Auto Square-off on Max Loss (₹)</span>
                  </span>
                  <input
                    type="number"
                    value={safeMaxLoss}
                    onChange={(e) => setSafeMaxLoss(e.target.value)}
                    className="w-28 bg-[#0F131C] border border-[#273248] rounded-lg px-2 py-1 text-right text-xs font-bold text-rose-400 font-mono-num focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div className="text-[10px] text-gray-400">
                  Exits all positions automatically if total loss reaches ₹{safeMaxLoss}
                </div>
              </div>

              {/* Target Profit Threshold */}
              <div className="p-3 rounded-xl bg-[#161C28] border border-[#273248] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    <span>Lock Profits Target (₹)</span>
                  </span>
                  <input
                    type="number"
                    value={safeTargetProfit}
                    onChange={(e) => setSafeTargetProfit(e.target.value)}
                    className="w-28 bg-[#0F131C] border border-[#273248] rounded-lg px-2 py-1 text-right text-xs font-bold text-emerald-400 font-mono-num focus:outline-none focus:border-[#00D09C]"
                  />
                </div>
                <div className="text-[10px] text-gray-400">
                  Locks in gains when total returns cross ₹{safeTargetProfit}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#1E2638]">
              <button
                type="button"
                onClick={() => setIsSafeExitModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#161C28] text-gray-300 text-xs font-bold"
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
                className="flex-1 py-2.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-black transition-all shadow-md cursor-pointer"
              >
                Enable Safe Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modify SL & Target Protection Dialog */}
      {modifyModalPos && (() => {
        const ltp = modifyModalPos.ltp;
        const slNum = modTriggerPrice !== '' ? parseFloat(modTriggerPrice) : undefined;
        const tgtNum = modTargetPrice !== '' ? parseFloat(modTargetPrice) : undefined;

        // Dynamic validation: SL must be < LTP, Target must be > LTP
        const slError =
          slNum !== undefined && !isNaN(slNum) && slNum >= ltp
            ? `Stop Loss (₹${slNum.toFixed(2)}) must be LESS than live LTP ₹${formatNumber(ltp)}`
            : '';

        const tgtError =
          tgtNum !== undefined && !isNaN(tgtNum) && tgtNum <= ltp
            ? `Target (₹${tgtNum.toFixed(2)}) must be GREATER than live LTP ₹${formatNumber(ltp)}`
            : '';

        const hasValidationErrors = Boolean(slError || tgtError);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-[#0F131C] border border-[#1E2638] rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-[#1E2638]">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>SL & Target Protection</span>
                  </h3>
                  <div className="text-xs text-gray-400 mt-1">
                    {modifyModalPos.tradingSymbol} • LTP: <span className="text-[#00D09C] font-bold font-mono-num">₹{formatNumber(modifyModalPos.ltp)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModifyModalPos(null)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[#EB5B5B] text-xs font-bold">
                  {modError}
                </div>
              )}
              {modSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-[#00D09C]/30 text-[#00D09C] text-xs font-bold">
                  {modSuccess}
                </div>
              )}

              <div className="space-y-3">
                {/* Stop Loss Trigger */}
                <div className={`p-3 rounded-xl bg-[#161C28] border transition-colors space-y-1.5 ${
                  slError ? 'border-rose-500/60 bg-rose-500/5' : 'border-[#273248]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Stop Loss Trigger (₹)</span>
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      value={modTriggerPrice}
                      onChange={(e) => setModTriggerPrice(e.target.value)}
                      className={`w-32 bg-[#0F131C] rounded-lg px-2.5 py-1.5 text-right text-xs font-bold font-mono-num focus:outline-none transition-all ${
                        slError
                          ? 'border-2 border-rose-500 text-rose-400'
                          : 'border border-[#273248] text-amber-400 focus:border-amber-400'
                      }`}
                    />
                  </div>
                  {slError ? (
                    <div className="text-[11px] font-bold text-rose-400">
                      ❌ {slError}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400">
                      Auto square-off if price drops below ₹{modTriggerPrice || '...'}
                    </div>
                  )}
                </div>

                {/* Target Price */}
                <div className={`p-3 rounded-xl bg-[#161C28] border transition-colors space-y-1.5 ${
                  tgtError ? 'border-rose-500/60 bg-rose-500/5' : 'border-[#273248]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      <span>Target Profit (₹)</span>
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      value={modTargetPrice}
                      onChange={(e) => setModTargetPrice(e.target.value)}
                      className={`w-32 bg-[#0F131C] rounded-lg px-2.5 py-1.5 text-right text-xs font-bold font-mono-num focus:outline-none transition-all ${
                        tgtError
                          ? 'border-2 border-rose-500 text-rose-400'
                          : 'border border-[#273248] text-emerald-400 focus:border-[#00D09C]'
                      }`}
                    />
                  </div>
                  {tgtError ? (
                    <div className="text-[11px] font-bold text-rose-400">
                      ❌ {tgtError}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400">
                      Auto books profit when price rises to ₹{modTargetPrice || '...'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#1E2638]">
                <button
                  type="button"
                  onClick={() => setModifyModalPos(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#161C28] text-gray-300 text-xs font-bold hover:text-white"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={handleSaveModifyProtection}
                  disabled={isModSubmitting || hasValidationErrors}
                  className="flex-1 py-2.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-black transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isModSubmitting ? 'Placing...' : 'Apply Protection'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

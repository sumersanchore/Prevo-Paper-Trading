import React, { useState, useEffect } from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR, formatNumber } from '../../lib/utils.js';
import { useToast } from '../../components/ui/Toast.js';
import {
  ArrowLeft,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Shield,
  ShieldAlert,
  Target,
  Plus,
  Zap,
  BarChart2,
  X,
  RotateCw,
  Info,
  ChevronRight,
} from 'lucide-react';

interface ActivePositionModalProps {
  position: any;
  onClose: () => void;
}

export const ActivePositionModal: React.FC<ActivePositionModalProps> = ({
  position: initialPos,
  onClose,
}) => {
  const toast = useToast();
  const {
    positionsSummary,
    orders,
    placeOrder,
    modifyOrder,
    cancelOrder,
    setActiveTab,
    openOrderPad,
    wallet,
  } = useTradingStore();

  // Find live position from store if available to ensure live LTP/P&L sync
  const pos =
    positionsSummary?.positions?.find((p: any) => p.id === initialPos?.id) ||
    initialPos;

  const isOpen = pos.status === 'OPEN' && Number(pos.netQuantity) !== 0;
  const netQty = Number(pos.netQuantity || 0);
  const buyQty = Number(pos.buyQuantity || 0);
  const sellQty = Number(pos.sellQuantity || 0);
  const buyPrice = Number(pos.averageBuyPrice) || 0;
  const sellPrice = Number(pos.averageSellPrice) || 0;

  // Robust Long vs Short detection:
  // If user has bought options (netQty > 0 or buyQty >= sellQty or buyPrice > 0), it's LONG (BUY)
  // Default to LONG (BUY) for all buy trades so SL is minus of LTP and Target is plus of LTP
  const isShort = (netQty < 0 && sellQty > buyQty) || (sellPrice > 0 && buyPrice === 0 && netQty < 0);
  const isLong = !isShort;
  const qty = Math.abs(netQty) || buyQty || sellQty || 25;
  const lotSize = Number(pos.lotSize) || 25;
  const lots = Math.max(1, Math.round(qty / lotSize));
  const avgPrice = isLong ? (buyPrice || Number(pos.averagePrice) || sellPrice || 0) : (sellPrice || Number(pos.averagePrice) || buyPrice || 0);
  const ltp = Number(pos.ltp) || avgPrice;

  // Real-time live Unrealized P&L calculation for Open position:
  const liveUnrealizedPnl = isOpen
    ? (isLong ? (ltp - avgPrice) * qty : (avgPrice - ltp) * qty)
    : 0;

  const displayPnl = isOpen ? liveUnrealizedPnl : (pos.realizedPnl ?? pos.totalPnl ?? 0);
  const isProfit = displayPnl >= 0;

  // Accurately compute total traded quantity, capital invested & recovered value
  const totalTradedQty = isOpen
    ? qty
    : (pos.buyQuantity || pos.totalBuyQuantity || pos.sellQuantity || pos.totalSellQuantity || qty || lotSize);
  const totalLots = Math.max(1, Math.round(totalTradedQty / lotSize));

  const totalInvested = isOpen
    ? (qty * avgPrice)
    : (pos.buyAmount || pos.buyValue || (totalTradedQty * (buyPrice || avgPrice)));
  const totalExitVal = isOpen
    ? (qty * ltp)
    : (pos.sellAmount || pos.sellValue || (totalTradedQty * (sellPrice || ltp)));

  // Real percentage return on capital / trade price differential
  const returnPct = isOpen
    ? (avgPrice > 0 ? (isLong ? ((ltp - avgPrice) / avgPrice) * 100 : ((avgPrice - ltp) / avgPrice) * 100) : 0)
    : (buyPrice > 0 && sellPrice > 0 ? (((sellPrice - buyPrice) / buyPrice) * 100) : (totalInvested > 0 ? ((displayPnl / totalInvested) * 100) : 0));

  // Find any active pending protection order for this contract in orders list
  const pendingProtectionOrder = orders?.find(
    (ord: any) =>
      (ord.contractId === pos.contractId || ord.tradingSymbol === pos.tradingSymbol) &&
      ord.status === 'PENDING' &&
      (ord.triggerPrice || ord.targetPrice || ord.trailingStopLoss)
  );

  // Active Sub-Modals / Sheets
  const [activeSheet, setActiveSheet] = useState<
    'NONE' | 'SL_TGT' | 'ADD_MORE' | 'EXIT' | 'FAST_EXIT' | 'DETAILS'
  >('NONE');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // SL / Target Risk Controls State
  const [slPrice, setSlPrice] = useState<string>(pos.stopLoss ? String(pos.stopLoss) : '');
  const [slPercent, setSlPercent] = useState<string>('');
  const [tgtPrice, setTgtPrice] = useState<string>(pos.target ? String(pos.target) : '');
  const [tgtPercent, setTgtPercent] = useState<string>('');
  const [isTrailingSl, setIsTrailingSl] = useState<boolean>(false);
  const [trailStep, setTrailStep] = useState<string>('2.00');
  const [isSlActive, setIsSlActive] = useState<boolean>(Boolean(pos.stopLoss));
  const [isTgtActive, setIsTgtActive] = useState<boolean>(Boolean(pos.target));
  const [isSubmittingRisk, setIsSubmittingRisk] = useState<boolean>(false);

  useEffect(() => {
    if (pendingProtectionOrder) {
      if (pendingProtectionOrder.triggerPrice) {
        setSlPrice(String(pendingProtectionOrder.triggerPrice));
        setIsSlActive(true);
      }
      if (pendingProtectionOrder.targetPrice) {
        setTgtPrice(String(pendingProtectionOrder.targetPrice));
        setIsTgtActive(true);
      }
      if (pendingProtectionOrder.trailingStopLoss) {
        setTrailStep(String(pendingProtectionOrder.trailingStopLoss));
        setIsTrailingSl(true);
      }
    }
  }, [pendingProtectionOrder]);

  // Add More State
  const [addLots, setAddLots] = useState<number>(1);
  const addQty = addLots * lotSize;
  const estimatedAddInvest = addQty * ltp;
  const newTotalQty = qty + addQty;
  const estimatedNewAvg = (totalInvested + estimatedAddInvest) / (newTotalQty || 1);

  // Exit State
  const [exitLots, setExitLots] = useState<number>(Math.max(1, lots));
  const exitQty = Math.min(qty, exitLots * lotSize);
  const estimatedExitVal = exitQty * ltp;
  const isFullExit = exitQty >= qty;
  const [isExiting, setIsExiting] = useState(false);
  const [exitSuccessMsg, setExitSuccessMsg] = useState('');

  // Auto calculate SL price when % is edited
  const handleSlPercentChange = (pctStr: string) => {
    setSlPercent(pctStr);
    const pct = parseFloat(pctStr);
    if (!isNaN(pct) && pct > 0) {
      const basePrice = ltp > 0 ? ltp : avgPrice;
      const calculated = isLong ? basePrice * (1 - pct / 100) : basePrice * (1 + pct / 100);
      setSlPrice(Math.max(0.05, calculated).toFixed(2));
    }
  };

  // Auto calculate Target price when % is edited
  const handleTgtPercentChange = (pctStr: string) => {
    setTgtPercent(pctStr);
    const pct = parseFloat(pctStr);
    if (!isNaN(pct) && pct > 0) {
      const basePrice = ltp > 0 ? ltp : avgPrice;
      const calculated = isLong ? basePrice * (1 + pct / 100) : basePrice * (1 - pct / 100);
      setTgtPrice(Math.max(0.05, calculated).toFixed(2));
    }
  };

  // Real-time Stop Loss & Target validation
  const numSl = parseFloat(slPrice);
  const isSlEntered = !isNaN(numSl) && numSl > 0;
  const numTgt = parseFloat(tgtPrice);
  const isTgtEntered = !isNaN(numTgt) && numTgt > 0;

  const isSlInvalid = isSlEntered
    ? isLong
      ? (numSl >= ltp || (isTgtEntered && numSl >= numTgt))
      : (numSl <= ltp || (isTgtEntered && numSl <= numTgt))
    : false;

  const isTgtInvalid = isTgtEntered
    ? isLong
      ? (numTgt <= ltp || (isSlEntered && numTgt <= numSl))
      : (numTgt >= ltp || (isSlEntered && numTgt >= numSl))
    : false;

  // Live estimated P&L for SL and Target
  const estSlLoss = isSlEntered && !isSlInvalid
    ? (isLong ? (numSl - avgPrice) * qty : (avgPrice - numSl) * qty)
    : null;
  const estTgtProfit = isTgtEntered && !isTgtInvalid
    ? (isLong ? (numTgt - avgPrice) * qty : (avgPrice - numTgt) * qty)
    : null;

  // Execute Market Exit
  const handleConfirmExit = async (quantityToExit: number) => {
    setIsExiting(true);
    const reverseAction = isLong ? 'SELL' : 'BUY';
    try {
      await placeOrder({
        contractId: pos.contractId,
        orderType: 'MARKET',
        transactionType: reverseAction,
        productType: pos.productType || 'NRML',
        quantity: quantityToExit,
      });
      setExitSuccessMsg(`✓ Exit order placed for ${quantityToExit} Qty`);
      setTimeout(() => {
        setIsExiting(false);
        setActiveSheet('NONE');
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Exit failed', err);
      setIsExiting(false);
    }
  };

  // Execute Add More Lots
  const handleConfirmAddMore = async () => {
    setIsExiting(true);
    try {
      await placeOrder({
        contractId: pos.contractId,
        orderType: 'MARKET',
        transactionType: isLong ? 'BUY' : 'SELL',
        productType: pos.productType || 'NRML',
        quantity: addQty,
      });
      setActiveSheet('NONE');
    } catch (err: any) {
      console.error('Add more failed', err);
    } finally {
      setIsExiting(false);
    }
  };

  // Set & Save Risk Controls (SL / Target / Trailing) in Backend
  const handleSaveRiskControls = async () => {
    const numSl = slPrice && parseFloat(slPrice) > 0 ? parseFloat(slPrice) : undefined;
    const numTgt = tgtPrice && parseFloat(tgtPrice) > 0 ? parseFloat(tgtPrice) : undefined;
    const numTrail = isTrailingSl && trailStep && parseFloat(trailStep) > 0 ? parseFloat(trailStep) : undefined;

    if (!numSl && !numTgt) {
      toast.error('Trigger Required', 'Please enter at least a Stop Loss or Target price.');
      return;
    }

    if (isLong) {
      if (numSl && numSl >= ltp) {
        toast.error('Invalid Stop Loss', `Stop Loss (₹${numSl}) must be strictly less than Current LTP (₹${formatNumber(ltp)}).`);
        return;
      }
      if (numTgt && numTgt <= ltp) {
        toast.error('Invalid Target', `Target (₹${numTgt}) must be strictly greater than Current LTP (₹${formatNumber(ltp)}).`);
        return;
      }
      if (numSl && numTgt && numSl >= numTgt) {
        toast.error('Invalid Stop Loss / Target', `Stop Loss (₹${numSl}) must be strictly less than Target (₹${numTgt}).`);
        return;
      }
    } else {
      if (numSl && numSl <= ltp) {
        toast.error('Invalid Stop Loss', `Stop Loss (₹${numSl}) must be strictly greater than Current LTP (₹${formatNumber(ltp)}).`);
        return;
      }
      if (numTgt && numTgt >= ltp) {
        toast.error('Invalid Target', `Target (₹${numTgt}) must be strictly less than Current LTP (₹${formatNumber(ltp)}).`);
        return;
      }
      if (numSl && numTgt && numSl <= numTgt) {
        toast.error('Invalid Stop Loss / Target', `Stop Loss (₹${numSl}) must be strictly greater than Target (₹${numTgt}).`);
        return;
      }
    }

    setIsSubmittingRisk(true);
    try {
      if (pendingProtectionOrder) {
        await modifyOrder(pendingProtectionOrder.id, {
          triggerPrice: numSl,
          targetPrice: numTgt,
          trailingStopLoss: numTrail,
          quantity: qty,
          price: numTgt || ltp,
        });
        toast.success('Trigger Orders Updated', `Updated SL: ${numSl ? `₹${numSl}` : '-'} | Target: ${numTgt ? `₹${numTgt}` : '-'}`);
      } else {
        await placeOrder({
          contractId: pos.contractId,
          transactionType: isLong ? 'SELL' : 'BUY',
          orderType: numSl ? 'SL-M' : 'LIMIT',
          quantity: qty,
          price: numTgt || ltp,
          triggerPrice: numSl,
          targetPrice: numTgt,
          trailingStopLoss: numTrail,
          productType: pos.productType || 'NRML',
        });
        toast.success('Trigger Orders Placed', `Set SL: ${numSl ? `₹${numSl}` : '-'} | Target: ${numTgt ? `₹${numTgt}` : '-'}`);
      }
      setIsSlActive(Boolean(numSl));
      setIsTgtActive(Boolean(numTgt));
      setActiveSheet('NONE');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to set trigger order.';
      toast.error('Trigger Failed', msg);
    } finally {
      setIsSubmittingRisk(false);
    }
  };

  const handleRemoveRiskControls = async () => {
    if (pendingProtectionOrder) {
      setIsSubmittingRisk(true);
      try {
        await cancelOrder(pendingProtectionOrder.id);
        toast.info('Trigger Orders Removed', 'Cancelled pending SL / Target protection orders.');
      } catch (err: any) {
        toast.error('Remove Failed', err?.message || 'Failed to remove trigger order.');
      } finally {
        setIsSubmittingRisk(false);
      }
    }
    setSlPrice('');
    setTgtPrice('');
    setIsSlActive(false);
    setIsTgtActive(false);
    setIsTrailingSl(false);
    setActiveSheet('NONE');
  };

  const cleanSymbol = pos.tradingSymbol?.replace(/_/g, ' ') || 'NIFTY OPTION';
  const optionType = pos.optionType || (cleanSymbol.includes('PE') || cleanSymbol.includes('Put') ? 'PE' : 'CE');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs font-sans animate-fadeIn p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-slideUp relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* ── 1. SCREEN HEADER ── */}
        <div className="px-5 pt-3.5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] sm:text-base font-bold text-slate-900 tracking-tight leading-none">
                  {cleanSymbol}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${isOpen ? 'bg-emerald-100 text-[#008f6b]' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                  {isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                <span
                  className={`font-black ${optionType === 'CE' ? 'text-[#008f6b]' : 'text-[#d93838]'
                    }`}
                >
                  {optionType === 'CE' ? 'Call' : 'Put'}
                </span>
                <span className="text-slate-300">•</span>
                <span>{pos.exchange || 'NSE'}</span>
                <span className="text-slate-300">•</span>
                <span>{pos.productType === 'NRML' ? 'Delivery' : 'Intraday'}</span>
              </div>
            </div>
          </div>

          {/* More Action Menu ⋮ & Close Button */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="More Actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl py-1.5 z-40 text-xs font-bold text-slate-700 animate-fadeIn divide-y divide-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setActiveTab('option-chain');
                      onClose();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <BarChart2 className="w-4 h-4 text-indigo-500" />
                    <span>Option Chain</span>
                  </button>
                  {isOpen && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setActiveSheet('SL_TGT');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-amber-500" />
                        <span>SL / Target Controls</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setActiveSheet('ADD_MORE');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#008f6b]" />
                        <span>Add More Lots</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setActiveSheet('DETAILS');
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Info className="w-4 h-4 text-sky-500" />
                    <span>Position Details</span>
                  </button>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setActiveSheet('FAST_EXIT');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current text-rose-500" />
                      <span>⚡ Fast Exit</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. SCROLLABLE CONTENT BODY ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 styled-scrollbar">
          {/* ── 2.1 PROMINENT LIVE P&L HERO ── */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 border border-slate-200/80 text-center relative overflow-hidden">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isOpen ? 'Current P&L' : 'Final Realized P&L'}
            </div>
            <div
              className={`text-3xl sm:text-4xl font-extrabold font-mono-num tracking-tight mt-1 ${isProfit ? 'text-[#008f6b]' : 'text-[#d93838]'
                }`}
            >
              {isProfit ? '+' : ''}
              {formatINR(displayPnl)}
            </div>
            <div
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black font-mono-num mt-1.5 ${isProfit
                ? 'bg-emerald-100/90 text-[#008f6b]'
                : 'bg-rose-100/90 text-[#d93838]'
                }`}
            >
              {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{isProfit ? '+' : ''}{returnPct.toFixed(2)}% {isOpen ? '' : 'Realized'}</span>
            </div>

            {/* 4-Grid Position Breakdown */}
            <div className="grid grid-cols-4 gap-2 mt-4 pt-3.5 border-t border-slate-200/60 text-xs font-mono-num">
              {isOpen ? (
                <>
                  <div>
                    <div className="text-[10.5px] text-slate-400 font-semibold">Avg Price</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">₹{formatNumber(avgPrice)}</div>
                  </div>
                  <div className="border-l border-slate-200/60 pl-2">
                    <div className="text-[10.5px] text-slate-400 font-semibold">Quantity</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">{qty} ({lots}L)</div>
                  </div>
                  <div className="border-l border-slate-200/60 pl-2">
                    <div className="text-[10.5px] text-slate-400 font-semibold">Invested</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">{formatINR(totalInvested)}</div>
                  </div>
                  <div className="border-l border-slate-200/60 pl-2">
                    <div className="text-[10.5px] text-slate-400 font-semibold">LTP</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">₹{formatNumber(ltp)}</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-[10.5px] text-slate-400 font-semibold">Avg Buy</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">₹{formatNumber(buyPrice)}</div>
                  </div>
                  <div className="border-l border-slate-200/60 pl-2">
                    <div className="text-[10.5px] text-slate-400 font-semibold">Avg Sell</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">₹{formatNumber(sellPrice)}</div>
                  </div>
                  <div className="border-l border-slate-200/60 pl-2">
                    <div className="text-[10.5px] text-slate-400 font-semibold">Traded Qty</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">{totalTradedQty} ({totalLots}L)</div>
                  </div>
                  <div className="border-l border-slate-200/60 pl-2">
                    <div className="text-[10.5px] text-slate-400 font-semibold">Exit LTP</div>
                    <div className="text-slate-900 font-extrabold mt-0.5">₹{formatNumber(ltp)}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── 2.2 CLEAN & SIMPLE: ADD TARGET & STOP LOSS ROW ── */}
          <div
            onClick={() => isOpen && setActiveSheet('SL_TGT')}
            className={`p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between transition-all ${isOpen ? 'cursor-pointer hover:bg-slate-50 active:scale-99 shadow-2xs' : ''
              }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#008f6b] flex items-center justify-center shrink-0 border border-emerald-100/80">
                <Target className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>{isSlActive || isTgtActive || isTrailingSl ? 'Target & Stop Loss' : 'Add Target & Stop Loss'}</span>
                </div>
                <div className="text-[11px] font-mono-num text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>SL: <strong className={slPrice || pos.stopLoss ? 'text-rose-600 font-bold' : 'text-slate-600'}>{slPrice ? `₹${slPrice}` : pos.stopLoss ? `₹${pos.stopLoss}` : 'Not set'}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Target: <strong className={tgtPrice || pos.target ? 'text-[#008f6b] font-bold' : 'text-slate-600'}>{tgtPrice ? `₹${tgtPrice}` : pos.target ? `₹${pos.target}` : 'Not set'}</strong></span>
                  {isTrailingSl && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-amber-600 font-bold">Trail ₹{trailStep}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="flex items-center gap-1 text-xs font-extrabold text-[#008f6b] shrink-0 pl-2">
                <span>{isSlActive || isTgtActive ? 'Edit' : '+ Add'}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* ── 3. MAIN BOTTOM ACTION BAR ── */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-3 shrink-0">
          {isOpen ? (
            <>
              {/* Buy Button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openOrderPad({
                    contractId: pos.contractId,
                    tradingSymbol: pos.tradingSymbol,
                    symbol: pos.symbol || 'NIFTY',
                    strikePrice: pos.strikePrice || 24000,
                    optionType: pos.optionType || (pos.tradingSymbol?.endsWith('PE') ? 'PE' : 'CE'),
                    lotSize: lotSize,
                    ltp: ltp,
                    defaultAction: 'BUY',
                    defaultProductType: pos.productType || 'NRML',
                    defaultLots: 1,
                  });
                }}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#008f6b] border border-emerald-200/90 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Buy More</span>
              </button>

              {/* ⚡ Sell at Market Price Button */}
              <button
                type="button"
                onClick={() => setActiveSheet('EXIT')}
                className="flex-1 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-98"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Sell at Market</span>
              </button>
            </>
          ) : (
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openOrderPad({
                    contractId: pos.contractId,
                    tradingSymbol: pos.tradingSymbol,
                    symbol: pos.symbol || 'NIFTY',
                    strikePrice: pos.strikePrice || 24000,
                    optionType: pos.optionType || (pos.tradingSymbol.endsWith('PE') ? 'PE' : 'CE'),
                    lotSize: lotSize,
                    ltp: ltp,
                    defaultAction: 'BUY',
                    defaultProductType: pos.productType || 'NRML',
                    defaultLots: 1,
                  });
                }}
                className="flex-1 py-3.5 rounded-2xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
              >
                <RotateCw className="w-4 h-4 stroke-[2.5]" />
                <span>Re-Trade / Order Pad</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <span>Close</span>
              </button>
            </div>
          )}
        </div>

        {/* ── SUB-SHEET 1: SL / TARGET CONFIGURATION MODAL ── */}
        {activeSheet === 'SL_TGT' && (
          <div
            className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
            onClick={() => setActiveSheet('NONE')}
          >
            <div
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#008f6b]" />
                  <h3 className="text-base font-bold text-slate-900">Set Trigger Orders (SL & Target)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSheet('NONE')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono-num flex justify-between bg-slate-50 p-2.5 rounded-xl">
                <span>Entry: <strong>₹{formatNumber(avgPrice)}</strong></span>
                <span>LTP: <strong>₹{formatNumber(ltp)}</strong></span>
                <span>Qty: <strong>{qty} ({lots}L)</strong></span>
              </div>

              {/* Stop Loss Config */}
              <div className={`p-3 rounded-2xl border space-y-2 transition-colors ${
                isSlInvalid ? 'bg-rose-100/60 border-rose-400' : 'bg-rose-50/50 border-rose-200/80'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                  <span>Stop Loss Trigger Price (₹)</span>
                  <span className="text-[11px] font-mono-num text-rose-600">
                    {isSlInvalid
                      ? (isLong ? 'Must be < LTP' : 'Must be > LTP')
                      : estSlLoss !== null
                      ? `Est Loss: ${formatINR(estSlLoss)}`
                      : '₹0'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.05"
                    placeholder={isLong ? `< ₹${formatNumber(ltp)}` : `> ₹${formatNumber(ltp)}`}
                    value={slPrice}
                    onChange={(e) => setSlPrice(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border bg-white font-mono-num focus:outline-none ${
                      isSlInvalid
                        ? 'border-rose-500 text-rose-700 focus:border-rose-600 ring-1 ring-rose-300'
                        : 'border-slate-200 focus:border-rose-500'
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="SL % (e.g. 10)"
                    value={slPercent}
                    onChange={(e) => handleSlPercentChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white font-mono-num focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Quick SL % Chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400">Quick SL:</span>
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleSlPercentChange(String(pct))}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs"
                    >
                      {isLong ? `-${pct}%` : `+${pct}%`}
                    </button>
                  ))}
                </div>

                {isSlInvalid && (
                  <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-0.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>
                      {isLong
                        ? numSl >= ltp
                          ? `Stop Loss for BUY must be less than live LTP (₹${formatNumber(ltp)})`
                          : `Stop Loss must be strictly less than Target (₹${numTgt})`
                        : numSl <= ltp
                        ? `Stop Loss for SELL must be greater than live LTP (₹${formatNumber(ltp)})`
                        : `Stop Loss must be strictly greater than Target (₹${numTgt})`}
                    </span>
                  </div>
                )}
              </div>

              {/* Target Config */}
              <div className={`p-3 rounded-2xl border space-y-2 transition-colors ${
                isTgtInvalid ? 'bg-rose-100/60 border-rose-400' : 'bg-emerald-50/50 border-emerald-200/80'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-[#008f6b]">
                  <span>Target Price (₹)</span>
                  <span className="text-[11px] font-mono-num text-emerald-700">
                    {isTgtInvalid
                      ? (isLong ? 'Must be > LTP' : 'Must be < LTP')
                      : estTgtProfit !== null
                      ? `Est Profit: ${formatINR(estTgtProfit)}`
                      : '₹0'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.05"
                    placeholder={isLong ? `> ₹${formatNumber(ltp)}` : `< ₹${formatNumber(ltp)}`}
                    value={tgtPrice}
                    onChange={(e) => setTgtPrice(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border bg-white font-mono-num focus:outline-none ${
                      isTgtInvalid
                        ? 'border-rose-500 text-rose-700 focus:border-rose-600 ring-1 ring-rose-300'
                        : 'border-slate-200 focus:border-[#00D09C]'
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="Target % (e.g. 20)"
                    value={tgtPercent}
                    onChange={(e) => handleTgtPercentChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white font-mono-num focus:outline-none focus:border-[#00D09C]"
                  />
                </div>

                {/* Quick Target % Chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400">Quick Target:</span>
                  {[5, 10, 20, 30].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleTgtPercentChange(String(pct))}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
                    >
                      {isLong ? `+${pct}%` : `-${pct}%`}
                    </button>
                  ))}
                </div>

                {isTgtInvalid && (
                  <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pt-0.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>
                      {isLong
                        ? numTgt <= ltp
                          ? `Target for BUY must be greater than live LTP (₹${formatNumber(ltp)})`
                          : `Target must be strictly greater than Stop Loss (₹${numSl})`
                        : numTgt >= ltp
                        ? `Target for SELL must be less than live LTP (₹${formatNumber(ltp)})`
                        : `Target must be strictly less than Stop Loss (₹${numSl})`}
                    </span>
                  </div>
                )}
              </div>

              {/* Trailing Stop Loss Toggle */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Trailing Stop Loss</span>
                  <button
                    type="button"
                    onClick={() => setIsTrailingSl(!isTrailingSl)}
                    className={`w-10 h-5 rounded-full transition-colors flex items-center p-0.5 cursor-pointer ${isTrailingSl ? 'bg-[#00D09C] justify-end' : 'bg-slate-300 justify-start'
                      }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>
                {isTrailingSl && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500 font-medium">Trail by (₹):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={trailStep}
                      onChange={(e) => setTrailStep(e.target.value)}
                      className="w-24 px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white font-mono-num"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleRemoveRiskControls}
                  disabled={isSubmittingRisk}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={handleSaveRiskControls}
                  disabled={isSubmittingRisk || isSlInvalid || isTgtInvalid}
                  className="flex-1 py-3 rounded-2xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingRisk ? 'Saving...' : 'Save Trigger Orders'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-SHEET 2: ADD MORE QUANTITY MODAL ── */}
        {activeSheet === 'ADD_MORE' && (
          <div
            className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
            onClick={() => setActiveSheet('NONE')}
          >
            <div
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#008f6b]" />
                  <span>Add to Position</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSheet('NONE')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs font-mono-num bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex justify-between text-slate-500">
                  <span>Current Qty:</span>
                  <span className="text-slate-900 font-bold">{qty} ({lots} Lots)</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Current Avg Price:</span>
                  <span className="text-slate-900 font-bold">₹{formatNumber(avgPrice)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Market LTP:</span>
                  <span className="text-slate-900 font-bold">₹{formatNumber(ltp)}</span>
                </div>
                <div className="flex justify-between text-slate-500 pt-1.5 border-t border-slate-200">
                  <span>Available Margin:</span>
                  <span className="text-emerald-700 font-bold">{formatINR(wallet?.availableMargin || 0)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-800">Additional Lots to Add:</label>
                  <span className="text-slate-500 font-medium font-mono-num">NSE lot of <strong>{lotSize}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddLots(Math.max(1, addLots - 1))}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-lg flex items-center justify-center cursor-pointer active:scale-95 transition-colors border border-slate-200"
                  >
                    -
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white border border-slate-200 rounded-xl focus-within:border-[#00D09C] focus-within:ring-2 focus-within:ring-[#00D09C]/20 transition-all shadow-xs">
                    <input
                      type="number"
                      min={1}
                      value={addLots || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setAddLots(isNaN(val) || val <= 0 ? 1 : val);
                      }}
                      className="w-16 text-center font-mono-num font-black text-base text-slate-900 bg-transparent focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500 font-mono-num">
                      Lots ({addQty} Qty)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddLots(addLots + 1)}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-lg flex items-center justify-center cursor-pointer active:scale-95 transition-colors border border-slate-200"
                  >
                    +
                  </button>
                </div>

                {/* Quick Add Presets */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[1, 2, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAddLots(preset)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold font-mono-num transition-all cursor-pointer ${
                        addLots === preset
                          ? 'bg-[#00D09C] text-black shadow-xs font-black'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      +{preset} {preset === 1 ? 'Lot' : 'Lots'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Estimates */}
              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5 text-xs font-mono-num">
                <div className="flex justify-between text-slate-600">
                  <span>Estimated Investment:</span>
                  <span className="text-slate-900 font-extrabold">{formatINR(estimatedAddInvest)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>New Total Qty:</span>
                  <span className="text-slate-900 font-extrabold">{newTotalQty} ({newTotalQty / lotSize}L)</span>
                </div>
                <div className="flex justify-between text-slate-600 font-semibold pt-1 border-t border-emerald-200/60">
                  <span>Estimated New Average:</span>
                  <span className="text-[#008f6b] font-black">₹{formatNumber(estimatedNewAvg)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveSheet('NONE')}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isExiting}
                  onClick={handleConfirmAddMore}
                  className="flex-1 py-3 rounded-2xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isExiting ? 'Placing Order...' : 'Add More Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-SHEET 3: EXIT POSITION MODAL (FULL / PARTIAL) ── */}
        {activeSheet === 'EXIT' && (
          <div
            className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
            onClick={() => setActiveSheet('NONE')}
          >
            <div
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                  <Zap className="w-5 h-5 fill-current" />
                  <span>{isLong ? 'Sell at Market Price' : 'Buy to Cover (Market Exit)'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSheet('NONE')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {exitSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#008f6b] text-xs font-bold">
                  {exitSuccessMsg}
                </div>
              )}

              <div className="space-y-2 text-xs font-mono-num bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex justify-between text-slate-500">
                  <span>Instrument:</span>
                  <span className="text-slate-900 font-bold">{cleanSymbol}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Open Qty:</span>
                  <span className="text-slate-900 font-bold">{qty} ({lots} Lots)</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Market LTP:</span>
                  <span className="text-slate-900 font-bold">₹{formatNumber(ltp)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Estimated Market Value:</span>
                  <span className="text-slate-900 font-extrabold">{formatINR(estimatedExitVal)}</span>
                </div>
              </div>

              {/* Partial vs Full Exit Controls */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>Quantity to {isLong ? 'Sell' : 'Buy'}:</span>
                  <span className="font-mono-num text-[#008f6b] font-black">{exitQty} Units ({exitLots} Lots)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExitLots(Math.max(1, exitLots - 1))}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-lg flex items-center justify-center cursor-pointer active:scale-95 transition-colors border border-slate-200"
                  >
                    -
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white border border-slate-200 rounded-xl focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 transition-all shadow-xs">
                    <input
                      type="number"
                      min={1}
                      max={lots}
                      value={exitLots || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setExitLots(isNaN(val) || val <= 0 ? 1 : Math.min(lots, val));
                      }}
                      className="w-16 text-center font-mono-num font-black text-base text-slate-900 bg-transparent focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500 font-mono-num">
                      Lots / {lots} Max
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExitLots(Math.min(lots, exitLots + 1))}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-lg flex items-center justify-center cursor-pointer active:scale-95 transition-colors border border-slate-200"
                  >
                    +
                  </button>
                </div>

                {/* Quick Exit Percentage Chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[
                    { label: '25%', frac: 0.25 },
                    { label: '50%', frac: 0.5 },
                    { label: '75%', frac: 0.75 },
                    { label: '100% (All)', frac: 1.0 },
                  ].map((pct) => {
                    const computedLots = Math.max(1, Math.round(lots * pct.frac));
                    return (
                      <button
                        key={pct.label}
                        type="button"
                        onClick={() => setExitLots(computedLots)}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-bold font-mono-num transition-all cursor-pointer ${
                          exitLots === computedLots
                            ? 'bg-rose-600 text-white shadow-xs font-black'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {pct.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveSheet('NONE')}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isExiting}
                  onClick={() => handleConfirmExit(exitQty)}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isExiting ? 'Executing...' : isFullExit ? (isLong ? 'Sell All at Market Price' : 'Buy All at Market Price') : (isLong ? `Sell ${exitQty} Qty at Market` : `Buy ${exitQty} Qty at Market`)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-SHEET 4: FAST 1-CLICK EXIT CONFIRMATION ── */}
        {activeSheet === 'FAST_EXIT' && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn"
            onClick={() => setActiveSheet('NONE')}
          >
            <div
              className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-3 text-center animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Exit entire position?</h3>
              <p className="text-xs text-slate-500 font-mono-num">
                {cleanSymbol} • <strong className="text-slate-900">{qty} Qty</strong>
              </p>
              <p className="text-[11px] text-slate-400">
                A market order will be sent to immediately square off this trade. This cannot be undone.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSheet('NONE')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isExiting}
                  onClick={() => handleConfirmExit(qty)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isExiting ? 'Exiting...' : 'Fast Exit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-SHEET 5: FULL POSITION DETAILS ── */}
        {activeSheet === 'DETAILS' && (
          <div
            className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
            onClick={() => setActiveSheet('NONE')}
          >
            <div
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-slideUp max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Info className="w-5 h-5 text-sky-500" />
                  <span>Position Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSheet('NONE')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono-num">
                {/* Trade Info */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Trade Information
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Instrument:</span>
                    <span className="text-slate-900 font-bold">{cleanSymbol}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Exchange / Segment:</span>
                    <span className="text-slate-900 font-bold">{pos.exchange || 'NSE'} • {pos.productType === 'NRML' ? 'Delivery' : 'Intraday'}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Side:</span>
                    <span className={`font-black ${isLong ? 'text-[#008f6b]' : 'text-[#d93838]'}`}>{isLong ? 'BUY' : 'SELL'}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Contract ID:</span>
                    <span className="text-slate-900">{pos.contractId}</span>
                  </div>
                </div>

                {/* Quantities & Pricing */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Quantities & Pricing
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{isOpen ? 'Open Quantity:' : 'Total Traded Quantity:'}</span>
                    <span className="text-slate-900 font-bold">{totalTradedQty} ({totalLots} Lots)</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Average Entry (Buy) Price:</span>
                    <span className="text-slate-900 font-bold">₹{formatNumber(buyPrice || avgPrice)}</span>
                  </div>
                  {!isOpen && (
                    <div className="flex justify-between text-slate-500">
                      <span>Average Exit (Sell) Price:</span>
                      <span className="text-slate-900 font-bold">₹{formatNumber(sellPrice)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>Live Market LTP:</span>
                    <span className="text-slate-900 font-bold">₹{formatNumber(ltp)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{isOpen ? 'Capital Invested:' : 'Gross Executed Buy Value:'}</span>
                    <span className="text-slate-900 font-bold">{formatINR(totalInvested)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{isOpen ? 'Current Position Value:' : 'Gross Executed Sell Value:'}</span>
                    <span className="text-slate-900 font-bold">{formatINR(totalExitVal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 pt-1.5 border-t border-slate-200">
                    <span>{isOpen ? 'Net Unrealized P&L:' : 'Net Realized P&L:'}</span>
                    <span className={`font-black ${isProfit ? 'text-[#008f6b]' : 'text-[#d93838]'}`}>
                      {isProfit ? '+' : ''}{formatINR(pos.totalPnl)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSheet('NONE')}
                className="w-full py-3 rounded-2xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800 transition-colors cursor-pointer"
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

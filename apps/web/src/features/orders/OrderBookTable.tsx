import React, { useState } from 'react';
import { useTradingStore, type SelectedContract } from '../../app/store/useTradingStore.js';
import type { OptionOrderEntity } from '@trademitra/shared';
import { useToast } from '../../components/ui/Toast.js';
import { formatNumber } from '../../lib/utils.js';
import {
  ArrowUpRight,
  X,
  Plus,
  Minus,
  ArrowLeft,
  ShieldAlert,
  Clock,
  AlertTriangle,
} from 'lucide-react';
const formatDisplaySymbol = (sym?: string) => {
  if (!sym) return '';
  const parts = sym.split('_');
  if (parts.length >= 4) {
    const symbol = parts[0]!;
    const expCode = parts[1]!;
    const day = expCode.slice(0, 2);
    const mon = expCode.slice(2).toUpperCase();
    const monMap: Record<string, string> = {
      JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
      JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec',
    };
    const monStr = monMap[mon] || mon;
    const strike = parts[2]!;
    const typeStr = parts[3] === 'PE' ? 'Put' : 'Call';
    return `${symbol} ${day} ${monStr} ${strike} ${typeStr}`;
  }
  return sym;
};

export const OrderBookTable: React.FC = () => {
  const toast = useToast();
  const {
    orders,
    setActiveTab,
    cancelOrder,
    cancelAllOrders,
    modifyOrder,
    openOrderPad,
    optionChain,
    positionsSummary,
  } = useTradingStore();

  const [filter, setFilter] = useState<'ALL' | 'EXECUTED' | 'PENDING' | 'REJECTED' | 'CANCELLED'>('ALL');

  // Full-screen / Modal state for modifying pending order (Screenshots 2 & 4)
  const [modifyingOrder, setModifyingOrder] = useState<OptionOrderEntity | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editTriggerPrice, setEditTriggerPrice] = useState<string>('');
  const [editTargetPrice, setEditTargetPrice] = useState<string>('');
  const [editTrailingStopLoss, setEditTrailingStopLoss] = useState<string>('');
  const [editLots, setEditLots] = useState<number>(1);
  const [isTrailEnabled, setIsTrailEnabled] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal state for Option & Order details
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OptionOrderEntity | null>(null);

  // Confirmation modals state
  const [orderToCancel, setOrderToCancel] = useState<OptionOrderEntity | null>(null);
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const filteredOrders = sortedOrders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  // Calculate live market price (LTP) with fallbacks
  const getLiveLtp = (order: OptionOrderEntity): number => {
    if (order.ltp && order.ltp > 0) return order.ltp;
    if (optionChain && optionChain.chain) {
      for (const strike of optionChain.chain) {
        if (order.optionType === 'CE' && strike.ce && (strike.ce.tradingSymbol === order.tradingSymbol || strike.ce.contractId === order.contractId)) {
          return strike.ce.ltp;
        }
        if (order.optionType === 'PE' && strike.pe && (strike.pe.tradingSymbol === order.tradingSymbol || strike.pe.contractId === order.contractId)) {
          return strike.pe.ltp;
        }
      }
    }
    const pos = positionsSummary?.positions.find(
      (p) => p.tradingSymbol === order.tradingSymbol || p.contractId === order.contractId
    );
    if (pos?.ltp) return pos.ltp;
    return order.averagePrice || order.price || 0;
  };

  // Determine contract lot size
  const getLotSize = (order: OptionOrderEntity): number => {
    const sym = (order.symbol || order.tradingSymbol || '').toUpperCase();
    if (sym.includes('BANKNIFTY')) return 15;
    if (sym.includes('FINNIFTY')) return 25;
    if (sym.includes('MIDCPNIFTY')) return 50;
    if (sym.includes('SENSEX')) return 10;
    return 25;
  };

  // Reorder / Retry order CTA action
  const handleRetryOrder = (order: OptionOrderEntity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const lotSize = getLotSize(order);
    const lots = Math.max(1, Math.round(order.quantity / lotSize));
    const livePrice = getLiveLtp(order) || order.price || 0;

    const contractToOrder: SelectedContract = {
      contractId: order.contractId,
      tradingSymbol: order.tradingSymbol || `Contract #${order.contractId}`,
      symbol: order.symbol || 'NIFTY',
      strikePrice: order.strikePrice || 0,
      optionType: (order.optionType as 'CE' | 'PE') || 'CE',
      lotSize,
      ltp: livePrice,
      defaultAction: 'BUY', // Select BUY by default when retrying
      defaultOrderType: order.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
      defaultProductType: order.productType || 'NRML',
      defaultLots: lots,
      defaultLimitPrice: order.price ? String(order.price) : (livePrice ? String(livePrice) : ''),
      defaultTriggerPrice: '',
      defaultTargetPrice: '',
    };

    openOrderPad(contractToOrder);
    if (selectedOrderDetails) {
      setSelectedOrderDetails(null);
    }
  };

  // Open Modify dialog
  const handleOpenModify = (order: OptionOrderEntity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModifyingOrder(order);
    setErrorMsg('');
    const lotSize = getLotSize(order);
    const lots = Math.max(1, Math.round(order.quantity / lotSize));
    setEditLots(lots);
    setEditPrice(order.price !== undefined && order.price !== null ? String(order.price) : '');
    setEditTriggerPrice(order.triggerPrice !== undefined && order.triggerPrice !== null ? String(order.triggerPrice) : '');
    setEditTargetPrice(order.targetPrice !== undefined && order.targetPrice !== null ? String(order.targetPrice) : '');
    setEditTrailingStopLoss(order.trailingStopLoss !== undefined && order.trailingStopLoss !== null ? String(order.trailingStopLoss) : '20.0');
    setIsTrailEnabled(Boolean(order.trailingStopLoss && order.trailingStopLoss > 0));
  };

  const handleSaveModify = async () => {
    if (!modifyingOrder) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const lotSize = getLotSize(modifyingOrder);
      const totalQty = editLots * lotSize;

      const payload: {
        price?: number;
        triggerPrice?: number;
        targetPrice?: number;
        trailingStopLoss?: number;
        quantity?: number;
      } = {
        quantity: totalQty,
      };

      if (editPrice !== '') {
        const p = parseFloat(editPrice);
        if (isNaN(p) || p <= 0) {
          setErrorMsg('Please enter a valid execution/limit price.');
          setIsSubmitting(false);
          return;
        }
        payload.price = p;
      }

      const liveLtp = getLiveLtp(modifyingOrder);
      const execPrice =
        payload.price !== undefined
          ? payload.price
          : (modifyingOrder.price || modifyingOrder.averagePrice || liveLtp || 0);

      const matchedPos = positionsSummary?.positions.find(
        (p) => p.tradingSymbol === modifyingOrder.tradingSymbol || p.contractId === modifyingOrder.contractId
      );
      const isLongTrade = matchedPos
        ? (matchedPos.netQuantity > 0 || (matchedPos.netQuantity === 0 && modifyingOrder.transactionType === 'BUY'))
        : (modifyingOrder.transactionType === 'BUY' || (modifyingOrder.triggerPrice !== undefined && modifyingOrder.triggerPrice < liveLtp));

      const tp = editTriggerPrice !== '' ? parseFloat(editTriggerPrice) : NaN;
      const tgt = editTargetPrice !== '' ? parseFloat(editTargetPrice) : NaN;

      // Check if this order has Stop Loss protection attached
      if (!isNaN(tp) && tp > 0) {
        if (liveLtp > 0) {
          if (isLongTrade) {
            if (tp >= liveLtp) {
              setErrorMsg(`Stop Loss (₹${tp.toFixed(2)}) must be strictly less than live LTP (₹${formatNumber(liveLtp)}).`);
              setIsSubmitting(false);
              return;
            }
            if (!isNaN(tgt) && tgt > 0 && tp >= tgt) {
              setErrorMsg(`Stop Loss (₹${tp.toFixed(2)}) must be strictly less than Target (₹${tgt.toFixed(2)}).`);
              setIsSubmitting(false);
              return;
            }
          } else {
            if (tp <= liveLtp) {
              setErrorMsg(`Stop Loss (₹${tp.toFixed(2)}) must be strictly greater than live LTP (₹${formatNumber(liveLtp)}).`);
              setIsSubmitting(false);
              return;
            }
            if (!isNaN(tgt) && tgt > 0 && tp <= tgt) {
              setErrorMsg(`Stop Loss (₹${tp.toFixed(2)}) must be strictly greater than Target (₹${tgt.toFixed(2)}).`);
              setIsSubmitting(false);
              return;
            }
          }
        }
        payload.triggerPrice = tp;

        if (isTrailEnabled && editTrailingStopLoss !== '') {
          const trail = parseFloat(editTrailingStopLoss);
          if (!isNaN(trail) && trail > 0) {
            payload.trailingStopLoss = trail;
          }
        }
      }

      if (!isNaN(tgt) && tgt > 0) {
        if (liveLtp > 0) {
          if (isLongTrade) {
            if (tgt <= liveLtp) {
              setErrorMsg(`Target price (₹${tgt.toFixed(2)}) must be strictly greater than live LTP (₹${formatNumber(liveLtp)}).`);
              setIsSubmitting(false);
              return;
            }
            if (!isNaN(tp) && tp > 0 && tgt <= tp) {
              setErrorMsg(`Target price (₹${tgt.toFixed(2)}) must be strictly greater than Stop Loss (₹${tp.toFixed(2)}).`);
              setIsSubmitting(false);
              return;
            }
          } else {
            if (tgt >= liveLtp) {
              setErrorMsg(`Target price (₹${tgt.toFixed(2)}) must be strictly less than live LTP (₹${formatNumber(liveLtp)}).`);
              setIsSubmitting(false);
              return;
            }
            if (!isNaN(tp) && tp > 0 && tgt >= tp) {
              setErrorMsg(`Target price (₹${tgt.toFixed(2)}) must be strictly less than Stop Loss (₹${tp.toFixed(2)}).`);
              setIsSubmitting(false);
              return;
            }
          }
        }
        payload.targetPrice = tgt;
      }

      await modifyOrder(modifyingOrder.id, payload);
      toast.success(
        'Order Modified Successfully',
        `Order #${modifyingOrder.id} updated to price ₹${formatNumber(execPrice)} (${totalQty} qty)`
      );
      setModifyingOrder(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to modify order.';
      setErrorMsg(msg);
      toast.error('Modification Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-groww-card border border-groww-border rounded-2xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-groww-surface border border-groww-border flex items-center justify-center text-groww-textMuted mb-4">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">No Orders Placed Yet</h3>
        <p className="text-xs text-groww-textSubtle max-w-sm mb-6">
          Your open and executed paper trading orders will appear here.
        </p>
        <button
          onClick={() => setActiveTab('option-chain')}
          className="py-2.5 px-6 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-bold transition-all shadow-lg shadow-emerald-950/30 flex items-center gap-2 cursor-pointer"
        >
          <span>Trade via Option Chain</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Check if an order has Stoploss or Target attached
  const hasSLorTarget = (ord: OptionOrderEntity): boolean => {
    return Boolean(
      (ord.triggerPrice && ord.triggerPrice > 0) ||
      (ord.targetPrice && ord.targetPrice > 0) ||
      (ord.trailingStopLoss && ord.trailingStopLoss > 0)
    );
  };

  return (
    <div className="space-y-4">
      {/* Header bar with Clean Minimal Filter Tabs and Cancel All Orders CTA */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 max-w-full overflow-x-auto no-scrollbar">
          {(['ALL', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED'] as const).map((tab) => {
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>
                  {tab === 'ALL'
                    ? 'All'
                    : tab === 'PENDING'
                    ? 'Open'
                    : tab === 'EXECUTED'
                    ? 'Executed'
                    : tab === 'CANCELLED'
                    ? 'Cancelled'
                    : 'Rejected'}
                </span>
                {tab === 'PENDING' && pendingOrdersCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {pendingOrdersCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Cancel All Pending Orders Button */}
        {pendingOrdersCount > 0 && (
          <button
            type="button"
            onClick={() => setShowCancelAllConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Cancel all pending orders"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel all ({pendingOrdersCount})</span>
          </button>
        )}
      </div>

      {/* Orders Container */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Today's Equity F&O Orders ({filteredOrders.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No orders found in <span className="text-slate-900 font-bold">{filter}</span> category.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isBuy = order.transactionType === 'BUY';
              const isPending = order.status === 'PENDING';
              const isExecuted = order.status === 'EXECUTED';
              const isInactive = order.status === 'CANCELLED' || order.status === 'REJECTED';

              // Format execution or limit/trigger price description
              let priceDesc = 'Market';
              if (isExecuted) {
                priceDesc = `Avg at ₹${formatNumber(order.averagePrice || order.price || 0)}`;
              } else if (order.triggerPrice) {
                priceDesc = `SL at ₹${formatNumber(order.triggerPrice)}`;
              } else if (order.price) {
                priceDesc = `Limit at ₹${formatNumber(order.price)}`;
              } else if (order.status === 'CANCELLED') {
                priceDesc = `Cancelled at ₹${formatNumber(order.price || 0)}`;
              } else if (order.status === 'REJECTED') {
                priceDesc = `Rejected`;
              }

              // Time formatting (e.g. 3:31 PM)
              const timeStr = order.executedAt
                ? new Date(order.executedAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                : order.createdAt
                ? new Date(order.createdAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                : '';

              return (
                <div
                  key={order.id}
                  onClick={() => {
                    if (isPending) {
                      handleOpenModify(order);
                    } else {
                      setSelectedOrderDetails(order);
                    }
                  }}
                  className={`p-4 space-y-1.5 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer ${
                    isInactive ? 'opacity-85' : ''
                  }`}
                >
                  {/* Row 1: Time on Left, BUY / SELL on Right */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono-num font-medium">{timeStr}</span>

                    <span
                      className={`font-black text-xs tracking-wider uppercase ${
                        isBuy ? 'text-[#008f6b]' : 'text-[#EB5B5B]'
                      }`}
                    >
                      {order.transactionType}
                    </span>
                  </div>

                  {/* Row 2: Instrument Name on Left, Status Dot + Qty on Right */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
                      {formatDisplaySymbol(order.tradingSymbol) || `Contract #${order.contractId}`}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Status Dot: Green for Success/Executed, Amber for Open/Pending, Red for Failed/Rejected/Cancelled */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isExecuted
                            ? 'bg-[#00D09C]'
                            : isPending
                            ? 'bg-amber-400'
                            : 'bg-[#EB5B5B]'
                        }`}
                      />
                      <span className="text-sm sm:text-base font-black text-slate-900 font-mono-num">
                        {order.quantity}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Product Type (Delivery/Intraday) on Left, Limit/Avg Price on Right */}
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono-num">
                    <span>{order.productType === 'NRML' ? 'Delivery' : 'Intraday'}</span>
                    <span>{priceDesc}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>



      {/* 3. Modify Order Modal */}
      {modifyingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn"
          onClick={() => setModifyingOrder(null)}
        >
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar: Back arrow, Symbol, Depth, LTP */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModifyingOrder(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {formatDisplaySymbol(modifyingOrder.tradingSymbol)}
                  </h3>
                  <div className="text-xs text-slate-500 font-mono-num flex items-center gap-2">
                    <span>₹{formatNumber(getLiveLtp(modifyingOrder))}</span>
                    <span className="text-slate-400">(0.00%)</span>
                  </div>
                </div>
              </div>

              <span className="text-xs font-semibold text-slate-400">Depth</span>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!hasSLorTarget(modifyingOrder) && (
              <div className="flex items-center gap-2 pt-1">
                <span className="px-4 py-1.5 rounded-full text-xs font-bold border border-slate-300 text-slate-800 bg-slate-100">
                  {modifyingOrder.productType === 'NRML' ? 'Delivery' : 'Intraday'}
                </span>
              </div>
            )}

            {/* Quantity Row */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-sm font-semibold text-slate-900">Qty</div>
                <div className="text-xs text-slate-500 font-mono-num">
                  {editLots} lot x {getLotSize(modifyingOrder)}
                </div>
              </div>

              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden focus-within:border-[#00D09C] focus-within:bg-white transition-colors">
                <button
                  type="button"
                  onClick={() => setEditLots((l) => Math.max(1, l - 1))}
                  className="w-9 h-9 flex items-center justify-center text-slate-600 hover:text-slate-900 border-r border-slate-200 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  step={getLotSize(modifyingOrder)}
                  min={getLotSize(modifyingOrder)}
                  value={editLots * getLotSize(modifyingOrder)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    const lSize = getLotSize(modifyingOrder);
                    if (!isNaN(val) && val > 0) {
                      setEditLots(Math.max(1, Math.round(val / lSize)));
                    }
                  }}
                  className="w-16 text-center text-sm font-bold text-slate-900 font-mono-num bg-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setEditLots((l) => l + 1)}
                  className="w-9 h-9 flex items-center justify-center text-slate-600 hover:text-slate-900 border-l border-slate-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Price Limit Row */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                <span>Price Limit</span>
              </span>

              <div className="flex items-center border border-slate-200 rounded-xl bg-white px-3 py-1.5 focus-within:border-[#00D09C] focus-within:ring-2 focus-within:ring-[#00D09C]/20 transition-all shadow-xs">
                <span className="text-slate-400 text-sm mr-1 font-bold">₹</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={editPrice}
                  onChange={(e) => {
                    setEditPrice(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-28 text-right text-base font-extrabold font-mono-num text-slate-900 bg-transparent focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* IF ORDER HAS STOP LOSS: Render Stop Loss & Target Sections */}
            {hasSLorTarget(modifyingOrder) ? (() => {
              const liveLtp = getLiveLtp(modifyingOrder);
              const matchedPos = positionsSummary?.positions.find(
                (p) => p.tradingSymbol === modifyingOrder.tradingSymbol || p.contractId === modifyingOrder.contractId
              );
              const isLongTrade = matchedPos
                ? (matchedPos.netQuantity > 0 || (matchedPos.netQuantity === 0 && modifyingOrder.transactionType === 'BUY'))
                : (modifyingOrder.transactionType === 'BUY' || (modifyingOrder.triggerPrice !== undefined && modifyingOrder.triggerPrice < liveLtp));

              const numSl = parseFloat(editTriggerPrice);
              const numTgt = parseFloat(editTargetPrice);

              let liveSlErr = '';
              if (!isNaN(numSl) && numSl > 0 && liveLtp > 0) {
                if (isLongTrade) {
                  if (numSl >= liveLtp) liveSlErr = `SL (₹${numSl}) must be < LTP (₹${formatNumber(liveLtp)})`;
                  else if (!isNaN(numTgt) && numTgt > 0 && numSl >= numTgt) liveSlErr = `SL (₹${numSl}) must be < Target (₹${numTgt})`;
                } else {
                  if (numSl <= liveLtp) liveSlErr = `SL (₹${numSl}) must be > LTP (₹${formatNumber(liveLtp)})`;
                  else if (!isNaN(numTgt) && numTgt > 0 && numSl <= numTgt) liveSlErr = `SL (₹${numSl}) must be > Target (₹${numTgt})`;
                }
              }

              let liveTgtErr = '';
              if (!isNaN(numTgt) && numTgt > 0 && liveLtp > 0) {
                if (isLongTrade) {
                  if (numTgt <= liveLtp) liveTgtErr = `Target (₹${numTgt}) must be > LTP (₹${formatNumber(liveLtp)})`;
                  else if (!isNaN(numSl) && numSl > 0 && numTgt <= numSl) liveTgtErr = `Target (₹${numTgt}) must be > SL (₹${numSl})`;
                } else {
                  if (numTgt >= liveLtp) liveTgtErr = `Target (₹${numTgt}) must be < LTP (₹${formatNumber(liveLtp)})`;
                  else if (!isNaN(numSl) && numSl > 0 && numTgt >= numSl) liveTgtErr = `Target (₹${numTgt}) must be < SL (₹${numSl})`;
                }
              }

              return (
                <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                  <div className={`p-2.5 rounded-xl transition-colors ${liveSlErr ? 'bg-rose-50 border border-rose-200' : ''}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold text-slate-900">Stop loss trigger</span>
                      <div className="flex items-center border border-slate-200 rounded-xl bg-white px-3 py-1.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-xs">
                        <span className="text-slate-400 text-sm mr-1 font-bold">₹</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          value={editTriggerPrice}
                          onChange={(e) => {
                            setEditTriggerPrice(e.target.value);
                            setErrorMsg('');
                          }}
                          className="w-28 text-right text-base font-extrabold font-mono-num text-amber-700 bg-transparent focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    {liveSlErr && (
                      <div className="text-[11px] font-bold text-rose-600 mt-1">
                        ❌ {liveSlErr}
                      </div>
                    )}
                  </div>

                  <div className={`p-2.5 rounded-xl transition-colors border-t border-slate-100 ${liveTgtErr ? 'bg-rose-50 border border-rose-200' : ''}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold text-slate-900">Target trigger</span>
                      <div className="flex items-center border border-slate-200 rounded-xl bg-white px-3 py-1.5 focus-within:border-[#00D09C] focus-within:ring-2 focus-within:ring-[#00D09C]/20 transition-all shadow-xs">
                        <span className="text-slate-400 text-sm mr-1 font-bold">₹</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          value={editTargetPrice}
                          onChange={(e) => {
                            setEditTargetPrice(e.target.value);
                            setErrorMsg('');
                          }}
                          className="w-28 text-right text-base font-extrabold font-mono-num text-[#008f6b] bg-transparent focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    {liveTgtErr && (
                      <div className="text-[11px] font-bold text-rose-600 mt-1">
                        ❌ {liveTgtErr}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isTrailEnabled}
                        onChange={(e) => setIsTrailEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-[#008f6b] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-700">Trail Stop Loss</span>
                    </label>

                    {isTrailEnabled && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editTrailingStopLoss}
                          onChange={(e) => setEditTrailingStopLoss(e.target.value)}
                          className="w-16 py-1 px-2 rounded-lg bg-white border border-slate-200 text-right text-xs font-bold font-mono-num text-slate-900 focus:outline-none focus:border-[#00D09C]"
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : null}

            <div className="text-xs text-slate-500 text-center">
              Order will be executed at {editPrice || '0.00'} or lower price.
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const ord = modifyingOrder;
                  setModifyingOrder(null);
                  setOrderToCancel(ord);
                }}
                disabled={isSubmitting}
                className="py-3.5 rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-200 text-rose-600 font-extrabold text-xs sm:text-sm transition-all shadow-xs cursor-pointer text-center disabled:opacity-50"
              >
                Cancel Order
              </button>

              <button
                type="button"
                onClick={handleSaveModify}
                disabled={isSubmitting}
                className="py-3.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-xs sm:text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : `Modify ${modifyingOrder.transactionType === 'BUY' ? 'Buy' : 'Sell'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Full Order Details Modal */}
      {selectedOrderDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setSelectedOrderDetails(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {formatDisplaySymbol(selectedOrderDetails.tradingSymbol)}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Order ID: {selectedOrderDetails.id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono-num">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Type:</span>
                  <span className="text-slate-900 font-bold">{selectedOrderDetails.transactionType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Order Price:</span>
                  <span className="text-slate-900 font-bold">₹{formatNumber(selectedOrderDetails.price || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Quantity:</span>
                  <span className="text-slate-900 font-bold">{selectedOrderDetails.quantity}</span>
                </div>
              </div>

              <div className="space-y-2 pl-3 border-l border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Status:</span>
                  <span className={`font-bold ${
                    selectedOrderDetails.status === 'EXECUTED'
                      ? 'text-[#008f6b]'
                      : selectedOrderDetails.status === 'REJECTED'
                      ? 'text-rose-600'
                      : selectedOrderDetails.status === 'PENDING'
                      ? 'text-sky-600'
                      : 'text-slate-600'
                  }`}>
                    {selectedOrderDetails.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">SL Trigger:</span>
                  <span className="text-amber-700 font-bold">{selectedOrderDetails.triggerPrice ? `₹${selectedOrderDetails.triggerPrice}` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Target:</span>
                  <span className="text-[#008f6b] font-bold">{selectedOrderDetails.targetPrice ? `₹${selectedOrderDetails.targetPrice}` : '-'}</span>
                </div>
              </div>
            </div>

            {selectedOrderDetails.status === 'REJECTED' && selectedOrderDetails.rejectionReason && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{selectedOrderDetails.rejectionReason}</span>
              </div>
            )}

            {(selectedOrderDetails.status === 'REJECTED' || selectedOrderDetails.status === 'CANCELLED') && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleRetryOrder(selectedOrderDetails)}
                  className="w-full py-3 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-sm transition-all cursor-pointer shadow-xs"
                >
                  Retry Order (Place Again)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Cancel Single Order Confirmation Modal */}
      {orderToCancel && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setOrderToCancel(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-5 shadow-2xl space-y-4 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancel Order?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to cancel this pending {orderToCancel.transactionType} order?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono-num space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Contract:</span>
                <strong className="text-slate-900">{formatDisplaySymbol(orderToCancel.tradingSymbol)}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Quantity:</span>
                <strong className="text-slate-900">{orderToCancel.quantity} Qty</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Limit Price:</span>
                <strong className="text-slate-900">₹{formatNumber(orderToCancel.price || 0)}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer transition-colors"
              >
                No, Keep
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={async () => {
                  setIsCancelling(true);
                  try {
                    await cancelOrder(orderToCancel.id);
                    toast.info('Order Cancelled', `Order #${orderToCancel.id} has been cancelled.`);
                    setOrderToCancel(null);
                  } catch (err: any) {
                    toast.error('Cancel Failed', err?.message || 'Failed to cancel order.');
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Cancel All Orders Confirmation Modal */}
      {showCancelAllConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setShowCancelAllConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-5 shadow-2xl space-y-4 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancel All Orders?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to cancel all {pendingOrdersCount} pending orders?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCancelAllConfirm(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer transition-colors"
              >
                No, Keep
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={async () => {
                  setIsCancelling(true);
                  try {
                    await cancelAllOrders();
                    toast.info('Orders Cancelled', `Cancelled all ${pendingOrdersCount} pending orders.`);
                    setShowCancelAllConfirm(false);
                  } catch (err: any) {
                    toast.error('Cancel Failed', err?.message || 'Failed to cancel orders.');
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

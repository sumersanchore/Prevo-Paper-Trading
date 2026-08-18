import React, { useState } from 'react';
import { useTradingStore, type SelectedContract } from '../../app/store/useTradingStore.js';
import { formatINR, formatNumber } from '../../lib/utils.js';
import {
  ArrowUpRight,
  X,
  Plus,
  Minus,
  Info,
  ChevronRight,
  ArrowLeft,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import type { OptionOrderEntity } from '@trademitra/shared';

export const OrderBookTable: React.FC = () => {
  const {
    orders,
    setActiveTab,
    cancelOrder,
    cancelAllOrders,
    modifyOrder,
    openOrderPad,
    optionChain,
    positionsSummary,
    wallet,
  } = useTradingStore();

  const [filter, setFilter] = useState<'ALL' | 'EXECUTED' | 'PENDING' | 'REJECTED' | 'CANCELLED'>('ALL');

  // Bottom action sheet for clicked pending order (Screenshot 1)
  const [activeSheetOrder, setActiveSheetOrder] = useState<OptionOrderEntity | null>(null);

  // Full-screen / Modal state for modifying pending order (Screenshots 2 & 4)
  const [modifyingOrder, setModifyingOrder] = useState<OptionOrderEntity | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editTriggerPrice, setEditTriggerPrice] = useState<string>('');
  const [editTargetPrice, setEditTargetPrice] = useState<string>('');
  const [editTrailingStopLoss, setEditTrailingStopLoss] = useState<string>('');
  const [editLots, setEditLots] = useState<number>(1);
  const [isTrailEnabled, setIsTrailEnabled] = useState<boolean>(true);
  const [activeKeypadField, setActiveKeypadField] = useState<'price' | 'sl' | 'target'>('price');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal state for Option & Order details
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OptionOrderEntity | null>(null);

  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;

  const filteredOrders = orders.filter((o) => {
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
      defaultAction: order.transactionType,
      defaultOrderType: order.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
      defaultProductType: order.productType,
      defaultLots: lots,
      defaultLimitPrice: order.price ? String(order.price) : (livePrice ? String(livePrice) : ''),
      defaultTriggerPrice: order.triggerPrice ? String(order.triggerPrice) : '',
      defaultTargetPrice: order.targetPrice ? String(order.targetPrice) : '',
    };

    openOrderPad(contractToOrder);
    if (selectedOrderDetails) {
      setSelectedOrderDetails(null);
    }
    if (activeSheetOrder) {
      setActiveSheetOrder(null);
    }
  };

  // Open Modify dialog
  const handleOpenModify = (order: OptionOrderEntity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveSheetOrder(null);
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
    setActiveKeypadField('price');
  };

  // Convert Limit Order to Immediate Market Execution ("Buy/Sell at market price")
  const handleExecuteAtMarket = async (order: OptionOrderEntity) => {
    try {
      const livePrice = getLiveLtp(order);
      await modifyOrder(order.id, {
        price: livePrice > 0 ? livePrice : undefined,
      });
      setActiveSheetOrder(null);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || 'Failed to convert order to market price.');
    }
  };

  // Stepper helper
  const handleStepPrice = (delta: number) => {
    const current = parseFloat(editPrice) || (modifyingOrder ? getLiveLtp(modifyingOrder) : 0);
    const nextVal = Math.max(0.05, Number((current + delta).toFixed(2)));
    setEditPrice(String(nextVal));
  };

  // Keypad button click
  const handleKeypadPress = (val: string) => {
    if (activeKeypadField === 'price') {
      if (val === 'BACKSPACE') {
        setEditPrice((prev) => prev.slice(0, -1));
      } else if (val === '.' && editPrice.includes('.')) {
        return;
      } else {
        setEditPrice((prev) => prev + val);
      }
    } else if (activeKeypadField === 'sl') {
      if (val === 'BACKSPACE') {
        setEditTriggerPrice((prev) => prev.slice(0, -1));
      } else if (val === '.' && editTriggerPrice.includes('.')) {
        return;
      } else {
        setEditTriggerPrice((prev) => prev + val);
      }
    } else if (activeKeypadField === 'target') {
      if (val === 'BACKSPACE') {
        setEditTargetPrice((prev) => prev.slice(0, -1));
      } else if (val === '.' && editTargetPrice.includes('.')) {
        return;
      } else {
        setEditTargetPrice((prev) => prev + val);
      }
    }
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

      const execPrice =
        payload.price !== undefined
          ? payload.price
          : (modifyingOrder.price || modifyingOrder.averagePrice || getLiveLtp(modifyingOrder) || 0);
      const isBuy = modifyingOrder.transactionType === 'BUY';

      // Check if this order has Stop Loss protection attached
      if (editTriggerPrice !== '') {
        const tp = parseFloat(editTriggerPrice);
        if (isNaN(tp) || tp <= 0) {
          setErrorMsg('Please enter a valid Stop Loss trigger price.');
          setIsSubmitting(false);
          return;
        }

        if (execPrice > 0 && tp >= execPrice) {
          setErrorMsg(
            `Stop Loss price (₹${tp.toFixed(2)}) cannot be greater than or equal to Buy price (₹${formatNumber(execPrice)}). Stop loss must be below your buy amount.`
          );
          setIsSubmitting(false);
          return;
        }
        payload.triggerPrice = tp;

        if (isTrailEnabled && editTrailingStopLoss !== '') {
          const trail = parseFloat(editTrailingStopLoss);
          if (!isNaN(trail) && trail > 0) {
            payload.trailingStopLoss = trail;
          }
        }
      }

      if (editTargetPrice !== '') {
        const tgt = parseFloat(editTargetPrice);
        if (isNaN(tgt) || tgt <= 0) {
          setErrorMsg('Please enter a valid Target exit price.');
          setIsSubmitting(false);
          return;
        }

        if (execPrice > 0 && tgt <= execPrice) {
          setErrorMsg(
            `Target price (₹${tgt.toFixed(2)}) must be greater than Buy price (₹${formatNumber(execPrice)}).`
          );
          setIsSubmitting(false);
          return;
        }
        payload.targetPrice = tgt;
      }

      await modifyOrder(modifyingOrder.id, payload);
      setModifyingOrder(null);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || 'Failed to modify order.');
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
      {/* Header bar with Filter Tabs and Cancel All Orders CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {(['ALL', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filter === tab
                  ? 'bg-groww-surface text-white border border-groww-borderLight shadow-sm'
                  : 'text-groww-textMuted hover:text-white bg-groww-card border border-groww-border'
              }`}
            >
              {tab === 'ALL' ? 'All Orders' : tab === 'PENDING' ? 'Open Orders' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              {tab === 'PENDING' && pendingOrdersCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px]">
                  {pendingOrdersCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Cancel All Pending Orders Button */}
        {pendingOrdersCount > 0 && (
          <button
            onClick={() => cancelAllOrders()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[#EB5B5B] border border-rose-500/30 text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Cancel all pending orders"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel all ({pendingOrdersCount})</span>
          </button>
        )}
      </div>

      {/* Orders Container (Matching Groww Screenshot 1 & 3) */}
      <div className="rounded-2xl border border-[#1E2638] bg-[#0F131C] overflow-hidden shadow-2xl divide-y divide-[#1E2638]">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No orders found in <span className="text-white font-bold">{filter}</span> category.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isBuy = order.transactionType === 'BUY';
            const livePrice = getLiveLtp(order);
            const lotSize = getLotSize(order);
            const lots = Math.max(1, Math.round(order.quantity / lotSize));
            const hasProtection = hasSLorTarget(order);
            const isPending = order.status === 'PENDING';

            return (
              <div
                key={order.id}
                onClick={() => {
                  if (isPending) {
                    setActiveSheetOrder(order);
                  } else {
                    setSelectedOrderDetails(order);
                  }
                }}
                className="p-4 space-y-2 hover:bg-[#141A26] active:bg-[#1A2233] transition-colors cursor-pointer"
              >
                {/* Top Line: Tag (BUY + TSL/TGT • BSE vs BUY • BSE) & Product Type (Delivery / Intraday) */}
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    {/* Tag badge with + TSL/TGT if Stop Loss is present */}
                    <span className={isBuy ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}>
                      {order.transactionType}
                      {hasProtection && (
                        <span className="ml-1 text-amber-400 font-extrabold text-[11px]">
                          + TSL/TGT
                        </span>
                      )}
                    </span>
                    <span className="text-gray-400 font-medium">• {order.symbol?.includes('SENSEX') ? 'BSE' : 'NSE'}</span>
                  </div>

                  <div className="text-xs text-gray-400 font-medium">
                    {order.productType === 'NRML' ? 'Delivery' : 'Intraday'}
                  </div>
                </div>

                {/* Middle Line: Instrument Name & Qty (0/20 or Executed/Total) */}
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span>{order.tradingSymbol || `Contract #${order.contractId}`}</span>
                    {order.optionType && (
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                          order.optionType === 'CE'
                            ? 'bg-emerald-500/20 text-[#00D09C]'
                            : 'bg-rose-500/20 text-[#EB5B5B]'
                        }`}
                      >
                        {order.optionType}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-bold font-mono-num text-white">
                    {isPending ? (
                      <span>0/{order.quantity}</span>
                    ) : (
                      <span>{order.quantity}/{order.quantity}</span>
                    )}
                  </div>
                </div>

                {/* Bottom Line: Market Price (LTP) & Order Price (Limit / Market) */}
                <div className="flex items-center justify-between text-xs font-mono-num">
                  <div className="text-gray-400">
                    Mkt <span className="text-white font-semibold">₹{formatNumber(livePrice)}</span>
                  </div>

                  <div className="text-gray-400">
                    {order.orderType === 'LIMIT' ? (
                      <span>Limit ₹{formatNumber(order.price || 0)}</span>
                    ) : (
                      <span>Market</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2. Bottom Action Sheet for Pending Order (Exact Match to Screenshot 1) */}
      {activeSheetOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0F131C] border border-[#1E2638] rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header info box */}
            <div className="p-4 rounded-2xl bg-[#141A26] border border-[#232D40] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <span className={activeSheetOrder.transactionType === 'BUY' ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}>
                    {activeSheetOrder.transactionType}
                    {hasSLorTarget(activeSheetOrder) && (
                      <span className="ml-1 text-amber-400 font-extrabold text-[11px]">
                        + TSL/TGT
                      </span>
                    )}
                  </span>
                  <span className="text-gray-400">• {activeSheetOrder.symbol?.includes('SENSEX') ? 'BSE' : 'NSE'}</span>
                </div>
                <span className="text-gray-400">
                  {activeSheetOrder.productType === 'NRML' ? 'Delivery' : 'Intraday'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-white flex items-center gap-1">
                  <span>{activeSheetOrder.tradingSymbol}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-sm font-bold font-mono-num text-white">
                  0/{activeSheetOrder.quantity}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono-num text-gray-400">
                <span>Mkt ₹{formatNumber(getLiveLtp(activeSheetOrder))}</span>
                <span>Limit ₹{formatNumber(activeSheetOrder.price || 0)}</span>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="divide-y divide-[#1E2638]/70 text-sm font-bold">
              {/* Option 1: Buy at market price */}
              <button
                type="button"
                onClick={() => handleExecuteAtMarket(activeSheetOrder)}
                className="w-full py-3.5 flex items-center gap-3 text-white hover:text-[#00D09C] transition-colors cursor-pointer text-left"
              >
                <ArrowUpRight className="w-5 h-5 text-gray-400" />
                <span>
                  {activeSheetOrder.transactionType === 'BUY' ? 'Buy at market price' : 'Sell at market price'}
                </span>
              </button>

              {/* Option 2: Order details */}
              <button
                type="button"
                onClick={() => {
                  const ord = activeSheetOrder;
                  setActiveSheetOrder(null);
                  setSelectedOrderDetails(ord);
                }}
                className="w-full py-3.5 flex items-center gap-3 text-white hover:text-[#00D09C] transition-colors cursor-pointer text-left"
              >
                <Info className="w-5 h-5 text-gray-400" />
                <span>Order details</span>
              </button>
            </div>

            {/* Bottom Dual Action Buttons: Cancel & Modify */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  cancelOrder(activeSheetOrder.id);
                  setActiveSheetOrder(null);
                }}
                className="py-3.5 rounded-xl bg-[#141A26] hover:bg-rose-500/20 border border-[#232D40] text-rose-400 font-extrabold text-sm transition-all shadow-sm cursor-pointer text-center"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={(e) => handleOpenModify(activeSheetOrder, e)}
                className="py-3.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-sm transition-all shadow-lg shadow-emerald-950/40 cursor-pointer text-center"
              >
                Modify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Groww Modify Order Modal (Exact Match to Screenshots 2 & 4) */}
      {modifyingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#000000] border border-[#1E2638] rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Top Bar: Back arrow, Symbol, Depth, LTP */}
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2638]/60">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModifyingOrder(null)}
                  className="p-1 rounded-full text-gray-300 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {modifyingOrder.tradingSymbol}
                  </h3>
                  <div className="text-xs text-gray-400 font-mono-num flex items-center gap-2">
                    <span>₹{formatNumber(getLiveLtp(modifyingOrder))}</span>
                    <span className="text-gray-500">(0.00%)</span>
                  </div>
                </div>
              </div>

              <span className="text-xs font-semibold text-gray-400">Depth</span>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[#EB5B5B] text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Product Type (Delivery / Intraday) only on non-SL orders (Screenshot 4) */}
            {!hasSLorTarget(modifyingOrder) && (
              <div className="flex items-center gap-2 pt-1">
                <span className="px-4 py-1.5 rounded-full text-xs font-bold border border-white text-white bg-white/10">
                  {modifyingOrder.productType === 'NRML' ? 'Delivery' : 'Intraday'}
                </span>
              </div>
            )}

            {/* Quantity Row */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-sm font-semibold text-white">Qty</div>
                <div className="text-xs text-gray-400 font-mono-num">
                  {editLots} lot x {getLotSize(modifyingOrder)}
                </div>
              </div>

              <div className="flex items-center border border-[#2E3A52] rounded-xl bg-[#161C28] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEditLots((l) => Math.max(1, l - 1))}
                  className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white border-r border-[#2E3A52] cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-14 text-center text-sm font-bold text-white font-mono-num">
                  {editLots * getLotSize(modifyingOrder)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditLots((l) => l + 1)}
                  className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white border-l border-[#2E3A52] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Price Limit Row */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-white flex items-center gap-1">
                <span>Price Limit</span>
                <span className="text-xs text-gray-400">▾</span>
              </span>

              <div className="flex flex-col items-end">
                <input
                  type="text"
                  readOnly
                  onClick={() => setActiveKeypadField('price')}
                  value={editPrice}
                  className={`w-32 py-1.5 px-3 rounded-xl bg-[#161C28] text-right text-base font-extrabold font-mono-num cursor-pointer ${
                    activeKeypadField === 'price'
                      ? 'border-2 border-white text-white'
                      : 'border border-[#273248] text-white'
                  }`}
                />
                <span className="text-[10px] text-gray-400 font-mono-num mt-0.5">
                  {editPrice && getLiveLtp(modifyingOrder) > 0 ? (
                    (() => {
                      const p = parseFloat(editPrice);
                      const ltp = getLiveLtp(modifyingOrder);
                      const diff = (((p - ltp) / ltp) * 100).toFixed(2);
                      return `${parseFloat(diff) >= 0 ? '+' : ''}${diff}% from market`;
                    })()
                  ) : null}
                </span>
              </div>
            </div>

            {/* IF ORDER HAS STOP LOSS (Screenshot 2): Render Stop Loss & Target Sections */}
            {hasSLorTarget(modifyingOrder) ? (() => {
              const pVal = parseFloat(editPrice) || getLiveLtp(modifyingOrder);
              const slVal = editTriggerPrice !== '' ? parseFloat(editTriggerPrice) : undefined;
              const tgtVal = editTargetPrice !== '' ? parseFloat(editTargetPrice) : undefined;

              const liveSlErr =
                slVal !== undefined && !isNaN(slVal) && pVal > 0 && slVal >= pVal
                  ? `Stop Loss (₹${slVal.toFixed(2)}) must be LESS than buy price ₹${formatNumber(pVal)}`
                  : '';

              const liveTgtErr =
                tgtVal !== undefined && !isNaN(tgtVal) && pVal > 0 && tgtVal <= pVal
                  ? `Target (₹${tgtVal.toFixed(2)}) must be GREATER than buy price ₹${formatNumber(pVal)}`
                  : '';

              return (
                <div className="space-y-3 pt-2 border-t border-[#1E2638]/70">
                  {/* Stop Loss Trigger Row */}
                  <div className={`p-2.5 rounded-xl transition-colors ${liveSlErr ? 'bg-rose-500/10 border border-rose-500/40' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-semibold text-white">Stoploss trigger</span>
                        {/* Trailing SL Checkbox */}
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            id="trailCheck"
                            checked={isTrailEnabled}
                            onChange={(e) => setIsTrailEnabled(e.target.checked)}
                            className="w-4 h-4 rounded text-[#00D09C] bg-[#161C28] border-gray-600 focus:ring-0"
                          />
                          <label htmlFor="trailCheck" className="text-xs text-[#00D09C] font-semibold cursor-pointer">
                            Trail every +₹{editTrailingStopLoss}
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <input
                          type="text"
                          readOnly
                          onClick={() => setActiveKeypadField('sl')}
                          value={editTriggerPrice}
                          className={`w-32 py-1.5 px-3 rounded-xl bg-[#161C28] text-right text-base font-extrabold font-mono-num cursor-pointer transition-all ${
                            liveSlErr
                              ? 'border-2 border-rose-500 text-rose-400'
                              : activeKeypadField === 'sl'
                              ? 'border-2 border-amber-400 text-amber-400'
                              : 'border border-[#273248] text-amber-400'
                          }`}
                        />
                        <span className="text-[10px] text-gray-400 font-mono-num mt-0.5">
                          {editTriggerPrice && getLiveLtp(modifyingOrder) > 0 ? (
                            (() => {
                              const sl = parseFloat(editTriggerPrice);
                              const ltp = getLiveLtp(modifyingOrder);
                              const diff = (((sl - ltp) / ltp) * 100).toFixed(2);
                              return `${diff}% from market`;
                            })()
                          ) : null}
                        </span>
                      </div>
                    </div>
                    {liveSlErr && (
                      <div className="text-[11px] font-bold text-rose-400 mt-1">
                        ❌ {liveSlErr}
                      </div>
                    )}
                  </div>

                  {/* Target Trigger Row */}
                  <div className={`p-2.5 rounded-xl transition-colors border-t border-[#1E2638]/70 ${liveTgtErr ? 'bg-rose-500/10 border border-rose-500/40' : ''}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold text-white">Target trigger</span>

                      <div className="flex flex-col items-end">
                        <input
                          type="text"
                          readOnly
                          onClick={() => setActiveKeypadField('target')}
                          value={editTargetPrice}
                          className={`w-32 py-1.5 px-3 rounded-xl bg-[#161C28] text-right text-base font-extrabold font-mono-num cursor-pointer transition-all ${
                            liveTgtErr
                              ? 'border-2 border-rose-500 text-rose-400'
                              : activeKeypadField === 'target'
                              ? 'border-2 border-emerald-400 text-emerald-400'
                              : 'border border-[#273248] text-emerald-400'
                          }`}
                        />
                        <span className="text-[10px] text-gray-400 font-mono-num mt-0.5">
                          {editTargetPrice && getLiveLtp(modifyingOrder) > 0 ? (
                            (() => {
                              const tgt = parseFloat(editTargetPrice);
                              const ltp = getLiveLtp(modifyingOrder);
                              const diff = (((tgt - ltp) / ltp) * 100).toFixed(2);
                              return `+${diff}% from market`;
                            })()
                          ) : null}
                        </span>
                      </div>
                    </div>
                    {liveTgtErr && (
                      <div className="text-[11px] font-bold text-rose-400 mt-1">
                        ❌ {liveTgtErr}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : null}

            {/* Explanatory subtext */}
            <div className="text-xs text-gray-400 text-center">
              Order will be executed at {editPrice || '0.00'} or lower price.
            </div>

            {/* Wallet Balance Strip */}
            <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
              <span>Balance: <span className="text-white font-bold">{formatINR(wallet?.availableMargin ?? 1000000)}</span></span>
              <Info className="w-3.5 h-3.5 text-gray-500" />
            </div>

            {/* Modify Action Button */}
            <button
              type="button"
              onClick={handleSaveModify}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-sm transition-all shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Modifying...' : `Modify ${modifyingOrder.transactionType === 'BUY' ? 'buy' : 'sell'}`}
            </button>

            {/* Onscreen Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E2638]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BACKSPACE'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKeypadPress(k)}
                  className="py-3 rounded-xl bg-[#121620] hover:bg-[#1C2333] active:bg-[#2A344C] text-white font-bold text-lg transition-colors flex items-center justify-center cursor-pointer"
                >
                  {k === 'BACKSPACE' ? <X className="w-5 h-5 text-gray-400" /> : k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Full Order Details Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-groww-card border border-groww-border p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-groww-border">
              <div>
                <h3 className="text-lg font-black text-white">
                  {selectedOrderDetails.tradingSymbol}
                </h3>
                <div className="text-xs text-gray-400 mt-0.5">
                  Order ID: {selectedOrderDetails.id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-groww-surface p-3 rounded-xl border border-groww-border font-mono-num">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">Type:</span>
                  <span className="text-white font-bold">{selectedOrderDetails.transactionType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">Order Price:</span>
                  <span className="text-white font-bold">₹{formatNumber(selectedOrderDetails.price || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">Quantity:</span>
                  <span className="text-white font-bold">{selectedOrderDetails.quantity}</span>
                </div>
              </div>

              <div className="space-y-2 pl-3 border-l border-groww-border/60">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">Status:</span>
                  <span className="text-[#00D09C] font-bold">{selectedOrderDetails.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">SL Trigger:</span>
                  <span className="text-amber-400 font-bold">{selectedOrderDetails.triggerPrice ? `₹${selectedOrderDetails.triggerPrice}` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">Target:</span>
                  <span className="text-emerald-400 font-bold">{selectedOrderDetails.targetPrice ? `₹${selectedOrderDetails.targetPrice}` : '-'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-groww-border">
              <button
                type="button"
                onClick={() => handleRetryOrder(selectedOrderDetails)}
                className="w-full py-3 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-sm transition-all cursor-pointer"
              >
                Retry Order (Place Again)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

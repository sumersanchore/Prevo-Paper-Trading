import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Plus, Minus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR, formatNumber } from '../../lib/utils.js';

export const GrowwOrderModal: React.FC = () => {
  const {
    isOrderModalOpen,
    selectedContract,
    closeOrderPad,
    wallet,
    placeOrder,
    isLoading,
  } = useTradingStore();

  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [productType, setProductType] = useState<'NRML' | 'MIS'>(() => {
    try {
      return (localStorage.getItem('trademitra_preferred_product') as 'NRML' | 'MIS') || 'NRML';
    } catch {
      return 'NRML';
    }
  });
  const [lots, setLots] = useState(1);
  const [limitPrice, setLimitPrice] = useState<string>('');

  // Stop Loss & Target Price (Optional - Empty by default)
  const [triggerPrice, setTriggerPrice] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showChargesBreakup, setShowChargesBreakup] = useState(false);

  const lastContractKeyRef = React.useRef<string>('');

  const handleSetProductType = (type: 'NRML' | 'MIS') => {
    setProductType(type);
    try {
      localStorage.setItem('trademitra_preferred_product', type);
    } catch {}
  };

  // Initialize modal state on opening or new contract/retry
  useEffect(() => {
    if (selectedContract && isOrderModalOpen) {
      const contractKey = `${selectedContract.contractId}_${selectedContract.defaultAction ?? 'BUY'}_${selectedContract.defaultLots ?? 1}_${selectedContract.defaultLimitPrice ?? ''}_${selectedContract.defaultTriggerPrice ?? ''}_${selectedContract.defaultTargetPrice ?? ''}`;
      
      if (lastContractKeyRef.current !== contractKey) {
        lastContractKeyRef.current = contractKey;
        setTransactionType(selectedContract.defaultAction ?? 'BUY');
        
        if (selectedContract.defaultOrderType) {
          setOrderType(selectedContract.defaultOrderType);
        }
        
        // If a specific defaultProductType was passed (e.g. from Retry), use it; otherwise keep user's chosen productType (Delivery vs Intraday) fixed!
        if (selectedContract.defaultProductType) {
          setProductType(selectedContract.defaultProductType);
        }

        setLimitPrice(
          selectedContract.defaultLimitPrice !== undefined && selectedContract.defaultLimitPrice !== ''
            ? selectedContract.defaultLimitPrice
            : (selectedContract.ltp ? selectedContract.ltp.toFixed(2) : '')
        );

        // Keep Stop Loss & Target clean/empty by default unless explicitly provided from Retry
        setTriggerPrice(selectedContract.defaultTriggerPrice ?? '');
        setTargetPrice(selectedContract.defaultTargetPrice ?? '');
        setLots(selectedContract.defaultLots ?? 1);
        setErrorMsg('');
        setSuccessMsg('');
        setShowChargesBreakup(false);
      }
    } else if (!isOrderModalOpen) {
      lastContractKeyRef.current = '';
    }
  }, [
    selectedContract?.contractId,
    selectedContract?.defaultAction,
    selectedContract?.defaultLots,
    selectedContract?.defaultLimitPrice,
    selectedContract?.defaultTriggerPrice,
    selectedContract?.defaultTargetPrice,
    selectedContract?.defaultProductType,
    selectedContract?.defaultOrderType,
    isOrderModalOpen,
  ]);

  if (!isOrderModalOpen || !selectedContract) return null;

  const isBuy = transactionType === 'BUY';
  const lotSize = selectedContract.lotSize || 25;
  const quantity = lots * lotSize;

  // Standard Indian F&O Option Selling SPAN Margin per lot (~₹1,15,000 / lot)
  const OPTION_SELLING_MARGIN_PER_LOT = 115000;

  // Locked Execution Price
  const executionPrice =
    orderType === 'LIMIT'
      ? parseFloat(limitPrice) || selectedContract.ltp
      : selectedContract.ltp;

  const turnover = Number((quantity * executionPrice).toFixed(2));
  const approxReq = isBuy ? turnover : Number((lots * OPTION_SELLING_MARGIN_PER_LOT).toFixed(2));

  // Brokerage & Taxes
  const brokerage = 20.00;
  const exchangeTxnCharge = Number((turnover * 0.000505).toFixed(2));
  const gst = Number(((brokerage + exchangeTxnCharge) * 0.18).toFixed(2));
  const sebiCharges = Number((turnover * 0.000001).toFixed(2));
  const stampDuty = isBuy ? Number((turnover * 0.00003).toFixed(2)) : 0.00;
  const totalCharges = Number((brokerage + exchangeTxnCharge + gst + sebiCharges + stampDuty).toFixed(2));

  const availableBalance = wallet?.availableMargin ?? 1000000;
  const marginPerLot = isBuy ? Number((executionPrice * lotSize).toFixed(2)) : OPTION_SELLING_MARGIN_PER_LOT;
  const maxAffordableLots = marginPerLot > 0 ? Math.max(1, Math.floor(availableBalance / marginPerLot)) : 1;
  const hasInsufficientFunds = approxReq > availableBalance;

  // Real-time Stop Loss & Target validation
  const numTrigger = parseFloat(triggerPrice);
  const isSlEntered = !isNaN(numTrigger) && numTrigger > 0;
  const isSlInvalid = isSlEntered
    ? isBuy
      ? numTrigger >= executionPrice
      : numTrigger <= executionPrice
    : false;

  const numTarget = parseFloat(targetPrice);
  const isTargetEntered = !isNaN(numTarget) && numTarget > 0;
  const isTargetInvalid = isTargetEntered
    ? isBuy
      ? numTarget <= executionPrice
      : numTarget >= executionPrice
    : false;

  const handleIncrementLot = () => setLots((prev) => prev + 1);
  const handleDecrementLot = () => setLots((prev) => Math.max(1, prev - 1));

  const handleToggleTransactionType = (type: 'BUY' | 'SELL') => {
    setTransactionType(type);
    setTriggerPrice('');
    setTargetPrice('');
    setErrorMsg('');
  };

  const applySLPercent = (pct: number) => {
    const base = executionPrice;
    const computed = isBuy ? base * (1 - pct / 100) : base * (1 + pct / 100);
    setTriggerPrice(Math.max(0.05, computed).toFixed(2));
    setErrorMsg('');
  };

  const applyTargetPercent = (pct: number) => {
    const base = executionPrice;
    const computed = isBuy ? base * (1 + pct / 100) : base * (1 - pct / 100);
    setTargetPrice(Math.max(0.05, computed).toFixed(2));
    setErrorMsg('');
  };

  const handleStepPrice = (step: number) => {
    const current = parseFloat(limitPrice) || selectedContract.ltp;
    const nextVal = Math.max(0.05, current + step);
    setLimitPrice(nextVal.toFixed(2));
  };

  const handleSubmitOrder = async () => {
    setErrorMsg('');
    if (hasInsufficientFunds) {
      setErrorMsg('Insufficient balance available in wallet.');
      return;
    }

    const numLimitPrice = parseFloat(limitPrice);
    const numTriggerPrice = triggerPrice && parseFloat(triggerPrice) > 0 ? parseFloat(triggerPrice) : undefined;
    const numTargetPrice = targetPrice && parseFloat(targetPrice) > 0 ? parseFloat(targetPrice) : undefined;

    if (orderType === 'LIMIT' && (!numLimitPrice || numLimitPrice <= 0)) {
      setErrorMsg('Please enter a valid limit price.');
      return;
    }

    // Directional validation for Stop Loss and Target Price on BUY orders
    if (transactionType === 'BUY') {
      if (numTriggerPrice && numTriggerPrice >= executionPrice) {
        setErrorMsg(
          `Stop Loss price (₹${numTriggerPrice.toFixed(2)}) cannot be greater than or equal to Buy price (₹${formatNumber(executionPrice)}). Stop loss must be below your buy amount.`
        );
        return;
      }
      if (numTargetPrice && numTargetPrice <= executionPrice) {
        setErrorMsg(
          `Target price (₹${numTargetPrice.toFixed(2)}) must be greater than Buy price (₹${formatNumber(executionPrice)}).`
        );
        return;
      }
    }

    const finalPrice = orderType === 'LIMIT' ? (numLimitPrice > 0 ? numLimitPrice : selectedContract.ltp) : undefined;
    const hasProtection = Boolean(numTriggerPrice || numTargetPrice);

    try {
      await placeOrder({
        contractId: selectedContract.contractId,
        orderType,
        transactionType,
        productType,
        quantity,
        price: finalPrice,
        triggerPrice: numTriggerPrice,
        targetPrice: numTargetPrice,
      });
      setSuccessMsg(
        hasProtection
          ? 'Order placed with Stop Loss & Target protection!'
          : 'Order placed successfully! Position is OPEN (Manual Exit Mode).'
      );
      setTimeout(() => {
        closeOrderPad();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || 'Failed to place order.');
    }
  };

  const hasProtection = Boolean((triggerPrice && parseFloat(triggerPrice) > 0) || (targetPrice && parseFloat(targetPrice) > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-full sm:max-w-[420px] bg-[#121620] border-t sm:border border-[#232B3B] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans max-h-[92vh]">
        {/* Groww Header Strip */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#1E2638] bg-[#121620] shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={closeOrderPad}
              className="p-1 -ml-1 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  {selectedContract.tradingSymbol}
                </h2>
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                    selectedContract.optionType === 'CE'
                      ? 'bg-emerald-500/15 text-[#00D09C]'
                      : 'bg-rose-500/15 text-[#EB5B5B]'
                  }`}
                >
                  {selectedContract.optionType === 'CE' ? 'Call' : 'Put'}
                </span>
              </div>
              <div className="text-xs mt-0.5 flex items-center gap-1.5">
                <span className="font-bold text-white font-mono-num">
                  ₹{formatNumber(selectedContract.ltp)}
                </span>
                <span className="text-[11px] text-gray-400 font-mono-num">
                  ({(selectedContract.changePercent ?? 0) >= 0 ? '+' : ''}{(selectedContract.changePercent ?? 0).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 tracking-wider">Depth</span>
            <button
              onClick={closeOrderPad}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error / Success Messages */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[#EB5B5B] text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-[#00D09C]/30 text-[#00D09C] text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Section */}
        <div className="px-5 py-3 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Top Tabs: BUY / SELL Switch & Delivery / Intraday Pills */}
          <div className="flex items-center justify-between pt-1">
            {/* Delivery / Intraday Pill Switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetProductType('NRML')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  productType === 'NRML'
                    ? 'border border-gray-400 text-white bg-white/10 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Delivery
              </button>
              <button
                type="button"
                onClick={() => handleSetProductType('MIS')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  productType === 'MIS'
                    ? 'border border-gray-400 text-white bg-white/10 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Intraday
              </button>
            </div>

            {/* BUY / SELL Mini Switch */}
            <div className="flex items-center gap-1 bg-[#1A2130] p-1 rounded-full border border-[#273248]">
              <button
                type="button"
                onClick={() => handleToggleTransactionType('BUY')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  isBuy
                    ? 'bg-[#00D09C] text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => handleToggleTransactionType('SELL')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  !isBuy
                    ? 'bg-[#EB5B5B] text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>
          </div>

          {/* Row 1: Quantity with Lot info & Stepper Box */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="text-sm font-semibold text-white">Qty</div>
              <div className="text-xs text-gray-400 font-mono-num">
                {lots} {lots === 1 ? 'lot' : 'lots'} x {lotSize}
              </div>
            </div>
            <div className="flex items-center border border-[#2E3A52] rounded-xl bg-[#161C28] overflow-hidden">
              <button
                type="button"
                onClick={handleDecrementLot}
                className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border-r border-[#2E3A52]"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-14 text-center text-sm font-bold text-white font-mono-num">
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrementLot}
                className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border-l border-[#2E3A52]"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Lot Chips */}
          <div className="flex items-center justify-end gap-1.5 -mt-2">
            {[1, 2, 5, 10].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setLots(count)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                  lots === count
                    ? 'bg-[#00D09C]/20 text-[#00D09C] border border-[#00D09C]/40'
                    : 'text-gray-400 bg-[#1A2130] hover:text-white'
                }`}
              >
                {count}L
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLots(maxAffordableLots)}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              Max ({maxAffordableLots}L)
            </button>
          </div>

          {/* Row 2: Price Market / Limit Dropdown & Value Box */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white">Price</span>
              <div className="flex items-center bg-[#1A2130] rounded-lg p-0.5 border border-[#273248]">
                <button
                  type="button"
                  onClick={() => setOrderType('MARKET')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    orderType === 'MARKET' ? 'bg-[#273248] text-white' : 'text-gray-400'
                  }`}
                >
                  Market ▾
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('LIMIT')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    orderType === 'LIMIT' ? 'bg-[#273248] text-white' : 'text-gray-400'
                  }`}
                >
                  Limit
                </button>
              </div>
            </div>

            {orderType === 'MARKET' ? (
              <div className="w-32 py-2 px-3 rounded-xl bg-[#161C28] border border-[#273248] text-center text-xs font-semibold text-gray-400">
                At market
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepPrice(-0.05)}
                  className="w-7 h-8 rounded-lg bg-[#1A2130] text-gray-300 text-xs font-bold hover:text-white"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.05"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="w-24 py-1.5 px-2.5 rounded-xl bg-[#161C28] border border-[#00D09C]/50 text-right text-xs font-bold text-white font-mono-num focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleStepPrice(0.05)}
                  className="w-7 h-8 rounded-lg bg-[#1A2130] text-gray-300 text-xs font-bold hover:text-white"
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[#1E2638]"></div>

          {/* Row 3: Stoploss (SL) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">Stoploss (SL)</span>
                {triggerPrice && (
                  <button
                    type="button"
                    onClick={() => setTriggerPrice('')}
                    className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                    title="Clear Stop Loss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col items-end">
                <input
                  type="number"
                  step="0.05"
                  value={triggerPrice}
                  onChange={(e) => {
                    setTriggerPrice(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder={isBuy ? `< ₹${formatNumber(executionPrice)}` : `> ₹${formatNumber(executionPrice)}`}
                  className={`w-32 py-1.5 px-3 rounded-xl bg-[#161C28] text-right text-xs font-bold font-mono-num focus:outline-none transition-colors ${
                    isSlInvalid
                      ? 'border-2 border-rose-500 bg-rose-500/10 text-rose-300 focus:border-rose-500'
                      : 'border border-[#273248] focus:border-[#00D09C] text-white'
                  }`}
                />
                {isSlEntered ? (
                  (() => {
                    const slVal = numTrigger;
                    const diffPct = Math.abs(((slVal - executionPrice) / executionPrice) * 100).toFixed(2);
                    return isSlInvalid ? (
                      <span className="text-[10px] text-rose-400 font-bold mt-1 text-right max-w-[200px] leading-tight">
                        {isBuy
                          ? `❌ Stop Loss (₹${slVal.toFixed(2)}) must be LESS than buy price ₹${formatNumber(executionPrice)}`
                          : `❌ Stop Loss (₹${slVal.toFixed(2)}) must be GREATER than sell price ₹${formatNumber(executionPrice)}`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-mono-num mt-0.5">
                        {isBuy ? `-${diffPct}% from market` : `+${diffPct}% above market`}
                      </span>
                    );
                  })()
                ) : null}
              </div>
            </div>

            {/* Stop Loss Quick Presets */}
            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              {[5, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applySLPercent(pct)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-400/90 bg-[#1A2130] hover:bg-[#273248] transition-colors cursor-pointer"
                >
                  {isBuy ? `-${pct}%` : `+${pct}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#1E2638]"></div>

          {/* Row 4: Target (TGT) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">Target (TGT)</span>
                {targetPrice && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPrice('');
                      setErrorMsg('');
                    }}
                    className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                    title="Clear Target"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col items-end">
                <input
                  type="number"
                  step="0.05"
                  value={targetPrice}
                  onChange={(e) => {
                    setTargetPrice(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder={isBuy ? `> ₹${formatNumber(executionPrice)}` : `< ₹${formatNumber(executionPrice)}`}
                  className={`w-32 py-1.5 px-3 rounded-xl bg-[#161C28] text-right text-xs font-bold font-mono-num focus:outline-none transition-colors ${
                    isTargetInvalid
                      ? 'border-2 border-rose-500 bg-rose-500/10 text-rose-300 focus:border-rose-500'
                      : 'border border-[#273248] focus:border-[#00D09C] text-emerald-400'
                  }`}
                />
                {isTargetEntered ? (
                  (() => {
                    const tgtVal = numTarget;
                    const diffPct = Math.abs(((tgtVal - executionPrice) / executionPrice) * 100).toFixed(2);
                    return isTargetInvalid ? (
                      <span className="text-[10px] text-rose-400 font-bold mt-1 text-right max-w-[200px] leading-tight">
                        {isBuy
                          ? `❌ Target (₹${tgtVal.toFixed(2)}) must be GREATER than buy price ₹${formatNumber(executionPrice)}`
                          : `❌ Target (₹${tgtVal.toFixed(2)}) must be LESS than sell price ₹${formatNumber(executionPrice)}`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-mono-num mt-0.5">
                        {isBuy ? `+${diffPct}% from market` : `-${diffPct}% below market`}
                      </span>
                    );
                  })()
                ) : null}
              </div>
            </div>

            {/* Target Quick Presets */}
            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              {[10, 20, 30, 50].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyTargetPercent(pct)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-[#00D09C] bg-[#1A2130] hover:bg-[#273248] transition-colors cursor-pointer"
                >
                  {isBuy ? `+${pct}%` : `-${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Exit Guidance (when both SL and TGT are empty) */}
          {!hasProtection && (
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-2">
              <span className="text-xs">ℹ️</span>
              <span>
                <strong>Manual Exit:</strong> No SL/Target set. You will exit this trade manually from Positions.
              </span>
            </div>
          )}
        </div>

        {/* Footer Info Strip & CTA Button */}
        <div className="px-5 pt-3 pb-5 border-t border-[#1E2638] bg-[#121620] shrink-0 space-y-3">
          {/* Balance & Approx Req */}
          <div className="flex items-center justify-between text-xs text-gray-400 font-mono-num">
            <div>
              <span>Balance : </span>
              <span className="text-white font-bold">{formatINR(availableBalance)}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowChargesBreakup(!showChargesBreakup)}
              className="text-gray-400 hover:text-white border-b border-dashed border-gray-600 pb-0.5 flex items-center gap-1 cursor-pointer"
            >
              <span>Approx req : </span>
              <span className="text-white font-bold">{formatINR(approxReq)}</span>
            </button>
          </div>

          {/* Charges Breakup Popup */}
          {showChargesBreakup && (
            <div className="p-3 rounded-xl bg-[#0e111a] border border-[#273248] text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between font-bold text-white pb-1 border-b border-[#273248]">
                <span>Approx charges</span>
                <button
                  type="button"
                  onClick={() => setShowChargesBreakup(false)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Brokerage</span>
                <span className="font-mono-num text-white">₹{formatNumber(brokerage)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Exchange charges</span>
                <span className="font-mono-num text-white">₹{formatNumber(exchangeTxnCharge)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>GST + SEBI + Stamp</span>
                <span className="font-mono-num text-white">₹{formatNumber(gst + sebiCharges + stampDuty)}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-white pt-1 border-t border-[#273248] text-[11px]">
                <span>Total Est. Charges</span>
                <span className="font-mono-num text-[#00D09C]">₹{formatNumber(totalCharges)}</span>
              </div>
            </div>
          )}

          {/* Main Full-Width Action Button matching Groww App */}
          <button
            onClick={handleSubmitOrder}
            disabled={isLoading || hasInsufficientFunds}
            className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer ${
              isBuy
                ? 'bg-[#00D09C] hover:bg-[#00E5AA] text-black shadow-emerald-950/40'
                : 'bg-[#EB5B5B] hover:bg-[#FF6B6B] text-white shadow-rose-950/40'
            }`}
          >
            {isLoading ? 'Processing...' : isBuy ? 'Buy' : 'Sell (Short)'}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Plus, Minus, ShieldAlert, CheckCircle2, RotateCw, Settings, Info, Receipt } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { useToast } from '../../components/ui/Toast.js';
import { formatINR, formatNumber } from '../../lib/utils.js';

const formatTradingSymbolDisplay = (sym: string, _strikePrice?: number, _optionType?: string) => {
  if (!sym) return '';
  const parts = sym.split('_');
  if (parts.length >= 4) {
    const symbol = parts[0]!;
    const expCode = parts[1]!; // e.g. 25AUG, 20AUG
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

export const GrowwOrderModal: React.FC = () => {
  const toast = useToast();
  const {
    isOrderModalOpen,
    selectedContract,
    closeOrderPad,
    wallet,
    positionsSummary,
    placeOrder,
    setWalletModalOpen,
    setActiveTab,
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

  // Stop Loss & Target Section Toggle
  const [showProtection, setShowProtection] = useState(false);
  const [triggerPrice, setTriggerPrice] = useState<string>('0');
  const [targetPrice, setTargetPrice] = useState<string>('0');
  const [isTrailEnabled, setIsTrailEnabled] = useState<boolean>(false);
  const [trailAmount, setTrailAmount] = useState<string>('0');

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

  // Initialize modal state on opening or new contract
  useEffect(() => {
    if (selectedContract && isOrderModalOpen) {
      const contractKey = `${selectedContract.contractId}_${selectedContract.defaultAction ?? 'BUY'}_${selectedContract.defaultOrderType ?? 'MARKET'}_${selectedContract.defaultLots ?? 1}_${selectedContract.defaultLimitPrice ?? ''}_${selectedContract.defaultTriggerPrice ?? '0'}_${selectedContract.defaultTargetPrice ?? '0'}_${selectedContract.isPositionProtectionMode ?? false}_${selectedContract.positionNetQuantity ?? ''}`;

      if (lastContractKeyRef.current !== contractKey) {
        lastContractKeyRef.current = contractKey;
        setTransactionType(selectedContract.defaultAction ?? 'BUY');

        if (selectedContract.defaultOrderType) {
          setOrderType(selectedContract.defaultOrderType);
        } else {
          setOrderType('MARKET');
        }

        if (selectedContract.defaultProductType) {
          setProductType(selectedContract.defaultProductType);
        }

        setLimitPrice(
          selectedContract.defaultLimitPrice !== undefined && selectedContract.defaultLimitPrice !== ''
            ? selectedContract.defaultLimitPrice
            : (selectedContract.ltp ? selectedContract.ltp.toFixed(2) : '')
        );

        const hasDefProtection = Boolean(
          selectedContract.isPositionProtectionMode ||
          (selectedContract.defaultTriggerPrice && parseFloat(selectedContract.defaultTriggerPrice) > 0) ||
          (selectedContract.defaultTargetPrice && parseFloat(selectedContract.defaultTargetPrice) > 0)
        );
        setShowProtection(hasDefProtection);
        setTriggerPrice(selectedContract.defaultTriggerPrice ?? '0');
        setTargetPrice(selectedContract.defaultTargetPrice ?? '0');
        setTrailAmount('0');
        setIsTrailEnabled(false);
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
    selectedContract?.isPositionProtectionMode,
    selectedContract?.positionNetQuantity,
    isOrderModalOpen,
  ]);

  if (!isOrderModalOpen || !selectedContract) return null;

  // Check if user currently holds an active open position in this contract
  const activeHoldingPosition = positionsSummary?.positions?.find(
    (p: any) =>
      (p.contractId === selectedContract.contractId ||
        p.tradingSymbol === selectedContract.tradingSymbol ||
        (selectedContract.contractId && String(p.contractId) === String(selectedContract.contractId))) &&
      p.status === 'OPEN' &&
      p.netQuantity !== 0
  );

  const lotSize = selectedContract.lotSize || 25;
  const quantity = lots * lotSize;

  const existingNetQty = activeHoldingPosition
    ? Number(activeHoldingPosition.netQuantity)
    : selectedContract.positionNetQuantity !== undefined
    ? Number(selectedContract.positionNetQuantity)
    : 0;

  const isHoldingLong = existingNetQty > 0;
  const isHoldingShort = existingNetQty < 0;
  const availableHoldingQty = Math.abs(existingNetQty);
  const availableHoldingLots = Math.max(1, Math.round(availableHoldingQty / lotSize));

  const isProtectionMode = Boolean(selectedContract.isPositionProtectionMode);
  // Square off detection:
  // User holds Long (+qty) and transactionType is SELL -> Square off Long position
  // User holds Short (-qty) and transactionType is BUY -> Square off Short position
  const isSquareOff =
    isProtectionMode ||
    (isHoldingLong && transactionType === 'SELL') ||
    (isHoldingShort && transactionType === 'BUY');

  const squareOffQty = isSquareOff ? Math.min(quantity, availableHoldingQty) : 0;
  const freshQty = isSquareOff ? Math.max(0, quantity - availableHoldingQty) : quantity;
  const freshLots = Math.round(freshQty / lotSize);

  // In protection mode or square off, isLongPosition indicates whether the active holding is Long (BUY) or Short (SELL)
  const isLongPosition = isProtectionMode || isSquareOff
    ? isHoldingLong || selectedContract.defaultAction === 'BUY'
    : transactionType === 'BUY';

  const isBuyRule = isLongPosition;
  const isBuy = transactionType === 'BUY';

  // Standard Option Selling Margin (~₹1,15,000 / lot for fresh writing)
  const OPTION_SELLING_MARGIN_PER_LOT = 115000;

  // Locked Execution Price
  const executionPrice =
    orderType === 'LIMIT'
      ? parseFloat(limitPrice) || selectedContract.ltp
      : selectedContract.ltp;

  const turnover = Number((quantity * executionPrice).toFixed(2));

  // Estimated sale proceeds when selling a held long position
  const approxCredit = (isHoldingLong && transactionType === 'SELL')
    ? Number((squareOffQty * executionPrice).toFixed(2))
    : 0;

  // In protection mode or full square-off of long position, required new margin is ₹0.00
  const approxReq = isProtectionMode
    ? 0.00
    : isHoldingLong && transactionType === 'SELL'
    ? (freshLots > 0 ? Number((freshLots * OPTION_SELLING_MARGIN_PER_LOT).toFixed(2)) : 0.00)
    : isHoldingShort && transactionType === 'BUY'
    ? (freshLots > 0 ? Number((freshLots * executionPrice * lotSize).toFixed(2)) : 0.00)
    : isBuy
    ? turnover
    : Number((lots * OPTION_SELLING_MARGIN_PER_LOT).toFixed(2));

  // Brokerage & Charges
  const brokerage = 20.00;
  const exchangeTxnCharge = Number((turnover * 0.000505).toFixed(2));
  const gst = Number(((brokerage + exchangeTxnCharge) * 0.18).toFixed(2));
  const sebiCharges = Number((turnover * 0.000001).toFixed(2));
  const stampDuty = isBuy ? Number((turnover * 0.00003).toFixed(2)) : 0.00;
  const totalCharges = Number((brokerage + exchangeTxnCharge + gst + sebiCharges + stampDuty).toFixed(2));

  const availableBalance = wallet?.availableMargin ?? 1000000;
  const marginPerLot = (isHoldingLong && transactionType === 'SELL' && freshLots === 0)
    ? 0
    : isBuy
    ? Number((executionPrice * lotSize).toFixed(2))
    : OPTION_SELLING_MARGIN_PER_LOT;

  const maxAffordableLots = (isHoldingLong && transactionType === 'SELL')
    ? availableHoldingLots
    : marginPerLot > 0
    ? Math.max(1, Math.floor(availableBalance / marginPerLot))
    : 1;

  const hasInsufficientFunds = !isProtectionMode && approxReq > 0 && approxReq > availableBalance;

  // Real-time Stop Loss & Target validation according to master formula:
  // LONG / BUY: SL < executionPrice, Target > executionPrice
  // SHORT / SELL: SL > executionPrice, Target < executionPrice
  const numTrigger = parseFloat(triggerPrice);
  const isSlEntered = !isNaN(numTrigger) && numTrigger > 0;
  const isSlInvalid = isSlEntered
    ? isBuyRule
      ? numTrigger >= executionPrice // Buy/Long SL must be < executionPrice
      : numTrigger <= executionPrice // Sell/Short SL must be > executionPrice
    : false;

  const numTarget = parseFloat(targetPrice);
  const isTargetEntered = !isNaN(numTarget) && numTarget > 0;
  const isTargetInvalid = isTargetEntered
    ? isBuyRule
      ? numTarget <= executionPrice // Buy/Long Target must be > executionPrice
      : numTarget >= executionPrice // Sell/Short Target must be < executionPrice
    : false;

  // Real-time Estimated P&L calculations
  const estSlLoss = isSlEntered && !isSlInvalid
    ? isBuyRule
      ? (numTrigger - executionPrice) * quantity // Long loss
      : (executionPrice - numTrigger) * quantity // Short loss
    : null;

  const estTgtProfit = isTargetEntered && !isTargetInvalid
    ? isBuyRule
      ? (numTarget - executionPrice) * quantity // Long profit
      : (executionPrice - numTarget) * quantity // Short profit
    : null;

  const handleIncrementLot = () => setLots((prev) => prev + 1);
  const handleDecrementLot = () => setLots((prev) => Math.max(1, prev - 1));

  const handleToggleTransactionType = (type: 'BUY' | 'SELL') => {
    setTransactionType(type);
    if (type === 'SELL' && isHoldingLong && availableHoldingLots > 0) {
      setLots(availableHoldingLots);
    } else if (type === 'BUY' && isHoldingShort && availableHoldingLots > 0) {
      setLots(availableHoldingLots);
    }
    setTriggerPrice('0');
    setTargetPrice('0');
    setErrorMsg('');
  };

  // Master Formulas:
  // BUY: SL = E * (1 - SL%), Target = E * (1 + T%)
  // SELL: SL = E * (1 + SL%), Target = E * (1 - T%)
  const applySLPercent = (pct: number) => {
    const base = executionPrice;
    const computed = isBuyRule ? base * (1 - pct / 100) : base * (1 + pct / 100);
    setTriggerPrice(Math.max(0.05, computed).toFixed(2));
    setErrorMsg('');
  };

  const applyTargetPercent = (pct: number) => {
    const base = executionPrice;
    const computed = isBuyRule ? base * (1 + pct / 100) : base * (1 - pct / 100);
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

    const numLimitPrice = parseFloat(limitPrice);
    const numTriggerPrice = showProtection && triggerPrice && parseFloat(triggerPrice) > 0 ? parseFloat(triggerPrice) : undefined;
    const numTargetPrice = showProtection && targetPrice && parseFloat(targetPrice) > 0 ? parseFloat(targetPrice) : undefined;
    const numTrail = isTrailEnabled && parseFloat(trailAmount) > 0 ? parseFloat(trailAmount) : undefined;

    if (orderType === 'LIMIT' && (!numLimitPrice || numLimitPrice <= 0)) {
      setErrorMsg('Please enter a valid limit price.');
      return;
    }

    if (isSlInvalid) {
      setErrorMsg(
        isBuyRule
          ? `Stop Loss (₹${numTrigger.toFixed(2)}) must be strictly less than Market Price (₹${formatNumber(executionPrice)}).`
          : `Stop Loss (₹${numTrigger.toFixed(2)}) must be strictly greater than Market Price (₹${formatNumber(executionPrice)}).`
      );
      return;
    }

    if (isTargetInvalid) {
      setErrorMsg(
        isBuyRule
          ? `Target (₹${numTarget.toFixed(2)}) must be strictly greater than Market Price (₹${formatNumber(executionPrice)}).`
          : `Target (₹${numTarget.toFixed(2)}) must be strictly less than Market Price (₹${formatNumber(executionPrice)}).`
      );
      return;
    }

    const finalPrice = orderType === 'LIMIT' ? (numLimitPrice > 0 ? numLimitPrice : selectedContract.ltp) : undefined;
    const hasProt = Boolean(numTriggerPrice || numTargetPrice);

    // In protection mode, exit order action is opposite to active position:
    // Long position (BUY) -> exits via SELL order
    // Short position (SELL) -> exits via BUY order
    const orderTransactionType = isProtectionMode
      ? (isLongPosition ? 'SELL' : 'BUY')
      : transactionType;

    const resolvedOrderType = isProtectionMode
      ? (numTriggerPrice ? (numLimitPrice && numLimitPrice > 0 ? 'SL' : 'SL-M') : 'LIMIT')
      : orderType;

    try {
      const res = await placeOrder({
        contractId: selectedContract.contractId,
        orderType: resolvedOrderType,
        transactionType: orderTransactionType,
        productType,
        quantity,
        price: finalPrice || numTargetPrice || selectedContract.ltp,
        triggerPrice: numTriggerPrice,
        targetPrice: numTargetPrice,
        trailingStopLoss: numTrail,
      });

      const symName = formatTradingSymbolDisplay(
        selectedContract.tradingSymbol,
        selectedContract.strikePrice,
        selectedContract.optionType
      );

      if (res?.status === 'PENDING') {
        toast.info(
          `⏳ Limit Order Placed (#${res.id})`,
          `${orderTransactionType} ${quantity} qty ${symName} placed at ₹${formatNumber(finalPrice || selectedContract.ltp)}`
        );
      } else {
        toast.success(
          `✅ Order Executed (#${res?.id || ''})`,
          `${orderTransactionType} ${quantity} qty ${symName} filled @ ₹${formatNumber(res?.averagePrice || executionPrice)}`
        );
      }

      setSuccessMsg(
        isProtectionMode
          ? '✅ Protection order placed successfully! Position will auto-exit on trigger.'
          : hasProt
          ? '✅ Order placed with Stop Loss & Target protection!'
          : '✅ Order placed successfully!'
      );
      setTimeout(() => {
        closeOrderPad();
        const isLimit = resolvedOrderType === 'LIMIT' || orderType === 'LIMIT' || res?.status === 'PENDING';
        if (isLimit) {
          setActiveTab('orders');
          if (typeof window !== 'undefined' && window.location.pathname !== '/orders') {
            window.history.pushState(null, '', '/orders');
          }
        } else {
          setActiveTab('positions');
          if (typeof window !== 'undefined' && window.location.pathname !== '/positions') {
            window.history.pushState(null, '', '/positions');
          }
        }
      }, 700);
    } catch (err: any) {
      const msg = err?.message || 'Failed to place order. Please try again.';
      setErrorMsg(msg);
      const isRejection =
        err?.response?.status === 422 ||
        msg.toLowerCase().includes('insufficient') ||
        msg.toLowerCase().includes('margin') ||
        msg.toLowerCase().includes('reject');

      if (isRejection) {
        toast.error('❌ Order Rejected', msg);
        setTimeout(() => {
          closeOrderPad();
          setActiveTab('orders');
          if (typeof window !== 'undefined' && window.location.pathname !== '/orders') {
            window.history.pushState(null, '', '/orders');
          }
        }, 800);
      } else {
        toast.error('❌ Order Placement Failed', msg);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-full sm:max-w-[430px] md:max-w-[450px] bg-white dark:bg-[#0F131C] text-gray-900 dark:text-white border-t sm:border border-gray-200 dark:border-[#1E2638] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans max-h-[92vh] sm:max-h-[88vh] transition-all">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mx-auto mt-2 sm:hidden shrink-0" />

        {/* Groww Header Strip (Exact match to Screenshots 2, 3, 4, 5) */}
        <div className="px-4 sm:px-5 pt-2.5 sm:pt-4 pb-2.5 sm:pb-3 flex items-center justify-between border-b border-gray-100 dark:border-[#1E2638] bg-white dark:bg-[#0F131C] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={closeOrderPad}
              className="p-1 -ml-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-wide truncate max-w-[200px] xs:max-w-[260px] sm:max-w-[290px]">
                  {formatTradingSymbolDisplay(selectedContract.tradingSymbol, selectedContract.strikePrice, selectedContract.optionType)}
                </h2>
              </div>
              <div className="text-xs mt-0.5 flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-gray-900 dark:text-white font-mono-num text-[11.5px] sm:text-xs">
                  ₹{formatNumber(selectedContract.ltp)}
                </span>
                <span className={`text-[10.5px] sm:text-[11px] font-semibold font-mono-num ${(selectedContract.changePercent ?? 0) >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}`}>
                  ({(selectedContract.changePercent ?? 0) >= 0 ? '+' : ''}{(selectedContract.changePercent ?? 0).toFixed(2)}%)
                </span>
                <span className="text-[11px] sm:text-xs text-gray-500 underline cursor-pointer hover:text-gray-900 dark:hover:text-white">Depth</span>
              </div>
            </div>
          </div>
          <button
            onClick={closeOrderPad}
            className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Success Messages */}
        {errorMsg && (
          <div className="mx-4 sm:mx-5 mt-2.5 sm:mt-3 p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[#EB5B5B] text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 sm:mx-5 mt-2.5 sm:mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-[#00D09C]/30 text-[#00D09C] text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="px-4 sm:px-5 py-3 space-y-3.5 sm:space-y-4 overflow-y-auto max-h-[56vh] sm:max-h-[60vh]">
          {/* Row 1: Delivery / Intraday (Left) & Settings & B / S Switch (Right) */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetProductType('NRML')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  productType === 'NRML'
                    ? 'border border-gray-900 text-gray-900 bg-gray-100 dark:border-gray-300 dark:text-white dark:bg-white/10 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Delivery
              </button>
              <button
                type="button"
                onClick={() => handleSetProductType('MIS')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  productType === 'MIS'
                    ? 'border border-gray-900 text-gray-900 bg-gray-100 dark:border-gray-300 dark:text-white dark:bg-white/10 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Intraday
              </button>
              <div className="h-4 w-[1px] bg-gray-200 dark:bg-[#273248] mx-0.5" />
              <button
                type="button"
                className="w-7 h-7 rounded-full border border-gray-200 dark:border-[#273248] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                title="Order Preferences"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Position badge if in protection mode, otherwise B / S Pill Switch */}
            {isProtectionMode ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-[#161C28] border border-gray-200 dark:border-[#273248] text-xs font-bold">
                <span className="text-gray-500 dark:text-gray-400">Position:</span>
                <span className={isLongPosition ? 'text-[#00A87E] dark:text-[#00D09C]' : 'text-[#DC2626] dark:text-[#EB5B5B]'}>
                  {isLongPosition ? 'BUY (Long)' : 'SELL (Short)'}
                </span>
              </div>
            ) : (
              <div className="flex items-center bg-gray-100 dark:bg-[#161C28] p-0.5 rounded-full border border-gray-200 dark:border-[#273248]">
                <button
                  type="button"
                  onClick={() => handleToggleTransactionType('BUY')}
                  className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                    isBuy
                      ? 'bg-[#E6F9F4] text-[#00A87E] dark:bg-[#00D09C] dark:text-black shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleTransactionType('SELL')}
                  className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                    !isBuy
                      ? 'bg-[#FDECEC] text-[#DC2626] dark:bg-[#EB5B5B] dark:text-white shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  S
                </button>
              </div>
            )}
          </div>

          {/* Row 2: Quantity with lot info & stepper */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Qty <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">NSE lot of {lotSize}</span>
              </div>
              {isHoldingLong && transactionType === 'SELL' && (
                <div className="text-[11px] font-medium text-emerald-600 dark:text-[#00D09C] flex items-center gap-1 mt-0.5 font-mono-num">
                  <span>Holding to Sell:</span>
                  <strong className="font-bold">{availableHoldingQty} Qty ({availableHoldingLots}L)</strong>
                </div>
              )}
              {isHoldingShort && transactionType === 'BUY' && (
                <div className="text-[11px] font-medium text-emerald-600 dark:text-[#00D09C] flex items-center gap-1 mt-0.5 font-mono-num">
                  <span>Holding to Cover:</span>
                  <strong className="font-bold">{availableHoldingQty} Qty ({availableHoldingLots}L)</strong>
                </div>
              )}
            </div>

            <div className="flex items-center border border-gray-200 dark:border-[#273248] rounded-xl bg-white dark:bg-[#161C28] overflow-hidden focus-within:border-[#00D09C] transition-colors">
              <button
                type="button"
                onClick={handleDecrementLot}
                className="w-10 h-10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer border-r border-gray-200 dark:border-[#273248]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                step={lotSize}
                min={lotSize}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) {
                    // Match to valid lot multiple
                    const computedLots = Math.max(1, Math.round(val / lotSize));
                    setLots(computedLots);
                  }
                }}
                className="w-20 text-center text-sm font-bold text-gray-900 dark:text-white font-mono-num bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={handleIncrementLot}
                className="w-10 h-10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer border-l border-gray-200 dark:border-[#273248]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Lot Chips */}
          <div className="flex items-center justify-end gap-1.5 -mt-2 flex-wrap">
            {isHoldingLong && transactionType === 'SELL' && (
              <button
                type="button"
                onClick={() => setLots(availableHoldingLots)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                  lots === availableHoldingLots
                    ? 'bg-emerald-500/20 text-[#00D09C] border border-[#00D09C]/40'
                    : 'text-emerald-600 dark:text-[#00D09C] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                Holding ({availableHoldingLots}L)
              </button>
            )}
            {[1, 2, 5, 10].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setLots(count)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                  lots === count
                    ? 'bg-[#00D09C]/20 text-[#00A87E] dark:text-[#00D09C] border border-[#00D09C]/40'
                    : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#161C28] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {count}L
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLots(maxAffordableLots)}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              Max ({maxAffordableLots}L)
            </button>
          </div>

          {/* Row 3: Price (Market / Limit) */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Price</span>
              <div className="flex items-center bg-gray-100 dark:bg-[#161C28] rounded-lg p-0.5 border border-gray-200 dark:border-[#273248]">
                <button
                  type="button"
                  onClick={() => setOrderType('MARKET')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    orderType === 'MARKET' ? 'bg-white dark:bg-[#273248] text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Market ▾
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('LIMIT')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    orderType === 'LIMIT' ? 'bg-white dark:bg-[#273248] text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Limit
                </button>
              </div>
            </div>

            {orderType === 'MARKET' ? (
              <div className="w-36 py-2 px-3 rounded-xl bg-gray-50 dark:bg-[#161C28] border border-gray-200 dark:border-[#273248] text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                At market
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepPrice(-0.05)}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#161C28] text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 dark:hover:text-white cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.05"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="w-24 py-1.5 px-2.5 rounded-xl bg-white dark:bg-[#161C28] border border-[#00D09C] text-right text-xs font-bold text-gray-900 dark:text-white font-mono-num focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleStepPrice(0.05)}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#161C28] text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 dark:hover:text-white cursor-pointer"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Add Stoploss/Target Button or Section (Matching Screenshot 3 & 5) */}
          {!showProtection ? (
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setShowProtection(true)}
                className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Add Stoploss/Target
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {/* ── 1. Stop Loss Order Card ── */}
              <div className="space-y-2 p-3 rounded-2xl bg-gray-50 dark:bg-[#161C28] border border-gray-200 dark:border-[#273248]">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pb-1">
                  <span className="font-bold text-gray-900 dark:text-white">{isBuyRule ? 'Sell SL order' : 'Buy SL order'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTriggerPrice('0');
                      if (!targetPrice || targetPrice === '0') setShowProtection(false);
                    }}
                    className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Stoploss trigger</span>
                  <input
                    type="number"
                    step="0.05"
                    value={triggerPrice === '0' ? '' : triggerPrice}
                    onChange={(e) => {
                      setTriggerPrice(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="0"
                    className={`w-32 py-1.5 px-3 rounded-xl bg-white dark:bg-[#0F131C] text-right text-xs font-bold font-mono-num focus:outline-none transition-colors ${
                      isSlInvalid
                        ? 'border-2 border-rose-500 text-rose-600 dark:text-rose-300'
                        : 'border border-gray-200 dark:border-[#273248] focus:border-amber-400 text-gray-900 dark:text-amber-400'
                    }`}
                  />
                </div>

                {/* SL Quick Chips & Trailing */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isTrailEnabled}
                        onChange={(e) => setIsTrailEnabled(e.target.checked)}
                        className="rounded border-gray-300 dark:border-[#273248] text-[#00D09C] focus:ring-0 cursor-pointer"
                      />
                      <span>Trail</span>
                    </label>

                    {isTrailEnabled && (
                      <div className="flex items-center gap-0.5">
                        <span className="text-[10px] text-gray-500">₹</span>
                        <input
                          type="number"
                          step="1"
                          value={trailAmount === '0' ? '' : trailAmount}
                          onChange={(e) => setTrailAmount(e.target.value)}
                          className="w-10 bg-white dark:bg-[#0F131C] border border-gray-200 dark:border-[#273248] rounded px-1 py-0.5 text-[10px] font-mono-num text-gray-900 dark:text-white text-right focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {[5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applySLPercent(pct)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-[#0F131C] border border-amber-200 dark:border-[#273248] hover:bg-amber-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        {isBuyRule ? `-${pct}%` : `+${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {isSlEntered && !isSlInvalid && estSlLoss !== null && (
                  <div className="text-[11px] font-mono-num flex justify-between pt-1 border-t border-gray-200/60 dark:border-[#273248]/60">
                    <span className="text-gray-500">Est. Loss at SL:</span>
                    <span className="text-[#EB5B5B] font-bold">{formatINR(estSlLoss)}</span>
                  </div>
                )}
              </div>

              {/* ── 2. Target Order Card ── */}
              <div className="space-y-2 p-3 rounded-2xl bg-gray-50 dark:bg-[#161C28] border border-gray-200 dark:border-[#273248]">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pb-1">
                  <span className="font-bold text-gray-900 dark:text-white">{isBuyRule ? 'Sell TGT order' : 'Buy TGT order'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetPrice('0');
                      if (!triggerPrice || triggerPrice === '0') setShowProtection(false);
                    }}
                    className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Target trigger</span>
                  <input
                    type="number"
                    step="0.05"
                    value={targetPrice === '0' ? '' : targetPrice}
                    onChange={(e) => {
                      setTargetPrice(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="0"
                    className={`w-32 py-1.5 px-3 rounded-xl bg-white dark:bg-[#0F131C] text-right text-xs font-bold font-mono-num focus:outline-none transition-colors ${
                      isTargetInvalid
                        ? 'border-2 border-rose-500 text-rose-600 dark:text-rose-300'
                        : 'border border-gray-200 dark:border-[#273248] focus:border-[#00D09C] text-gray-900 dark:text-emerald-400'
                    }`}
                  />
                </div>

                {/* Target Quick Chips */}
                <div className="flex items-center justify-end gap-1 pt-1">
                  {[10, 20, 30, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyTargetPercent(pct)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-[#00A87E] dark:text-emerald-400 bg-emerald-50 dark:bg-[#0F131C] border border-emerald-200 dark:border-[#273248] hover:bg-emerald-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      {isBuyRule ? `+${pct}%` : `-${pct}%`}
                    </button>
                  ))}
                </div>

                {isTargetEntered && !isTargetInvalid && estTgtProfit !== null && (
                  <div className="text-[11px] font-mono-num flex justify-between pt-1 border-t border-gray-200/60 dark:border-[#273248]/60">
                    <span className="text-gray-500">Est. Profit at Target:</span>
                    <span className="text-[#00D09C] font-bold">+{formatINR(estTgtProfit)}</span>
                  </div>
                )}
              </div>

              {/* ── 3. Risk:Reward & Breakeven Analytics ── */}
              {isSlEntered && isTargetEntered && !isSlInvalid && !isTargetInvalid && (
                (() => {
                  const riskUnit = isBuyRule ? executionPrice - numTrigger : numTrigger - executionPrice;
                  const rewardUnit = isBuyRule ? numTarget - executionPrice : executionPrice - numTarget;
                  const rrRatio = riskUnit > 0 ? (rewardUnit / riskUnit).toFixed(1) : '1.0';
                  const breakevenPrice = isBuyRule
                    ? executionPrice + (totalCharges / quantity)
                    : executionPrice - (totalCharges / quantity);

                  return (
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#161C28] border border-gray-200 dark:border-[#273248] flex items-center justify-between text-[11px] font-mono-num animate-fadeIn">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 dark:text-gray-400">Risk : Reward</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold">
                          1 : {rrRatio}
                        </span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span>Breakeven: </span>
                        <span className="text-gray-900 dark:text-white font-bold">₹{formatNumber(breakevenPrice)}</span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Insufficient Funds Warning Banner with Left Amount */}
          {hasInsufficientFunds && (
            <div className="p-2.5 sm:p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold shadow-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 px-3.5 sm:px-4">
              <span className="truncate">Shortfall: ₹{formatNumber(approxReq - availableBalance)} needed</span>
              <button
                type="button"
                onClick={() => {
                  closeOrderPad();
                  setWalletModalOpen(true);
                }}
                className="text-xs font-black text-amber-700 dark:text-amber-400 hover:underline cursor-pointer shrink-0"
              >
                + Add money
              </button>
            </div>
          )}
        </div>

        {/* Footer Info Strip & CTA Buttons */}
        <div className="px-4 sm:px-5 pt-2.5 sm:pt-3 pb-4 sm:pb-5 border-t border-gray-100 dark:border-[#1E2638] bg-white dark:bg-[#0F131C] shrink-0 space-y-2.5 sm:space-y-3">
          {/* Balance, Charges Badge & Approx Req / Credit */}
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono-num gap-1 sm:gap-2">
            <div className="flex items-center gap-1 truncate min-w-0">
              <span className="shrink-0 text-slate-400">Balance:</span>
              <strong className="text-slate-900 dark:text-white font-bold truncate">{formatINR(availableBalance)}</strong>
            </div>

            {/* Interactive Charges Chip */}
            <button
              type="button"
              onClick={() => setShowChargesBreakup(!showChargesBreakup)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer border shrink-0 ${
                showChargesBreakup
                  ? 'bg-emerald-50 text-[#008f6b] border-emerald-200 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Click to view full charges breakdown"
            >
              <span>Charges: ₹{formatNumber(totalCharges)}</span>
              <Info className="w-3 h-3 opacity-60" />
            </button>

            {isHoldingLong && transactionType === 'SELL' && freshLots === 0 ? (
              <div className="flex items-center gap-1 text-right shrink-0">
                <span className="text-emerald-600 dark:text-[#00D09C] font-semibold text-[10.5px] sm:text-xs">Credit:</span>
                <span className="text-emerald-600 dark:text-[#00D09C] font-extrabold font-mono-num text-[11px] sm:text-xs">+₹{formatNumber(approxCredit)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-right shrink-0">
                <span className="shrink-0 text-slate-400">Req:</span>
                <span className="text-slate-900 dark:text-white font-bold text-[11px] sm:text-xs">{formatINR(approxReq)}</span>
              </div>
            )}
          </div>

          {/* Clean Modern Charges Breakup Card */}
          {showChargesBreakup && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0E131F] border border-slate-200 dark:border-[#273248] text-xs space-y-2 animate-fadeIn shadow-xs font-sans">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white pb-1.5 border-b border-slate-200 dark:border-[#273248]">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[#008f6b]" />
                  <span>Estimated Charges & Taxes</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChargesBreakup(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] sm:text-[11.5px]">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Brokerage (Flat F&O)</span>
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-white">₹{formatNumber(brokerage)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Exchange Turnover Charges (NSE)</span>
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-white">₹{formatNumber(exchangeTxnCharge)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>GST (18% on Brokerage & Txn)</span>
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-white">₹{formatNumber(gst)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>SEBI Turnover + Stamp Duty</span>
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-white">₹{formatNumber(sebiCharges + stampDuty)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-[#273248] text-xs">
                <span>Total Deductions</span>
                <span className="font-mono-num text-[#008f6b] dark:text-[#00D09C] text-xs sm:text-sm">₹{formatNumber(totalCharges)}</span>
              </div>
              <div className="text-[10px] text-slate-400 text-center pt-0.5">
                Simulated based on standard NSE/SEBI derivatives tariff
              </div>
            </div>
          )}

          {/* Full Width Buy/Sell/Protection Button */}
          <button
            onClick={handleSubmitOrder}
            disabled={isLoading || isSlInvalid || isTargetInvalid}
            className={`w-full py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer ${
              isLoading
                ? 'bg-gray-400 text-white'
                : isProtectionMode
                ? 'bg-[#00D09C] hover:bg-[#00B386] text-white'
                : isHoldingLong && transactionType === 'SELL'
                ? 'bg-[#EB5B5B] hover:bg-[#DC2626] text-white'
                : isBuy
                ? 'bg-[#00D09C] hover:bg-[#00B386] text-white'
                : 'bg-[#EB5B5B] hover:bg-[#DC2626] text-white'
            }`}
          >
            {isLoading
              ? 'Processing...'
              : isProtectionMode
              ? 'Set Stoploss / Target'
              : isHoldingLong && transactionType === 'SELL'
              ? `Sell (${quantity} Qty)`
              : isHoldingShort && transactionType === 'BUY'
              ? `Buy to Cover (${quantity} Qty)`
              : isBuy
              ? 'Buy'
              : 'Sell'}
          </button>
        </div>
      </div>
    </div>
  );
};

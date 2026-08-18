import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShieldAlert, CheckCircle2, Zap, HelpCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
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
    fetchWallet,
  } = useTradingStore();

  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL' | 'SL-M'>('MARKET');
  const [productType, setProductType] = useState<'NRML' | 'MIS'>('NRML');
  const [lots, setLots] = useState(1);
  const [limitPrice, setLimitPrice] = useState<string>('');
  
  // Advanced Stop Loss & Trailing SL Controls
  const [showAdvancedSL, setShowAdvancedSL] = useState(false);
  const [triggerPrice, setTriggerPrice] = useState<string>('');
  const [trailingStopLoss, setTrailingStopLoss] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showChargesBreakup, setShowChargesBreakup] = useState(false);

  useEffect(() => {
    if (selectedContract) {
      setTransactionType(selectedContract.defaultAction ?? 'BUY');
      setLimitPrice(String(selectedContract.ltp));
      // Suggested default SL price (e.g. 10% below LTP for BUY)
      const defaultSL = (selectedContract.ltp * 0.9).toFixed(2);
      setTriggerPrice(defaultSL);
      setTrailingStopLoss('5'); // Default ₹5 trailing jump
      setLots(1);
      setErrorMsg('');
      setSuccessMsg('');
      setShowChargesBreakup(false);
      setShowAdvancedSL(false);
    }
  }, [selectedContract]);

  if (!isOrderModalOpen || !selectedContract) return null;

  const lotSize = selectedContract.lotSize || 25;
  const quantity = lots * lotSize;
  const executionPrice =
    orderType === 'LIMIT' || orderType === 'SL'
      ? parseFloat(limitPrice) || selectedContract.ltp
      : selectedContract.ltp;
  
  // Turnover & Detailed Exchange Charges Calculation
  const turnover = Number((quantity * executionPrice).toFixed(2));
  const approxReq = turnover;
  
  // Real Indian Brokerage & Tax schedule
  const brokerage = 20.00;
  const exchangeTxnCharge = Number((turnover * 0.000505).toFixed(2));
  const gst = Number(((brokerage + exchangeTxnCharge) * 0.18).toFixed(2));
  const sebiCharges = Number((turnover * 0.000001).toFixed(2));
  const stampDuty = transactionType === 'BUY' ? Number((turnover * 0.00003).toFixed(2)) : 0.00;
  const totalCharges = Number((brokerage + exchangeTxnCharge + gst + sebiCharges + stampDuty).toFixed(2));

  const availableBalance = wallet?.availableMargin ?? 1000000;
  const hasInsufficientFunds = transactionType === 'BUY' && approxReq > availableBalance;

  const handleIncrementLot = () => setLots((prev) => prev + 1);
  const handleDecrementLot = () => setLots((prev) => Math.max(1, prev - 1));

  const handleSubmitOrder = async () => {
    setErrorMsg('');
    if (hasInsufficientFunds) {
      setErrorMsg('Insufficient balance available in wallet.');
      return;
    }
    if ((orderType === 'LIMIT' || orderType === 'SL') && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      setErrorMsg('Please enter a valid limit price.');
      return;
    }
    if ((orderType === 'SL' || orderType === 'SL-M' || showAdvancedSL) && (!triggerPrice || parseFloat(triggerPrice) <= 0)) {
      setErrorMsg('Please enter a valid Stop Loss trigger price.');
      return;
    }

    try {
      const finalOrderType = showAdvancedSL
        ? (orderType === 'MARKET' ? 'SL-M' : 'SL')
        : orderType;

      await placeOrder({
        contractId: selectedContract.contractId,
        orderType: finalOrderType,
        transactionType,
        productType,
        quantity,
        price: (finalOrderType === 'LIMIT' || finalOrderType === 'SL') ? parseFloat(limitPrice) : undefined,
        triggerPrice: (finalOrderType === 'SL' || finalOrderType === 'SL-M') ? parseFloat(triggerPrice) : undefined,
        trailingStopLoss: (finalOrderType === 'SL' || finalOrderType === 'SL-M') && trailingStopLoss ? parseFloat(trailingStopLoss) : undefined,
      });
      setSuccessMsg('Paper order placed successfully with Stop Loss Protection!');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || 'Failed to place order.');
    }
  };

  const isBuy = transactionType === 'BUY';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-groww-card border border-groww-border rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header Strip */}
        <div className="flex items-center justify-between pb-4 border-b border-groww-border">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                {selectedContract.tradingSymbol}
              </h3>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                  selectedContract.optionType === 'CE'
                    ? 'bg-emerald-500/20 text-[#00D09C] border border-[#00D09C]/30'
                    : 'bg-rose-500/20 text-[#EB5B5B] border border-[#EB5B5B]/30'
                }`}
              >
                {selectedContract.optionType}
              </span>
            </div>
            <div className="text-xs text-groww-textSubtle mt-0.5 flex items-center gap-2">
              <span>NSE / NFO</span>
              <span>•</span>
              <span className="font-bold text-white font-mono-num">
                ₹{formatNumber(selectedContract.ltp)}
              </span>
            </div>
          </div>
          <button
            onClick={closeOrderPad}
            className="p-1.5 rounded-lg text-groww-textMuted hover:text-white hover:bg-groww-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Success Messages */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[#EB5B5B] text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-[#00D09C]/30 text-[#00D09C] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* BUY / SELL Switch */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-xl bg-groww-surface border border-groww-border">
          <button
            onClick={() => setTransactionType('BUY')}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              isBuy
                ? 'bg-[#00D09C] text-black shadow-lg shadow-emerald-950/40'
                : 'text-groww-textMuted hover:text-white'
            }`}
          >
            BUY
          </button>
          <button
            onClick={() => setTransactionType('SELL')}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              !isBuy
                ? 'bg-[#EB5B5B] text-white shadow-lg shadow-rose-950/40'
                : 'text-groww-textMuted hover:text-white'
            }`}
          >
            SELL
          </button>
        </div>

        {/* Product Type (Delivery / Intraday) */}
        <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-groww-surface/60 border border-groww-border">
          <span className="text-xs text-groww-textSubtle font-medium">Product</span>
          <div className="flex items-center gap-1 bg-groww-card border border-groww-border p-0.5 rounded-lg">
            <button
              onClick={() => setProductType('NRML')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                productType === 'NRML'
                  ? 'bg-groww-surface text-white'
                  : 'text-groww-textMuted hover:text-white'
              }`}
            >
              Delivery
            </button>
            <button
              onClick={() => setProductType('MIS')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                productType === 'MIS'
                  ? 'bg-groww-surface text-white'
                  : 'text-groww-textMuted hover:text-white'
              }`}
            >
              Intraday
            </button>
          </div>
        </div>

        {/* Order Type (Market / Limit) */}
        <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-groww-surface/60 border border-groww-border">
          <span className="text-xs text-groww-textSubtle font-medium">Order Type</span>
          <div className="flex items-center gap-1 bg-groww-card border border-groww-border p-0.5 rounded-lg">
            <button
              onClick={() => setOrderType('MARKET')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                orderType === 'MARKET'
                  ? 'bg-groww-surface text-white'
                  : 'text-groww-textMuted hover:text-white'
              }`}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType('LIMIT')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                orderType === 'LIMIT'
                  ? 'bg-groww-surface text-white'
                  : 'text-groww-textMuted hover:text-white'
              }`}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Limit Price Input if LIMIT */}
        {orderType === 'LIMIT' && (
          <div className="mt-3 p-3 rounded-xl bg-groww-surface border border-groww-border flex items-center justify-between">
            <span className="text-xs text-groww-textSubtle font-medium">Price Limit (₹)</span>
            <input
              type="number"
              step="0.05"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="w-28 bg-groww-card border border-groww-border rounded-lg px-2.5 py-1 text-right text-xs font-bold text-white font-mono-num focus:outline-none focus:border-[#00D09C]"
            />
          </div>
        )}

        {/* Lot Counter & Quantity */}
        <div className="mt-3 p-3 rounded-xl bg-groww-surface border border-groww-border flex items-center justify-between">
          <div>
            <div className="text-xs text-white font-semibold">Qty (lot of {lotSize})</div>
            <div className="text-[10px] text-groww-textSubtle">
              {lots} {lots === 1 ? 'Lot' : 'Lots'} × {lotSize} = {quantity} Qty
            </div>
          </div>
          <div className="flex items-center gap-2 bg-groww-card border border-groww-border rounded-xl p-1">
            <button
              onClick={handleDecrementLot}
              className="w-7 h-7 rounded-lg bg-groww-surface hover:bg-groww-hover text-white flex items-center justify-center transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center text-xs font-bold text-white font-mono-num">
              {quantity}
            </span>
            <button
              onClick={handleIncrementLot}
              className="w-7 h-7 rounded-lg bg-groww-surface hover:bg-groww-hover text-white flex items-center justify-center transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stop Loss & Trailing SL Toggle Button */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedSL(!showAdvancedSL)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-groww-surface/50 hover:bg-groww-surface border border-groww-border text-xs text-left transition-colors"
          >
            <span className="font-semibold text-white">Add Stoploss / Trailing SL</span>
            {showAdvancedSL ? (
              <ChevronUp className="w-4 h-4 text-[#00D09C]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-groww-textMuted" />
            )}
          </button>

          {showAdvancedSL && (
            <div className="mt-2 p-3.5 rounded-xl bg-groww-surface border border-groww-border space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Stop Loss Trigger (₹)</div>
                  <div className="text-[10px] text-groww-textSubtle">Auto exit on price ≤ Trigger</div>
                </div>
                <input
                  type="number"
                  step="0.05"
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                  placeholder="e.g. 70.00"
                  className="w-28 bg-groww-card border border-groww-border rounded-lg px-2.5 py-1 text-right text-xs font-bold text-white font-mono-num focus:outline-none focus:border-[#00D09C]"
                />
              </div>

              <div className="flex items-center justify-between border-t border-groww-border/60 pt-2.5">
                <div>
                  <div className="text-xs font-semibold text-[#00D09C]">Trailing SL Jump (₹)</div>
                  <div className="text-[10px] text-groww-textSubtle">Trails SL up when price rises &gt; trail</div>
                </div>
                <input
                  type="number"
                  step="1"
                  value={trailingStopLoss}
                  onChange={(e) => setTrailingStopLoss(e.target.value)}
                  placeholder="e.g. 5.00"
                  className="w-28 bg-groww-card border border-groww-border rounded-lg px-2.5 py-1 text-right text-xs font-bold text-white font-mono-num focus:outline-none focus:border-[#00D09C]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Clean Footer Strip matching Groww design */}
        <div className="mt-4 pt-3 border-t border-groww-border flex items-center justify-between text-xs">
          <div className="text-groww-textSubtle">
            <span>Balance: </span>
            <span className="font-bold text-white font-mono-num">
              {formatINR(availableBalance)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowChargesBreakup(!showChargesBreakup)}
              className="text-groww-textSubtle hover:text-[#00D09C] border-b border-dashed border-groww-border text-xs flex items-center gap-1 transition-colors"
            >
              <span>Approx req :</span>
              <span className="font-extrabold text-white font-mono-num">
                {formatINR(approxReq)}
              </span>
              <HelpCircle className="w-3.5 h-3.5 text-groww-textMuted" />
            </button>
            <button
              onClick={() => fetchWallet()}
              className="p-1 rounded text-groww-textMuted hover:text-white transition-colors"
              title="Refresh Balance"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Charges Breakup Popup */}
        {showChargesBreakup && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#0e111a] border border-groww-border text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between font-bold text-white pb-1.5 border-b border-groww-border/60">
              <span>Approx charges</span>
              <button
                onClick={() => setShowChargesBreakup(false)}
                className="text-groww-textMuted hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between text-groww-textSubtle">
              <span>Brokerage</span>
              <span className="font-mono-num text-white">₹{formatNumber(brokerage)}</span>
            </div>
            <div className="flex items-center justify-between text-groww-textSubtle">
              <span>Exchange transaction charges</span>
              <span className="font-mono-num text-white">₹{formatNumber(exchangeTxnCharge)}</span>
            </div>
            <div className="flex items-center justify-between text-groww-textSubtle">
              <span>GST</span>
              <span className="font-mono-num text-white">₹{formatNumber(gst)}</span>
            </div>
            <div className="flex items-center justify-between text-groww-textSubtle">
              <span>SEBI turnover charges</span>
              <span className="font-mono-num text-white">₹{formatNumber(sebiCharges)}</span>
            </div>
            <div className="flex items-center justify-between text-groww-textSubtle">
              <span>Stamp duty</span>
              <span className="font-mono-num text-white">₹{formatNumber(stampDuty)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-white pt-1.5 border-t border-groww-border/60">
              <span>Total Est. Charges</span>
              <span className="font-mono-num text-[#00D09C]">₹{formatNumber(totalCharges)}</span>
            </div>
          </div>
        )}

        {/* Order Submit Button */}
        <button
          onClick={handleSubmitOrder}
          disabled={isLoading || hasInsufficientFunds}
          className={`mt-4 w-full py-3 px-4 rounded-xl text-sm font-extrabold tracking-wide uppercase flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${
            isBuy
              ? 'bg-[#00D09C] hover:bg-[#00B386] text-black shadow-emerald-950/50'
              : 'bg-[#EB5B5B] hover:bg-[#D94848] text-white shadow-rose-950/50'
          }`}
        >
          <Zap className="w-4 h-4 stroke-[2.5]" />
          <span>
            {isLoading
              ? 'Executing...'
              : isBuy
              ? 'Buy'
              : 'Sell'}
          </span>
        </button>
      </div>
    </div>
  );
};

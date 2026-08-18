import React, { useState } from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatNumber } from '../../lib/utils.js';
import { CheckCircle2, Clock, XCircle, ArrowUpRight, Edit3, X, Trash2, Ban } from 'lucide-react';
import type { OptionOrderEntity } from '@trademitra/shared';

export const OrderBookTable: React.FC = () => {
  const { orders, setActiveTab, cancelOrder, cancelAllOrders, modifyOrder } = useTradingStore();
  const [filter, setFilter] = useState<'ALL' | 'EXECUTED' | 'PENDING' | 'REJECTED' | 'CANCELLED'>('ALL');
  
  // Modal for modifying pending order
  const [modifyingOrder, setModifyingOrder] = useState<OptionOrderEntity | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editTriggerPrice, setEditTriggerPrice] = useState<string>('');
  const [editTrailingStopLoss, setEditTrailingStopLoss] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  const handleOpenModify = (order: OptionOrderEntity) => {
    setModifyingOrder(order);
    setEditPrice(order.price ? String(order.price) : '');
    setEditTriggerPrice(order.triggerPrice ? String(order.triggerPrice) : '');
    setEditTrailingStopLoss(order.trailingStopLoss ? String(order.trailingStopLoss) : '');
    setEditQuantity(String(order.quantity));
  };

  const handleSaveModify = async () => {
    if (!modifyingOrder) return;
    setIsSubmitting(true);
    try {
      const payload: { price?: number; triggerPrice?: number; trailingStopLoss?: number; quantity?: number } = {};
      if (editPrice) payload.price = parseFloat(editPrice);
      if (editTriggerPrice) payload.triggerPrice = parseFloat(editTriggerPrice);
      if (editTrailingStopLoss) payload.trailingStopLoss = parseFloat(editTrailingStopLoss);
      if (editQuantity) payload.quantity = parseInt(editQuantity, 10);

      await modifyOrder(modifyingOrder.id, payload);
      setModifyingOrder(null);
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
          Your executed and pending paper trading orders will appear here.
        </p>
        <button
          onClick={() => setActiveTab('option-chain')}
          className="py-2.5 px-6 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-bold transition-all shadow-lg shadow-emerald-950/30 flex items-center gap-2"
        >
          <span>Trade via Option Chain</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar with Filter Tabs and Cancel All Orders CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'EXECUTED', 'PENDING', 'CANCELLED', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === tab
                  ? 'bg-groww-surface text-white border border-groww-borderLight shadow-sm'
                  : 'text-groww-textMuted hover:text-white bg-groww-card border border-groww-border'
              }`}
            >
              {tab === 'ALL' ? 'All Orders' : tab.charAt(0) + tab.slice(1).toLowerCase()}
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[#EB5B5B] border border-rose-500/30 text-xs font-bold transition-all shadow-sm"
            title="Cancel all pending orders"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Cancel All ({pendingOrdersCount})</span>
          </button>
        )}
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-groww-border bg-groww-card overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-groww-surface/60 border-b border-groww-border text-groww-textSubtle font-semibold uppercase text-[10px]">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Contract ID / Symbol</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Order Type</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Price (₹)</th>
                <th className="py-3 px-4 text-right">Trigger (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-groww-border/40 font-mono-num">
              {filteredOrders.map((order) => {
                const isBuy = order.transactionType === 'BUY';
                const timeStr = new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr key={order.id} className="hover:bg-groww-hover/50 transition-colors">
                    <td className="py-3 px-4 text-groww-textSubtle">{timeStr}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded font-sans ${
                          isBuy
                            ? 'bg-emerald-500/20 text-[#00D09C]'
                            : 'bg-rose-500/20 text-[#EB5B5B]'
                        }`}
                      >
                        {order.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white font-sans">
                      <span>Contract #{order.contractId}</span>
                    </td>
                    <td className="py-3 px-4 text-groww-textMuted font-sans">{order.productType}</td>
                    <td className="py-3 px-4 text-groww-textMuted font-sans">{order.orderType}</td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      {order.quantity}
                    </td>
                    <td className="py-3 px-4 text-right text-white font-bold">
                      ₹{formatNumber(order.averagePrice || order.price)}
                    </td>
                    <td className="py-3 px-4 text-right text-groww-textMuted">
                      {order.triggerPrice ? (
                        <div className="flex flex-col items-end">
                          <span>₹{formatNumber(order.triggerPrice)}</span>
                          {order.trailingStopLoss ? (
                            <span className="text-[9px] text-[#00D09C] font-semibold">
                              (Trail: ₹{order.trailingStopLoss})
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {order.status === 'EXECUTED' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00D09C] bg-emerald-500/10 border border-[#00D09C]/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Executed
                        </span>
                      )}
                      {order.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {(order.status === 'CANCELLED' || order.status === 'REJECTED') && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EB5B5B] bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> {order.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {order.status === 'PENDING' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenModify(order)}
                            className="p-1.5 rounded-lg bg-groww-surface hover:bg-groww-hover border border-groww-border text-white text-xs transition-all hover:border-[#00D09C] hover:text-[#00D09C]"
                            title="Modify Order Price / Trigger / Qty"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => cancelOrder(order.id)}
                            className="p-1.5 rounded-lg bg-groww-surface hover:bg-rose-500/20 border border-groww-border text-white text-xs transition-all hover:border-rose-500/60 hover:text-[#EB5B5B]"
                            title="Cancel Order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-groww-textSubtle text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modify Order Modal */}
      {modifyingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-groww-card border border-groww-border p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-groww-border">
              <div>
                <h4 className="text-sm font-bold text-white">Modify Pending Order</h4>
                <p className="text-[11px] text-groww-textSubtle mt-0.5">
                  {modifyingOrder.orderType} • {modifyingOrder.transactionType}
                </p>
              </div>
              <button
                onClick={() => setModifyingOrder(null)}
                className="p-1 rounded-lg text-groww-textMuted hover:text-white hover:bg-groww-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-groww-textSubtle mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-groww-surface border border-groww-border focus:border-[#00D09C] focus:outline-none text-white text-xs font-mono-num font-bold"
                />
              </div>

              {['LIMIT', 'SL'].includes(modifyingOrder.orderType) && (
                <div>
                  <label className="block text-[11px] font-semibold text-groww-textSubtle mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-groww-surface border border-groww-border focus:border-[#00D09C] focus:outline-none text-white text-xs font-mono-num font-bold"
                  />
                </div>
              )}

              {['SL', 'SL-M'].includes(modifyingOrder.orderType) && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-groww-textSubtle mb-1">
                      Trigger Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={editTriggerPrice}
                      onChange={(e) => setEditTriggerPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-groww-surface border border-groww-border focus:border-[#00D09C] focus:outline-none text-white text-xs font-mono-num font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#00D09C] mb-1">
                      Trailing SL Jump (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={editTrailingStopLoss}
                      onChange={(e) => setEditTrailingStopLoss(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 rounded-xl bg-groww-surface border border-groww-border focus:border-[#00D09C] focus:outline-none text-white text-xs font-mono-num font-bold"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModifyingOrder(null)}
                className="flex-1 py-2 rounded-xl bg-groww-surface hover:bg-groww-hover border border-groww-border text-white text-xs font-bold transition-all"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleSaveModify}
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

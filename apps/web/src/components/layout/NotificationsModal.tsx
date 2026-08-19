import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Send,
  Volume2,
} from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import type { NotificationEntity } from '@trademitra/shared';

function formatRelativeTime(isoString: string): string {
  if (!isoString) return 'just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export const NotificationsModal: React.FC = () => {
  const {
    notifications,
    isNotificationsOpen,
    setNotificationsOpen,
    markNotificationRead,
    broadcastNotification,
    setActiveTab,
  } = useTradingStore();

  const [showBroadcastBox, setShowBroadcastBox] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isPushEnabled, setIsPushEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  const handleNotificationClick = (notif: NotificationEntity) => {
    if (!notif.isRead) markNotificationRead(notif.id);
    setNotificationsOpen(false);
    setActiveTab('positions');
  };

  if (!isNotificationsOpen) return null;

  const handleRequestPush = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setIsPushEnabled(true);
          new Notification('PREVO Notifications Active', {
            body: 'You will receive real-time alerts on trade execution, SL triggers, and market events.',
          });
        }
      } catch (err) {
        console.error('Failed to request push permission:', err);
      }
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    await broadcastNotification(broadcastTitle, broadcastMessage);
    setBroadcastTitle('');
    setBroadcastMessage('');
    setShowBroadcastBox(false);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[90vh] mt-12 sm:mt-14 mr-0 sm:mr-4 animate-slideDown"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
              <Bell className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-slate-400">Trade Executions & Broadcasts</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markNotificationRead()}
                className="p-1.5 rounded-xl text-slate-500 hover:text-[#008f6b] hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="text-[11px]">Mark read</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowBroadcastBox((prev) => !prev)}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold"
              title="Broadcast Announcement"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Browser Push Permission Alert */}
        {!isPushEnabled && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs shrink-0 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-[#008f6b] shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-slate-900">Enable Push Notifications</span>
                <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                  Get instant sound alerts on execution
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestPush}
              className="px-3 py-1.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black text-[11px] font-black shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Enable
            </button>
          </div>
        )}

        {/* Broadcast Sender Form */}
        {showBroadcastBox && (
          <form onSubmit={handleSendBroadcast} className="mx-4 my-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 shrink-0 animate-fadeIn">
            <div className="text-xs font-bold text-slate-900">Broadcast Common Alert to All Users:</div>
            <input
              type="text"
              placeholder="Announcement Title..."
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#00D09C]"
              required
            />
            <textarea
              placeholder="Message details (e.g. Market opening at 9:15 AM)..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#00D09C] resize-none h-16"
              required
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBroadcastBox(false)}
                className="px-3 py-1 text-xs font-bold rounded-lg text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-black rounded-lg bg-[#00D09C] hover:bg-[#00B386] text-black shadow-xs cursor-pointer"
              >
                Send to All
              </button>
            </div>
          </form>
        )}

        {/* Notifications Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1 styled-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800">No Notifications</p>
              <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                Real-time updates on executed trades and platform broadcasts will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isBuy = notif.data?.transactionType === 'BUY' || notif.message?.toLowerCase().includes('buy');
              const isSell = notif.data?.transactionType === 'SELL' || notif.message?.toLowerCase().includes('sell');
              const actionType = isBuy ? 'BUY' : isSell ? 'SELL' : 'TRADE';
              const displaySymbol = notif.data?.tradingSymbol || notif.title || 'Executed Order';
              const qty = notif.data?.quantity;
              const price = notif.data?.price ? Number(notif.data.price).toFixed(2) : notif.data?.ltp ? Number(notif.data.ltp).toFixed(2) : null;
              const productType = notif.data?.productType;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-3.5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 select-none group ${
                    notif.isRead
                      ? 'hover:bg-slate-50 opacity-90'
                      : 'bg-emerald-50/40 hover:bg-emerald-50/80 border-l-2 border-[#00D09C]'
                  }`}
                >
                  {/* Left: Status dot & Clean info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isBuy ? 'bg-[#00D09C]' : 'bg-[#EF4444]'
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      {/* Top Row: Symbol + Action Badge */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-bold text-slate-900 truncate group-hover:text-[#008f6b] transition-colors">
                          {displaySymbol}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-extrabold tracking-tight ${
                            isBuy
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {actionType}
                        </span>
                      </div>

                      {/* Bottom Info: Qty @ Price · Product */}
                      <div className="text-[11.5px] text-slate-600 font-medium mt-0.5 flex items-center gap-1.5 truncate">
                        {qty && <span>{qty} Qty</span>}
                        {price && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="font-semibold text-slate-800">₹{price}</span>
                          </>
                        )}
                        {productType && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-500 uppercase text-[10px]">{productType}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Relative Time + Position link */}
                  <div className="text-right shrink-0">
                    <span className="text-[10.5px] text-slate-400 font-medium block">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                    <span className="text-[10px] font-bold text-[#008f6b] group-hover:underline opacity-80 group-hover:opacity-100">
                      Position ↗
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0 font-medium">
          <span>
            Showing <strong className="text-slate-900">{notifications.length}</strong> alerts
          </span>
          <button
            type="button"
            onClick={() => setNotificationsOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

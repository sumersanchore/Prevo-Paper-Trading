import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Activity,
  ShieldCheck,
  LogIn,
  LogOut,
  Wallet,
  Briefcase,
  Clock,
  Compass,
  ChevronDown,
  Terminal,
  RotateCcw,
} from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR } from '../../lib/utils.js';

function formatTimeAgo(isoString: string): string {
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

export const Header: React.FC = () => {
  const {
    user,
    isAuthenticated,
    openAuthModal,
    logout,
    setWalletModalOpen,
    resetWallet,
    wallet,
    setActiveTab,
    notifications,
    setNotificationsOpen,
    markNotificationRead,
  } = useTradingStore();

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const handleNotificationClick = (notif: any) => {
    if (!notif.isRead) markNotificationRead(notif.id);
    setIsBellOpen(false);
    setActiveTab('positions');
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsBellOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
        setIsBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email && email.trim().length > 0) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'TR';
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left Section: Logo & Brand */}
          <div
            onClick={() => {
              setActiveTab('option-chain');
              if (window.location.pathname !== '/explore' && window.location.pathname !== '/') {
                window.history.pushState(null, '', '/explore');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-black font-extrabold stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-0.5">
                PRE<span className="text-[#008f6b]">VO</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#008f6b] border border-emerald-200/80 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#008f6b] animate-pulse" />
                100% Free Platform
              </span>
              <span className="hidden md:inline-flex text-[10.5px] font-semibold text-slate-400">
                by <strong className="text-slate-800 font-bold ml-1">Sumer Kumar</strong>
              </span>
            </div>
          </div>

          {/* Right Section: Terminal, Notification & User Profile / Single Sign-In CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Terminal quick trigger */}
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span>Terminal</span>
            </button>

            {/* Notification Bell Dropdown Container */}
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => setIsBellOpen((prev) => !prev)}
                className="relative p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer active:scale-95"
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#F04438] text-[9px] font-black text-white shadow-xs">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Screenshot-Styled Dropdown Popover with Top Caret */}
              {isBellOpen && (
                <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-[370px] bg-[#EBF9F5] border border-[#C6ECE1] rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn font-sans">
                  {/* Pointing triangle caret */}
                  <div className="absolute -top-2 right-3.5 w-4 h-4 bg-[#EBF9F5] rotate-45 border-t border-l border-[#C6ECE1] z-10" />

                  {/* Scrollable Notifications List */}
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-[#D7F3EA] styled-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="py-10 px-4 text-center text-xs font-semibold text-slate-400">
                        No notifications right now
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notif) => {
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
                            className="px-3.5 py-2.5 hover:bg-[#E1F6F0] transition-colors cursor-pointer flex items-center justify-between gap-2.5 relative select-none group"
                          >
                            {/* Left: Minimal status indicator dot + clean trade info */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${isBuy ? 'bg-[#00D09C]' : 'bg-[#EF4444]'
                                  }`}
                              />

                              <div className="min-w-0 flex-1">
                                {/* Top Row: Symbol + Action Badge */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[12.5px] font-bold text-slate-900 truncate">
                                    {displaySymbol}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9.5px] font-extrabold tracking-tight ${isBuy
                                        ? 'bg-emerald-100/90 text-emerald-800'
                                        : 'bg-rose-100/90 text-rose-800'
                                      }`}
                                  >
                                    {actionType}
                                  </span>
                                </div>

                                {/* Bottom Info Row: Qty @ Price · Product */}
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

                            {/* Right: Relative Time + Quick Redirect Hint */}
                            <div className="text-right shrink-0">
                              <span className="text-[10.5px] text-slate-400 font-medium block">
                                {formatTimeAgo(notif.createdAt)}
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

                  {/* VIEW ALL Footer Link */}
                  <div className="bg-white border-t border-[#D7F3EA] py-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBellOpen(false);
                        setNotificationsOpen(true);
                      }}
                      className="text-[#3B82F6] hover:text-[#1D4ED8] text-xs font-black tracking-wider uppercase cursor-pointer hover:underline"
                    >
                      VIEW ALL
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Authenticated User / Single Clean Sign-In CTA */}
            {isAuthenticated ? (
              <div className="relative" ref={profileRef}>
                {/* Clickable Profile Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-[#00D09C] flex items-center justify-center text-xs font-black text-white shadow-md border border-indigo-400/40 shrink-0">
                    {getInitials(user?.fullName, user?.email)}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1 group-hover:text-[#008f6b] transition-colors">
                      <span>{user?.fullName || 'Trader'}</span>
                      <ChevronDown
                        className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-[#008f6b]' : ''
                          }`}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 leading-none truncate max-w-[110px]">
                      {user?.email}
                    </div>
                  </div>
                </button>

                {/* Top-Right Profile Dropdown Popover */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn font-sans">
                    {/* User Info Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-[#00D09C] flex items-center justify-center text-sm font-black text-white shadow-lg border border-indigo-400/40 shrink-0">
                          {getInitials(user?.fullName, user?.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1">
                            <span>{user?.fullName || 'Trader'}</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-[#008f6b] shrink-0" />
                          </div>
                          <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                        </div>
                      </div>
                    </div>

                    {/* Virtual Capital Breakdown Card */}
                    <div className="p-3.5 border-b border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Available to Trade</span>
                        <span className="text-[10px] text-slate-400 font-mono-num">Real-time</span>
                      </div>
                      <div className="text-xl font-black text-[#008f6b] font-mono-num">
                        {formatINR(wallet?.availableMargin ?? 1000000)}
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Invested in Trades:</span>
                          <span className="font-bold text-slate-800 font-mono-num">
                            {formatINR(wallet?.utilizedMargin ?? 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Total Virtual Capital:</span>
                          <span className="font-bold text-slate-800 font-mono-num">
                            {formatINR(wallet?.cashBalance ?? 1000000)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Want to start fresh?</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await resetWallet();
                            setIsProfileOpen(false);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-2xs active:scale-95"
                        >
                          <RotateCcw className="w-3 h-3 text-[#008f6b]" />
                          <span>Reset to ₹10L</span>
                        </button>
                      </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="p-2 space-y-1 text-xs font-semibold text-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setActiveTab('option-chain');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                      >
                        <Compass className="w-4 h-4 text-[#008f6b]" />
                        <span>Explore Option Chain</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setActiveTab('positions');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                      >
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        <span>Open Positions</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setActiveTab('orders');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                      >
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Order Book</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setWalletModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                      >
                        <Wallet className="w-4 h-4 text-purple-600" />
                        <span>Funds & Capital Statement</span>
                      </button>
                    </div>

                    {/* Logout Footer */}
                    <div className="p-2 border-t border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold transition-all cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Single Clean Primary Sign-In Button */
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-xs transition-all shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer select-none"
              >
                <LogIn className="w-4 h-4 stroke-[2.5]" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

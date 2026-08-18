import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Activity,
  ShieldCheck,
  LogIn,
  LogOut,
  Wallet,
  UserPlus,
  PlusCircle,
  RefreshCw,
  Briefcase,
  Clock,
  Compass,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR } from '../../lib/utils.js';

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
  } = useTradingStore();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
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

  const handleQuickReset = async () => {
    setIsResetting(true);
    try {
      await resetWallet();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0C0D14]/90 backdrop-blur-md border-b border-groww-border">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left Section: Logo & Brand */}
          <div
            onClick={() => setActiveTab('option-chain')}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-black font-extrabold stroke-[2.5]" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
                Trade<span className="text-[#00D09C]">Mitra</span>
              </span>
            </div>
          </div>

          {/* Right Section: Notification & User Profile Popover */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification */}
            <button className="p-1.5 sm:p-2 rounded-lg bg-groww-card hover:bg-groww-surface border border-groww-border text-groww-textMuted hover:text-white transition-colors cursor-pointer">
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Authenticated User / Login CTA */}
            {isAuthenticated ? (
              <div className="relative" ref={profileRef}>
                {/* Clickable Profile Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-[#1A2130] border border-transparent hover:border-[#273248] transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-[#00D09C] flex items-center justify-center text-xs font-black text-white shadow-md border border-indigo-400/40 shrink-0">
                    {getInitials(user?.fullName, user?.email)}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1 group-hover:text-[#00D09C] transition-colors">
                      <span>{user?.fullName || 'Trader'}</span>
                      <ChevronDown
                        className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
                          isProfileOpen ? 'rotate-180 text-[#00D09C]' : ''
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-groww-textSubtle leading-none truncate max-w-[110px]">
                      {user?.email}
                    </div>
                  </div>
                </button>

                {/* Top-Right Profile Dropdown Popover */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#121620] border border-[#273248] rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn font-sans">
                    {/* User Info Header */}
                    <div className="p-4 bg-gradient-to-b from-[#181F2E] to-[#121620] border-b border-[#1E2638]">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-[#00D09C] flex items-center justify-center text-sm font-black text-white shadow-lg border border-indigo-400/40 shrink-0">
                          {getInitials(user?.fullName, user?.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate flex items-center gap-1">
                            <span>{user?.fullName || 'Trader'}</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-[#00D09C] shrink-0" />
                          </div>
                          <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-[#00D09C]/30 text-[#00D09C] text-[10px] font-bold">
                            <Sparkles className="w-2.5 h-2.5" /> Paper Trader Pro
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Deposit & Wallet Margin Management Card */}
                    <div className="p-3.5 border-b border-[#1E2638] bg-[#0E121B]">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Available Margin</span>
                        <span className="text-[10px] text-gray-500 font-mono-num">Real-time</span>
                      </div>
                      <div className="text-xl font-black text-[#00D09C] font-mono-num mt-0.5">
                        {formatINR(wallet?.availableMargin ?? 1000000)}
                      </div>

                      {/* Deposit & Reset Actions */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            setWalletModalOpen(true);
                          }}
                          className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-[#00D09C] to-[#00B386] hover:from-[#00E5AA] hover:to-[#00D09C] text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>+ Deposit</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickReset}
                          disabled={isResetting}
                          className="py-2 px-2.5 rounded-xl bg-[#1A2130] hover:bg-[#232B3E] border border-[#2E3A52] text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 text-[#00D09C] ${
                              isResetting ? 'animate-spin' : ''
                            }`}
                          />
                          <span>Reset ₹10L</span>
                        </button>
                      </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="p-2 space-y-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setActiveTab('option-chain');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#1A2130] transition-colors cursor-pointer text-left"
                      >
                        <Compass className="w-4 h-4 text-[#00D09C]" />
                        <span>Explore Option Chain</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setActiveTab('positions');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#1A2130] transition-colors cursor-pointer text-left"
                      >
                        <Briefcase className="w-4 h-4 text-blue-400" />
                        <span>Open Positions</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setActiveTab('orders');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#1A2130] transition-colors cursor-pointer text-left"
                      >
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Order Book</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setWalletModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#1A2130] transition-colors cursor-pointer text-left"
                      >
                        <Wallet className="w-4 h-4 text-purple-400" />
                        <span>Funds & Margin Statement</span>
                      </button>
                    </div>

                    {/* Logout Footer */}
                    <div className="p-2 border-t border-[#1E2638] bg-[#0E121B]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-[#EB5B5B] text-xs font-bold transition-all cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-groww-border">
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1E2C] hover:bg-[#252A3D] border border-groww-border text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#00D09C]" />
                  <span>Login</span>
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-xs font-extrabold text-black transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Register</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

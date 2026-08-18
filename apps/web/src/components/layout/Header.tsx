import React from 'react';
import { Bell, Activity, ShieldCheck, LogIn, LogOut, Wallet, UserPlus } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatINR } from '../../lib/utils.js';

export const Header: React.FC = () => {
  const { user, isAuthenticated, openAuthModal, logout, setWalletModalOpen, wallet } =
    useTradingStore();

  const getInitials = (name?: string) => {
    if (!name) return 'TR';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0C0D14]/90 backdrop-blur-md border-b border-groww-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section: Logo & Brand */}
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Activity className="w-5 h-5 text-black font-extrabold stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Trade<span className="text-[#00D09C]">Mitra</span>
              </span>
            </div>
          </div>

          {/* Right Section: Wallet, Auth & Profile */}
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <button
                onClick={() => setWalletModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-groww-card hover:bg-groww-surface border border-groww-border text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5 text-[#00D09C]" />
                <span className="text-groww-textSubtle hidden sm:inline">Margin:</span>
                <span className="font-bold text-[#00D09C] font-mono-num">
                  {formatINR(wallet?.availableMargin ?? 1000000)}
                </span>
              </button>
            )}

            {/* Notification */}
            <button className="p-2 rounded-lg bg-groww-card hover:bg-groww-surface border border-groww-border text-groww-textMuted hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
            </button>

            {/* Authenticated User / Login CTA */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2 border-l border-groww-border">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white border border-indigo-400/30">
                  {getInitials(user?.fullName)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1">
                    {user?.fullName || 'Trader'}
                    <ShieldCheck className="w-3 h-3 text-[#00D09C]" />
                  </div>
                  <div className="text-[10px] text-groww-textSubtle leading-none truncate max-w-[120px]">
                    {user?.email}
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-groww-textMuted hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-groww-border">
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1E2C] hover:bg-[#252A3D] border border-groww-border text-xs font-bold text-white transition-all"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#00D09C]" />
                  <span>Login</span>
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-xs font-extrabold text-black transition-all shadow-md shadow-emerald-950/40"
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

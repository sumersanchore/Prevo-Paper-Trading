import React from 'react';
import { Compass, Briefcase, Clock, User } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';

interface MobileBottomNavProps {
  activeTab: 'option-chain' | 'positions' | 'orders' | 'watchlist';
  setActiveTab: (tab: 'option-chain' | 'positions' | 'orders' | 'watchlist') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { positionsSummary, orders, setWalletModalOpen, isAuthenticated, user, openAuthModal } = useTradingStore();
  const openPositionsCount = positionsSummary?.positions.filter((p) => p.status === 'OPEN' && p.netQuantity !== 0).length || 0;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0C0D14]/95 backdrop-blur-xl border-t border-[#1E2638] px-3 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      {/* 1. Explore / Option Chain */}
      <button
        type="button"
        onClick={() => setActiveTab('option-chain')}
        className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
          activeTab === 'option-chain' ? 'text-[#00D09C]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-xl transition-all ${activeTab === 'option-chain' ? 'bg-[#00D09C]/15' : ''}`}>
          <Compass className="w-5 h-5 stroke-[2.2]" />
        </div>
        <span className="text-[10px] font-bold tracking-tight">Explore</span>
      </button>

      {/* 2. Positions */}
      <button
        type="button"
        onClick={() => setActiveTab('positions')}
        className={`flex flex-col items-center gap-1 transition-all relative cursor-pointer ${
          activeTab === 'positions' ? 'text-[#00D09C]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-xl transition-all relative ${activeTab === 'positions' ? 'bg-[#00D09C]/15' : ''}`}>
          <Briefcase className="w-5 h-5 stroke-[2.2]" />
          {openPositionsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#00D09C] text-black font-extrabold text-[9px] flex items-center justify-center shadow-sm">
              {openPositionsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold tracking-tight">Positions</span>
      </button>

      {/* 3. Orders */}
      <button
        type="button"
        onClick={() => setActiveTab('orders')}
        className={`flex flex-col items-center gap-1 transition-all relative cursor-pointer ${
          activeTab === 'orders' ? 'text-[#00D09C]' : 'text-gray-400 hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-xl transition-all relative ${activeTab === 'orders' ? 'bg-[#00D09C]/15' : ''}`}>
          <Clock className="w-5 h-5 stroke-[2.2]" />
          {pendingOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-black font-extrabold text-[9px] flex items-center justify-center shadow-sm">
              {pendingOrdersCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold tracking-tight">Orders</span>
      </button>

      {/* 4. Profile / You Tab (Groww Style) */}
      <button
        type="button"
        onClick={() => {
          if (isAuthenticated) {
            setWalletModalOpen(true);
          } else {
            openAuthModal('login');
          }
        }}
        className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-all cursor-pointer"
      >
        {isAuthenticated ? (
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-indigo-400/30">
            {(() => {
              const name = user?.fullName;
              if (name && name.trim().length > 0) {
                const parts = name.trim().split(' ');
                if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
                return name.slice(0, 2).toUpperCase();
              }
              return 'U';
            })()}
          </div>
        ) : (
          <div className="p-1 rounded-xl">
            <User className="w-5 h-5 stroke-[2.2]" />
          </div>
        )}
        <span className="text-[10px] font-bold tracking-tight">
          {isAuthenticated ? 'Profile' : 'Sign In'}
        </span>
      </button>
    </nav>
  );
};

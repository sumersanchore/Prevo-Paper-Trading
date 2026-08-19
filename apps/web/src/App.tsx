import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header.js';
import { MarketTicker } from './components/layout/MarketTicker.js';
import { MobileBottomNav } from './components/layout/MobileBottomNav.js';
import { WalletModal } from './components/layout/WalletModal.js';
import { AuthModal } from './components/layout/AuthModal.js';
import { AuthPage } from './features/auth/AuthPage.js';
import { OptionChainTable } from './features/option-chain/OptionChainTable.js';
import { GrowwOrderModal } from './features/order-pad/GrowwOrderModal.js';
import { PositionsList } from './features/positions/PositionsList.js';
import { OrderBookTable } from './features/orders/OrderBookTable.js';
import { NotificationsModal } from './components/layout/NotificationsModal.js';
import { OnboardingModal } from './features/onboarding/OnboardingModal.js';
import { ToastProvider } from './components/ui/Toast.js';
import { Activity, Lock } from 'lucide-react';
import { useTradingStore } from './app/store/useTradingStore.js';

const AppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    fetchAllData,
    initSocketListeners,
    checkAuth,
    isAuthenticated,
    openAuthModal,
  } = useTradingStore();

  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    checkAuth();

    // Sync initial active tab with URL path
    const path = window.location.pathname;
    setCurrentPath(path);
    if (path.startsWith('/positions')) {
      setActiveTab('positions');
    } else if (path.startsWith('/orders')) {
      setActiveTab('orders');
    } else if (path.startsWith('/options') || path === '/' || path === '/explore') {
      setActiveTab('option-chain');
    }

    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p);
      if (p.startsWith('/positions')) {
        setActiveTab('positions');
      } else if (p.startsWith('/orders')) {
        setActiveTab('orders');
      } else if (p.startsWith('/options') || p === '/' || p === '/explore') {
        setActiveTab('option-chain');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [checkAuth, setActiveTab]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAllData();
    initSocketListeners();
  }, [isAuthenticated, fetchAllData, initSocketListeners]);

  const handleTabClick = (tab: 'option-chain' | 'positions' | 'orders') => {
    setActiveTab(tab);
    if (tab === 'positions') {
      window.history.pushState(null, '', '/positions');
      setCurrentPath('/positions');
    } else if (tab === 'orders') {
      window.history.pushState(null, '', '/orders');
      setCurrentPath('/orders');
    } else if (tab === 'option-chain') {
      if (!window.location.pathname.startsWith('/options/')) {
        window.history.pushState(null, '', '/explore');
        setCurrentPath('/explore');
      }
    }
  };

  const isAuthRoute =
    currentPath.startsWith('/login') ||
    currentPath.startsWith('/auth') ||
    currentPath.startsWith('/register');

  if (!isAuthenticated && isAuthRoute) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-[#00D09C] selection:text-black pb-20 sm:pb-0 overflow-x-hidden">
      {/* Header Navigation */}
      <Header />

      {/* Real-time Market Indices Ticker */}
      <MarketTicker />

      {/* Screen Tabs Header - Desktop & Tablet */}
      <div className="border-b border-slate-200 bg-white sticky top-14 sm:top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleTabClick('option-chain')}
              className={`py-3 sm:py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 cursor-pointer ${activeTab === 'option-chain'
                ? 'border-[#00D09C] text-slate-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
            >
              Explore
            </button>
            <button
              onClick={() => handleTabClick('positions')}
              className={`py-3 sm:py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 cursor-pointer ${activeTab === 'positions'
                ? 'border-[#00D09C] text-slate-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
            >
              Positions
            </button>
            <button
              onClick={() => handleTabClick('orders')}
              className={`py-3 sm:py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all shrink-0 cursor-pointer ${activeTab === 'orders'
                ? 'border-[#00D09C] text-slate-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
            >
              Orders
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activeTab === 'option-chain' && (
          <div className="space-y-4">
            <OptionChainTable />
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Active Portfolio & Positions
              </h1>
            </div>
            {isAuthenticated ? (
              <PositionsList />
            ) : (
              <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Trader Authentication Required</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Please sign in to view your live paper trading positions, mark-to-market P&L, and open contracts.
                </p>
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-5 py-2.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-extrabold text-xs shadow-sm cursor-pointer"
                >
                  Sign In / Register
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Order Book & Executions
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete transactional audit trail of your paper market and limit orders.
              </p>
            </div>
            {isAuthenticated ? (
              <OrderBookTable />
            ) : (
              <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Trader Authentication Required</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Sign in to inspect your order book, executions, and paper trading transaction history.
                </p>
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-5 py-2.5 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-extrabold text-xs shadow-sm cursor-pointer"
                >
                  Sign In / Register
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Global Modals */}
      <GrowwOrderModal />
      <WalletModal />
      <NotificationsModal />
      <AuthModal />
      <OnboardingModal />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Simple Minimal PREVO Branding Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-12 text-slate-500 font-sans">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3.5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Left: Brand + Free Platform Tag + Motivation */}
            <div className="flex items-center justify-between sm:justify-start gap-2.5 flex-wrap w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-xs">
                  <Activity className="w-3 h-3 text-black font-extrabold stroke-[2.5]" />
                </div>
                <span className="font-black text-slate-900 tracking-tight text-sm">
                  PRE<span className="text-[#008f6b]">VO</span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#008f6b] border border-emerald-200/80 font-extrabold text-[10px] uppercase tracking-wide">
                100% Free Platform
              </span>
              <span className="text-slate-300 hidden md:inline">•</span>
              <span className="text-slate-600 font-medium italic hidden md:inline">
                Practice without risk, trade with confidence.
              </span>
            </div>

          </div>

          {/* Minimal Legal Note */}
          <div className="text-[11px] text-slate-400 text-center sm:text-left leading-relaxed pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-center sm:text-left">
              Educational paper trading simulator with live market quotes. No real money or actual trades are executed.
            </p>
            <div className="text-[10.5px] text-slate-400 shrink-0">
              © {new Date().getFullYear()} PREVO • Free for all traders.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

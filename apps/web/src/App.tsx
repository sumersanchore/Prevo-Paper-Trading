import React, { useEffect } from 'react';
import { Header } from './components/layout/Header.js';
import { MarketTicker } from './components/layout/MarketTicker.js';
import { WalletModal } from './components/layout/WalletModal.js';
import { AuthModal } from './components/layout/AuthModal.js';
import { OptionChainTable } from './features/option-chain/OptionChainTable.js';
import { GrowwOrderModal } from './features/order-pad/GrowwOrderModal.js';
import { PositionsList } from './features/positions/PositionsList.js';
import { OrderBookTable } from './features/orders/OrderBookTable.js';
import { useTradingStore } from './app/store/useTradingStore.js';
import { Activity, Shield, Sparkles, Lock } from 'lucide-react';

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    fetchAllData,
    initSocketListeners,
    checkAuth,
    isAuthenticated,
    openAuthModal,
  } = useTradingStore();

  useEffect(() => {
    checkAuth();
    fetchAllData();
    initSocketListeners();
  }, [checkAuth, fetchAllData, initSocketListeners]);

  return (
    <div className="min-h-screen bg-[#0C0D14] text-[#E8EAED] flex flex-col selection:bg-[#00D09C] selection:text-black">
      {/* Header Navigation */}
      <Header />

      {/* Real-time Market Indices Ticker */}
      <MarketTicker />

      {/* Screen Tabs Header (Groww Style) */}
      <div className="border-b border-groww-border bg-[#0c0d14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('option-chain')}
              className={`py-4 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'option-chain'
                  ? 'border-[#00D09C] text-white'
                  : 'border-transparent text-groww-textMuted hover:text-white'
              }`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`py-4 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'positions'
                  ? 'border-[#00D09C] text-white'
                  : 'border-transparent text-groww-textMuted hover:text-white'
              }`}
            >
              Positions
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'orders'
                  ? 'border-[#00D09C] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              Orders
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'option-chain' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>NSE F&O Option Chain</span>
                  <span className="text-xs bg-[#00D09C]/10 text-[#00D09C] border border-[#00D09C]/20 px-2 py-0.5 rounded-full font-bold">
                    Live LTP / OI Feed
                  </span>
                </h1>
                <p className="text-xs text-groww-textSubtle mt-0.5">
                  Click any Call (CE) or Put (PE) strike to launch the Groww-style order pad and place simulated trades.
                </p>
              </div>
            </div>
            <OptionChainTable />
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Active Portfolio & Positions</h1>
              <p className="text-xs text-groww-textSubtle mt-0.5">
                Real-time mark-to-market unrealized P&L, contract metrics, and single-click square-off.
              </p>
            </div>
            {isAuthenticated ? (
              <PositionsList />
            ) : (
              <div className="py-16 text-center bg-groww-card border border-groww-border rounded-2xl p-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Trader Authentication Required</h3>
                <p className="text-xs text-groww-textSubtle max-w-md mx-auto mb-4">
                  Please sign in to view your live paper trading positions, mark-to-market P&L, and open contracts.
                </p>
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-5 py-2 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-extrabold text-xs"
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
              <h1 className="text-xl font-black text-white tracking-tight">Order Execution History</h1>
              <p className="text-xs text-groww-textSubtle mt-0.5">
                Complete transactional audit trail of your paper market and limit orders.
              </p>
            </div>
            {isAuthenticated ? (
              <OrderBookTable />
            ) : (
              <div className="py-16 text-center bg-groww-card border border-groww-border rounded-2xl p-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Trader Authentication Required</h3>
                <p className="text-xs text-groww-textSubtle max-w-md mx-auto mb-4">
                  Sign in to inspect your order book, executions, and paper trading transaction history.
                </p>
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-5 py-2 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-extrabold text-xs"
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
      <AuthModal />

      {/* Enterprise Footer */}
      <footer className="border-t border-groww-border bg-[#090a0f] py-6 mt-12 text-xs text-groww-textSubtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00D09C]" />
            <span className="font-bold text-white">TradeMitra</span>
            <span>• MNC Grade Paper Trading Engine (Equity & F&O)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#00D09C]" /> Concurrency & Row-level Locking
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" /> Author: Sumer Kumar
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

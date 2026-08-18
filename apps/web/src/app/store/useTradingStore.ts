import { create } from 'zustand';
import { api, getStoredToken } from '../../lib/api.js';
import { getSocket } from '../../lib/socket.js';
import type {
  LiveTickData,
  OptionChainStrikeItem,
  OptionOrderEntity,
  WalletEntity,
} from '@trademitra/shared';

export interface UserProfile {
  id: string;
  authId: string;
  email: string;
  fullName: string;
  phone?: string;
  panMasked?: string;
  kycStatus: string;
  createdAt: string;
}

export interface MarketIndexItem {
  symbol: string;
  name: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  pChange: number;
  timestamp: string;
}

export interface SelectedContract {
  contractId: string;
  tradingSymbol: string;
  symbol: string;
  strikePrice: number;
  optionType: 'CE' | 'PE';
  lotSize: number;
  ltp: number;
  defaultAction?: 'BUY' | 'SELL';
}

interface TradingStore {
  // Auth State
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';

  // Trading State
  activeTab: 'option-chain' | 'positions' | 'orders' | 'watchlist';
  wallet: WalletEntity | null;
  indices: MarketIndexItem[];
  optionChain: {
    symbol: string;
    spotPrice: number;
    change?: number;
    pChange?: number;
    expiries: string[];
    selectedExpiry: string;
    chain: OptionChainStrikeItem[];
  } | null;
  positionsSummary: {
    positions: any[];
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    netPnl: number;
    openPositionsCount: number;
    closedPositionsCount: number;
  } | null;
  orders: OptionOrderEntity[];
  isLoading: boolean;
  isOrderModalOpen: boolean;
  selectedContract: SelectedContract | null;
  isWalletModalOpen: boolean;

  // Actions
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  logout: () => void;

  setActiveTab: (tab: 'option-chain' | 'positions' | 'orders' | 'watchlist') => void;
  openOrderPad: (contract: SelectedContract) => void;
  closeOrderPad: () => void;
  setWalletModalOpen: (open: boolean) => void;
  fetchAllData: () => Promise<void>;
  fetchWallet: () => Promise<void>;
  resetWallet: () => Promise<void>;
  fetchOptionChain: (symbol?: string, expiry?: string) => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  placeOrder: (payload: any) => Promise<void>;
  exitPosition: (position: any) => Promise<void>;
  modifyOrder: (orderId: string, payload: { price?: number; triggerPrice?: number; quantity?: number }) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  cancelAllOrders: () => Promise<void>;
  initSocketListeners: () => void;
}

export const useTradingStore = create<TradingStore>((set, get) => ({
  // Auth initial state
  user: null,
  isAuthenticated: !!getStoredToken(),
  isAuthModalOpen: false,
  authModalMode: 'login',

  // Trading initial state
  activeTab: 'option-chain',
  wallet: null,
  indices: [
    { symbol: 'NIFTY 50', name: 'NIFTY 50', ltp: 24154.90, open: 24200, high: 24300, low: 24100, close: 24287.65, change: -132.75, pChange: -0.55, timestamp: new Date().toISOString() },
    { symbol: 'BANK NIFTY', name: 'BANK NIFTY', ltp: 57262.40, open: 57350, high: 57500, low: 57180, close: 57497.80, change: -235.40, pChange: -0.41, timestamp: new Date().toISOString() },
    { symbol: 'SENSEX', name: 'BSE SENSEX', ltp: 77235.46, open: 77500, high: 77800, low: 77100, close: 77728.16, change: -492.70, pChange: -0.63, timestamp: new Date().toISOString() },
  ],
  optionChain: null,
  positionsSummary: null,
  orders: [],
  isLoading: false,
  isOrderModalOpen: false,
  selectedContract: null,
  isWalletModalOpen: false,

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  checkAuth: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    try {
      const data = await api.getMe();
      set({
        user: data.user,
        wallet: data.wallet,
        isAuthenticated: true,
      });
    } catch {
      api.logout();
      set({ user: null, isAuthenticated: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const data = await api.login(email, password);
      set({
        user: data.user,
        isAuthenticated: true,
        isAuthModalOpen: false,
      });
      await get().fetchAllData();
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (payload) => {
    set({ isLoading: true });
    try {
      const data = await api.register(payload);
      set({
        user: data.user,
        isAuthenticated: true,
        isAuthModalOpen: false,
      });
      await get().fetchAllData();
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    api.logout();
    set({
      user: null,
      isAuthenticated: false,
      wallet: null,
      positionsSummary: null,
      orders: [],
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  openOrderPad: (contract) => {
    if (!get().isAuthenticated) {
      set({ isAuthModalOpen: true, authModalMode: 'login' });
      return;
    }
    set({
      selectedContract: contract,
      isOrderModalOpen: true,
    });
  },

  closeOrderPad: () => {
    set({
      selectedContract: null,
      isOrderModalOpen: false,
    });
  },

  setWalletModalOpen: (open) => {
    if (!get().isAuthenticated && open) {
      set({ isAuthModalOpen: true, authModalMode: 'login' });
      return;
    }
    set({ isWalletModalOpen: open });
  },

  fetchWallet: async () => {
    if (!get().isAuthenticated) return;
    try {
      const wallet = await api.getWallet();
      set({ wallet });
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  },

  resetWallet: async () => {
    if (!get().isAuthenticated) return;
    try {
      const wallet = await api.resetWallet();
      set({ wallet });
      await get().fetchPositions();
    } catch (err) {
      console.error('Failed to reset wallet:', err);
    }
  },

  fetchOptionChain: async (symbol = 'NIFTY', expiry?: string) => {
    try {
      const data = await api.getOptionChain(symbol, expiry);
      set({ optionChain: data });
    } catch (err) {
      console.error('Failed to fetch option chain:', err);
    }
  },

  fetchPositions: async () => {
    if (!get().isAuthenticated) return;
    try {
      const data = await api.getPositions();
      set({ positionsSummary: data });
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
  },

  fetchOrders: async () => {
    if (!get().isAuthenticated) return;
    try {
      const data = await api.getOrders();
      set({ orders: data });
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  },

  placeOrder: async (payload: any) => {
    if (!get().isAuthenticated) {
      set({ isAuthModalOpen: true, authModalMode: 'login' });
      return;
    }
    set({ isLoading: true });
    try {
      await api.placeOrder(payload);
      get().closeOrderPad();
      await Promise.all([get().fetchWallet(), get().fetchPositions(), get().fetchOrders()]);
    } finally {
      set({ isLoading: false });
    }
  },

  exitPosition: async (position: any) => {
    if (!get().isAuthenticated) {
      set({ isAuthModalOpen: true, authModalMode: 'login' });
      return;
    }
    set({ isLoading: true });
    try {
      // Direct MARKET exit order at current market LTP
      const exitAction = position.netQuantity > 0 ? 'SELL' : 'BUY';
      const exitQuantity = Math.abs(position.netQuantity);

      await api.placeOrder({
        contractId: position.contractId,
        orderType: 'MARKET',
        transactionType: exitAction,
        productType: position.productType,
        quantity: exitQuantity,
      });

      await Promise.all([get().fetchWallet(), get().fetchPositions(), get().fetchOrders()]);
    } catch (err: any) {
      console.error('Failed to exit position:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  modifyOrder: async (orderId: string, payload: { price?: number; triggerPrice?: number; quantity?: number }) => {
    if (!get().isAuthenticated) return;
    set({ isLoading: true });
    try {
      await api.modifyOrder(orderId, payload);
      await get().fetchOrders();
    } catch (err: any) {
      console.error('Failed to modify order:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  cancelOrder: async (orderId: string) => {
    if (!get().isAuthenticated) return;
    set({ isLoading: true });
    try {
      await api.cancelOrder(orderId);
      await Promise.all([get().fetchWallet(), get().fetchOrders()]);
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  cancelAllOrders: async () => {
    if (!get().isAuthenticated) return;
    set({ isLoading: true });
    try {
      await api.cancelAllOrders();
      await Promise.all([get().fetchWallet(), get().fetchOrders()]);
    } catch (err: any) {
      console.error('Failed to cancel all orders:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAllData: async () => {
    set({ isLoading: true });
    try {
      const promises: Promise<any>[] = [get().fetchOptionChain()];
      if (get().isAuthenticated) {
        promises.push(get().fetchWallet(), get().fetchPositions(), get().fetchOrders());
      }
      await Promise.all(promises);
    } finally {
      set({ isLoading: false });
    }
  },

  initSocketListeners: () => {
    const socket = getSocket();

    socket.on('indices:snapshot', (snapshot: MarketIndexItem[]) => {
      set({ indices: snapshot });
    });

    socket.on('index:tick', (tick: MarketIndexItem) => {
      set((state) => ({
        indices: state.indices.map((idx) => (idx.symbol === tick.symbol ? tick : idx)),
        optionChain:
          tick.symbol === 'NIFTY 50' && state.optionChain
            ? { ...state.optionChain, spotPrice: tick.ltp }
            : state.optionChain,
      }));
    });

    socket.on('tick:update', (tick: LiveTickData) => {
      set((state) => {
        if (!state.optionChain) return state;

        const updatedChain = state.optionChain.chain.map((item) => {
          const newItem = { ...item };
          if (newItem.ce && newItem.ce.tradingSymbol === tick.tradingSymbol) {
            newItem.ce = {
              ...newItem.ce,
              ltp: tick.ltp,
              change: tick.change,
              pChange: tick.pChange,
              oi: tick.oi,
              volume: tick.volume,
            };
          }
          if (newItem.pe && newItem.pe.tradingSymbol === tick.tradingSymbol) {
            newItem.pe = {
              ...newItem.pe,
              ltp: tick.ltp,
              change: tick.change,
              pChange: tick.pChange,
              oi: tick.oi,
              volume: tick.volume,
            };
          }
          return newItem;
        });

        let updatedSelected = state.selectedContract;
        if (state.selectedContract && state.selectedContract.tradingSymbol === tick.tradingSymbol) {
          updatedSelected = {
            ...state.selectedContract,
            ltp: tick.ltp,
          };
        }

        return {
          optionChain: {
            ...state.optionChain,
            chain: updatedChain,
          },
          selectedContract: updatedSelected,
        };
      });
    });
  },
}));

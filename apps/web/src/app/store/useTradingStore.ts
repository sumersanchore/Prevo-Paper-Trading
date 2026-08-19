import { create } from 'zustand';
import { api, getStoredToken, getStoredUser, getStoredTab, setStoredTab } from '../../lib/api.js';
import { getSocket } from '../../lib/socket.js';
import { triggerBrowserNotification } from '../../lib/notifications.js';
import type {
  LiveTickData,
  OptionChainStrikeItem,
  OptionOrderEntity,
  WalletEntity,
  WalletTransactionEntity,
  NotificationEntity,
} from '@trademitra/shared';

export type {
  LiveTickData,
  OptionChainStrikeItem,
  OptionOrderEntity,
  WalletEntity,
  WalletTransactionEntity,
  NotificationEntity,
};

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
  change?: number;
  changePercent?: number;
  pChange?: number;
  defaultAction?: 'BUY' | 'SELL';
  defaultOrderType?: 'MARKET' | 'LIMIT';
  defaultProductType?: 'NRML' | 'MIS';
  defaultLots?: number;
  defaultLimitPrice?: string;
  defaultTriggerPrice?: string;
  defaultTargetPrice?: string;
  isPositionProtectionMode?: boolean;
  positionNetQuantity?: number;
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
  transactions: WalletTransactionEntity[];
  notifications: NotificationEntity[];
  isNotificationsOpen: boolean;
  isOnboardingOpen: boolean;
  isLoading: boolean;
  isOrderModalOpen: boolean;
  selectedContract: SelectedContract | null;
  isWalletModalOpen: boolean;

  // Actions
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  setOnboardingOpen: (open: boolean) => void;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  loginWithGoogle: (payload: { email: string; fullName: string; googleId?: string; avatarUrl?: string }) => Promise<void>;
  sendEmailOtp: (payload: { email: string; fullName?: string; phone?: string }) => Promise<any>;
  verifyEmailOtp: (payload: { email: string; code: string; fullName?: string; phone?: string }) => Promise<any>;
  logout: () => void;

  setActiveTab: (tab: 'option-chain' | 'positions' | 'orders' | 'watchlist') => void;
  openOrderPad: (contract: SelectedContract) => void;
  closeOrderPad: () => void;
  setWalletModalOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  fetchAllData: () => Promise<void>;
  fetchWallet: () => Promise<void>;
  fetchWalletTransactions: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id?: string) => Promise<void>;
  broadcastNotification: (title: string, message: string, data?: any) => Promise<void>;
  resetWallet: () => Promise<void>;
  fetchOptionChain: (symbol?: string, expiry?: string) => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  placeOrder: (payload: any) => Promise<any>;
  exitPosition: (position: any) => Promise<void>;
  exitAllPositions: () => Promise<void>;
  modifyOrder: (
    orderId: string,
    payload: {
      price?: number;
      triggerPrice?: number;
      targetPrice?: number;
      trailingStopLoss?: number;
      quantity?: number;
    }
  ) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  cancelAllOrders: () => Promise<void>;
  initSocketListeners: () => void;
}

let syncTimeout: any = null;
const syncTradingStateDebounced = (get: any) => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (!get().isAuthenticated) return;
    try {
      await Promise.allSettled([
        get().fetchWallet(),
        get().fetchPositions(),
        get().fetchOrders(),
        get().fetchWalletTransactions(),
        get().fetchNotifications(),
      ]);
    } catch {}
  }, 200);
};

export const useTradingStore = create<TradingStore>((set, get) => ({
  // Auth initial state - instant zero-flicker cached user identity
  user: getStoredUser(),
  isAuthenticated: !!getStoredToken(),
  isAuthModalOpen: false,
  authModalMode: 'login',

  // Trading initial state - persistent active tab across page refreshes
  activeTab: getStoredTab(),
  wallet: null,
  indices: [
    { symbol: 'NIFTY 50', name: 'NIFTY 50', ltp: 24154.90, open: 24200, high: 24300, low: 24100, close: 24287.65, change: -132.75, pChange: -0.55, timestamp: new Date().toISOString() },
    { symbol: 'BANK NIFTY', name: 'BANK NIFTY', ltp: 57262.40, open: 57350, high: 57500, low: 57180, close: 57497.80, change: -235.40, pChange: -0.41, timestamp: new Date().toISOString() },
    { symbol: 'SENSEX', name: 'BSE SENSEX', ltp: 77235.46, open: 77500, high: 77800, low: 77100, close: 77728.16, change: -492.70, pChange: -0.63, timestamp: new Date().toISOString() },
  ],
  optionChain: null,
  positionsSummary: null,
  orders: [],
  transactions: [],
  notifications: [],
  isNotificationsOpen: false,
  isOnboardingOpen: false,
  isLoading: false,
  isOrderModalOpen: false,
  selectedContract: null,
  isWalletModalOpen: false,

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  setOnboardingOpen: (open: boolean) => set({ isOnboardingOpen: open }),
  setNotificationsOpen: (open: boolean) => set({ isNotificationsOpen: open }),

  checkAuth: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ user: null, isAuthenticated: false, wallet: null });
      return;
    }

    try {
      const data = await api.getMe();
      const activeUser = data.user;
      set({
        user: activeUser,
        wallet: data.wallet,
        isAuthenticated: true,
      });
      if (activeUser?.id) {
        getSocket().emit('subscribe:user', activeUser.id);
      }
    } catch (err: any) {
      api.logout();
      set({
        user: null,
        isAuthenticated: false,
        wallet: null,
      });
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
      if (data.user?.id) {
        getSocket().emit('subscribe:user', data.user.id);
      }
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
        isOnboardingOpen: true, // Show onboarding on new registration!
      });
      if (data.user?.id) {
        getSocket().emit('subscribe:user', data.user.id);
      }
      await get().fetchAllData();
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithGoogle: async (payload) => {
    set({ isLoading: true });
    try {
      const data = await api.loginWithGoogle(payload);
      const isFirstTime = !localStorage.getItem(`prevo_onboarded_${data.user?.id}`);
      set({
        user: data.user,
        isAuthenticated: true,
        isAuthModalOpen: false,
        isOnboardingOpen: isFirstTime, // Show onboarding if first time
      });
      if (data.user?.id) {
        getSocket().emit('subscribe:user', data.user.id);
      }
      await get().fetchAllData();
    } finally {
      set({ isLoading: false });
    }
  },

  sendEmailOtp: async (payload) => {
    set({ isLoading: true });
    try {
      return await api.sendEmailOtp(payload);
    } finally {
      set({ isLoading: false });
    }
  },

  verifyEmailOtp: async (payload) => {
    set({ isLoading: true });
    try {
      const data = await api.verifyEmailOtp(payload);
      const isFirstTime = !localStorage.getItem(`prevo_onboarded_${data.user?.id}`);
      set({
        user: data.user,
        isAuthenticated: true,
        isAuthModalOpen: false,
        isOnboardingOpen: isFirstTime,
      });
      if (data.user?.id) {
        getSocket().emit('subscribe:user', data.user.id);
      }
      await get().fetchAllData();
      return data;
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

  setActiveTab: (tab) => {
    setStoredTab(tab);
    set({ activeTab: tab });
  },

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
      await Promise.all([get().fetchPositions(), get().fetchWalletTransactions()]);
    } catch (err) {
      console.error('Failed to reset wallet:', err);
    }
  },

  fetchWalletTransactions: async () => {
    if (!get().isAuthenticated) return;
    try {
      const transactions = await api.getWalletTransactions();
      set({ transactions });
    } catch (err) {
      console.error('Failed to fetch wallet transactions:', err);
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
    if (!get().isAuthenticated && !get().user) {
      const defaultDevUser = {
        id: '1',
        authId: 'dev_user_1',
        email: 'sumer@prevo.com',
        fullName: 'Sumer Kumar',
        kycStatus: 'VERIFIED' as const,
        createdAt: new Date().toISOString(),
      };
      set({ user: defaultDevUser, isAuthenticated: true });
    }
    set({ isLoading: true });
    try {
      const res = await api.placeOrder(payload);
      syncTradingStateDebounced(get);
      return res;
    } catch (err: any) {
      syncTradingStateDebounced(get);
      // Propagate the clean API error message for the UI to display
      const apiMessage =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to place order. Please try again.';
      const apiError = new Error(apiMessage) as any;
      apiError.response = err?.response;
      throw apiError;
    } finally {
      set({ isLoading: false });
    }
  },

  exitPosition: async (position: any) => {
    if (!get().isAuthenticated && !get().user) {
      const defaultDevUser = {
        id: '1',
        authId: 'dev_user_1',
        email: 'sumer@prevo.com',
        fullName: 'Sumer Kumar',
        kycStatus: 'VERIFIED' as const,
        createdAt: new Date().toISOString(),
      };
      set({ user: defaultDevUser, isAuthenticated: true });
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

      syncTradingStateDebounced(get);
    } catch (err: any) {
      console.error('Failed to exit position:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  exitAllPositions: async () => {
    if (!get().isAuthenticated && !get().user) {
      const defaultDevUser = {
        id: '1',
        authId: 'dev_user_1',
        email: 'sumer@prevo.com',
        fullName: 'Sumer Kumar',
        kycStatus: 'VERIFIED' as const,
        createdAt: new Date().toISOString(),
      };
      set({ user: defaultDevUser, isAuthenticated: true });
    }
    const posSummary = get().positionsSummary;
    if (!posSummary || !posSummary.positions) return;

    const openPositions = posSummary.positions.filter(
      (p) => p.status === 'OPEN' && p.netQuantity !== 0
    );
    if (openPositions.length === 0) return;

    set({ isLoading: true });
    try {
      for (const pos of openPositions) {
        const exitAction = pos.netQuantity > 0 ? 'SELL' : 'BUY';
        const exitQuantity = Math.abs(pos.netQuantity);
        await api.placeOrder({
          contractId: pos.contractId,
          orderType: 'MARKET',
          transactionType: exitAction,
          productType: pos.productType,
          quantity: exitQuantity,
        });
      }
      syncTradingStateDebounced(get);
    } catch (err: any) {
      console.error('Failed to exit all positions:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  modifyOrder: async (
    orderId: string,
    payload: {
      price?: number;
      triggerPrice?: number;
      targetPrice?: number;
      trailingStopLoss?: number;
      quantity?: number;
    }
  ) => {
    if (!get().isAuthenticated) return;
    set({ isLoading: true });
    try {
      await api.modifyOrder(orderId, payload);
      syncTradingStateDebounced(get);
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
      syncTradingStateDebounced(get);
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
      syncTradingStateDebounced(get);
    } catch (err: any) {
      console.error('Failed to cancel all orders:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchNotifications: async () => {
    if (!get().isAuthenticated || !get().user) return;
    try {
      const data = await api.getNotifications();
      set({ notifications: data });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },

  markNotificationRead: async (id?: string) => {
    if (!get().isAuthenticated) return;
    try {
      await api.markNotificationsRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          id === undefined || n.id === id ? { ...n, isRead: true } : n
        ),
      }));
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  },

  broadcastNotification: async (title: string, message: string, data?: any) => {
    if (!get().isAuthenticated) return;
    try {
      await api.broadcastNotification(title, message, data);
      await get().fetchNotifications();
    } catch (err) {
      console.error('Failed to broadcast notification:', err);
    }
  },

  fetchAllData: async () => {
    if (!get().isAuthenticated || !get().user) return;
    set({ isLoading: true });
    try {
      await Promise.all([
        get().fetchOptionChain(),
        get().fetchWallet(),
        get().fetchPositions(),
        get().fetchOrders(),
        get().fetchWalletTransactions(),
        get().fetchNotifications(),
      ]);
    } finally {
      set({ isLoading: false });
    }
  },

  initSocketListeners: () => {
    const socket = getSocket();

    const currentUser = get().user;
    const initialUserId = currentUser?.id || '1';
    socket.emit('subscribe:user', initialUserId);

    socket.on('notification:new', (notif: NotificationEntity) => {
      const activeUser = get().user;
      const currentUserId = String(activeUser?.id || '1');

      // Strict user mapping: Accept if broadcast (userId is null) or if matches current user
      if (notif.userId && String(notif.userId) !== currentUserId && currentUserId !== '1') {
        return;
      }

      set((state) => ({
        notifications: [notif, ...state.notifications.filter((n) => n.id !== notif.id)],
      }));

      // Trigger native browser notification & pleasant audio chime
      triggerBrowserNotification({
        title: notif.title,
        message: notif.message,
        severity: notif.severity,
        onClick: () => {
          get().setActiveTab('orders');
          get().setNotificationsOpen(true);
        },
      });
    });

    socket.on('indices:snapshot', (snapshot: MarketIndexItem[]) => {
      set({ indices: snapshot });
    });

    socket.on('index:tick', (tick: MarketIndexItem) => {
      set((state) => {
        const updatedIndices = state.indices.map((idx) => (idx.symbol === tick.symbol ? tick : idx));
        
        let updatedOptionChain = state.optionChain;
        if (state.optionChain) {
          const currentChainSym = state.optionChain.symbol?.toUpperCase().replace(/\s+/g, '');
          const tickSym = tick.symbol?.toUpperCase().replace(/\s+/g, '');
          
          const isMatch =
            (currentChainSym === 'NIFTY' && (tickSym === 'NIFTY50' || tickSym === 'NIFTY')) ||
            (currentChainSym === 'BANKNIFTY' && (tickSym === 'BANKNIFTY' || tickSym === 'BANKNIFTY')) ||
            (currentChainSym === 'SENSEX' && tickSym === 'SENSEX') ||
            (currentChainSym === 'FINNIFTY' && (tickSym === 'FINNIFTY' || tickSym === 'FINNIFTY')) ||
            (currentChainSym === 'MIDCPNIFTY' && (tickSym === 'MIDCAPNIFTY' || tickSym === 'MIDCPNIFTY')) ||
            (currentChainSym === 'BANKEX' && tickSym === 'BANKEX') ||
            currentChainSym === tickSym;

          if (isMatch) {
            updatedOptionChain = {
              ...state.optionChain,
              spotPrice: tick.ltp,
              change: tick.change,
              pChange: tick.pChange,
            };
          }
        }

        return {
          indices: updatedIndices,
          optionChain: updatedOptionChain,
        };
      });
    });

    socket.on('ticks:batch', (batch: LiveTickData[]) => {
      set((state) => {
        if (!state.optionChain || batch.length === 0) return state;

        // Fast O(1) hash map lookup for batch updates
        const tickMap = new Map<string, LiveTickData>();
        for (const t of batch) {
          tickMap.set(t.tradingSymbol, t);
        }

        const updatedChain = state.optionChain.chain.map((item) => {
          const ceTick = item.ce ? tickMap.get(item.ce.tradingSymbol) : undefined;
          const peTick = item.pe ? tickMap.get(item.pe.tradingSymbol) : undefined;

          if (!ceTick && !peTick) return item;

          return {
            ...item,
            ce: ceTick
              ? {
                  ...item.ce!,
                  ltp: ceTick.ltp,
                  change: ceTick.change,
                  pChange: ceTick.pChange,
                  oi: ceTick.oi,
                  volume: ceTick.volume,
                }
              : item.ce,
            pe: peTick
              ? {
                  ...item.pe!,
                  ltp: peTick.ltp,
                  change: peTick.change,
                  pChange: peTick.pChange,
                  oi: peTick.oi,
                  volume: peTick.volume,
                }
              : item.pe,
          };
        });

        let updatedSelected = state.selectedContract;
        if (state.selectedContract) {
          const selTick = tickMap.get(state.selectedContract.tradingSymbol);
          if (selTick) {
            updatedSelected = {
              ...state.selectedContract,
              ltp: selTick.ltp,
            };
          }
        }

        // Also dynamically recalculate open positions MTM P&L in real-time
        let updatedPositionsSummary = state.positionsSummary;
        if (state.positionsSummary && state.positionsSummary.positions.length > 0) {
          let newTotalUnrealized = 0;
          let newTotalRealized = state.positionsSummary.totalRealizedPnl;

          const updatedPosList = state.positionsSummary.positions.map((pos) => {
            const posTick = tickMap.get(pos.tradingSymbol);
            const currentLtp = posTick ? posTick.ltp : pos.ltp;
            const netQty = pos.netQuantity;

            let unrealizedPnl = pos.unrealizedPnl ?? 0;
            if (pos.status === 'OPEN' && netQty !== 0) {
              if (netQty > 0) {
                unrealizedPnl = Number((netQty * (currentLtp - pos.averageBuyPrice)).toFixed(2));
              } else if (netQty < 0) {
                unrealizedPnl = Number((Math.abs(netQty) * (pos.averageSellPrice - currentLtp)).toFixed(2));
              }
            }

            const totalPnl = Number(((pos.realizedPnl || 0) + unrealizedPnl).toFixed(2));
            const investedValue = netQty > 0 ? netQty * pos.averageBuyPrice : 0;
            const pnlPercentage = investedValue > 0 ? Number(((totalPnl / investedValue) * 100).toFixed(2)) : 0;
            const currentValue = Number((Math.abs(netQty) * currentLtp).toFixed(2));

            newTotalUnrealized += unrealizedPnl;

            return {
              ...pos,
              ltp: currentLtp,
              unrealizedPnl,
              totalPnl,
              pnlPercentage,
              currentValue,
            };
          });

          updatedPositionsSummary = {
            ...state.positionsSummary,
            positions: updatedPosList,
            totalUnrealizedPnl: Number(newTotalUnrealized.toFixed(2)),
            netPnl: Number((newTotalRealized + newTotalUnrealized).toFixed(2)),
          };
        }

        // Also dynamically recalculate live LTP for open/executed orders
        let updatedOrders = state.orders;
        if (state.orders.length > 0) {
          updatedOrders = state.orders.map((ord) => {
            const ordTick = ord.tradingSymbol ? tickMap.get(ord.tradingSymbol) : undefined;
            if (ordTick) {
              return {
                ...ord,
                ltp: ordTick.ltp,
              };
            }
            return ord;
          });
        }

        return {
          optionChain: {
            ...state.optionChain,
            chain: updatedChain,
          },
          selectedContract: updatedSelected,
          positionsSummary: updatedPositionsSummary,
          orders: updatedOrders,
        };
      });
    });

    socket.on('tick:update', (tick: LiveTickData) => {
      set((state) => {
        let updatedChain = state.optionChain?.chain;
        if (state.optionChain) {
          updatedChain = state.optionChain.chain.map((item) => {
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
        }

        let updatedSelected = state.selectedContract;
        if (state.selectedContract && state.selectedContract.tradingSymbol === tick.tradingSymbol) {
          updatedSelected = {
            ...state.selectedContract,
            ltp: tick.ltp,
          };
        }

        let updatedOrders = state.orders;
        if (state.orders.length > 0 && state.orders.some((o) => o.tradingSymbol === tick.tradingSymbol)) {
          updatedOrders = state.orders.map((ord) => {
            if (ord.tradingSymbol === tick.tradingSymbol) {
              return {
                ...ord,
                ltp: tick.ltp,
              };
            }
            return ord;
          });
        }

        return {
          ...(state.optionChain && updatedChain ? {
            optionChain: {
              ...state.optionChain,
              chain: updatedChain,
            },
          } : {}),
          selectedContract: updatedSelected,
          orders: updatedOrders,
        };
      });
    });

    // Auto-refresh orders, positions, wallet, and transactions on execution events (debounced)
    socket.on('order:update', () => {
      if (get().isAuthenticated) {
        syncTradingStateDebounced(get);
      }
    });
  },
}));

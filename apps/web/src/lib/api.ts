import axios from 'axios';

const TOKEN_STORAGE_KEY = 'trademitra_jwt_token';
const USER_STORAGE_KEY = 'trademitra_user_profile';
const TAB_STORAGE_KEY = 'trademitra_active_tab';

export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage quota errors
  }
};

export const getStoredUser = (): any | null => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: any): void => {
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
};

export const clearStoredToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore
  }
};

export const getStoredTab = (): 'option-chain' | 'positions' | 'orders' | 'watchlist' => {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    if (stored === 'option-chain' || stored === 'positions' || stored === 'orders' || stored === 'watchlist') {
      return stored;
    }
  } catch {
    // Fallback
  }
  return 'option-chain';
};

export const setStoredTab = (tab: string): void => {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Ignore
  }
};

export const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject Bearer JWT if available in localStorage
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for automatic 401 token expiration handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear expired token
      clearStoredToken();
    }
    return Promise.reject(error);
  }
);

// ── In-Flight Request Deduplication Pool ──────────────────────────────
// Prevents duplicate concurrent HTTP requests across components
const inFlightRequests = new Map<string, Promise<any>>();

const deduplicateGet = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
};

export const clearApiCache = () => {
  inFlightRequests.clear();
};

export const api = {
  // Authentication
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    if (res.data?.data?.user) {
      setStoredUser(res.data.data.user);
    }
    clearApiCache();
    return res.data.data;
  },

  register: async (payload: { email: string; password: string; fullName: string; phone?: string }) => {
    const res = await apiClient.post('/auth/register', payload);
    if (res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    if (res.data?.data?.user) {
      setStoredUser(res.data.data.user);
    }
    clearApiCache();
    return res.data.data;
  },

  loginWithGoogle: async (payload: { email: string; fullName: string; googleId?: string; avatarUrl?: string }) => {
    const res = await apiClient.post('/auth/google', payload);
    if (res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    if (res.data?.data?.user) {
      setStoredUser(res.data.data.user);
    }
    clearApiCache();
    return res.data.data;
  },

  sendEmailOtp: async (payload: { email: string; fullName?: string; phone?: string }) => {
    const res = await apiClient.post('/auth/email-otp/send', payload);
    return res.data;
  },

  verifyEmailOtp: async (payload: { email: string; code: string; fullName?: string; phone?: string }) => {
    const res = await apiClient.post('/auth/email-otp/verify', payload);
    if (res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    if (res.data?.data?.user) {
      setStoredUser(res.data.data.user);
    }
    clearApiCache();
    return res.data.data;
  },

  getMe: async () => {
    return deduplicateGet('auth:me', async () => {
      const res = await apiClient.get('/auth/me');
      if (res.data?.data?.user) {
        setStoredUser(res.data.data.user);
      }
      return res.data.data;
    });
  },

  logout: () => {
    clearStoredToken();
    clearApiCache();
  },

  // Health & Market Data
  getHealth: async () => {
    const res = await apiClient.get('/health');
    return res.data;
  },

  // Wallet
  getWallet: async () => {
    return deduplicateGet('wallet:active', async () => {
      const res = await apiClient.get('/wallet');
      return res.data.data;
    });
  },

  resetWallet: async () => {
    clearApiCache();
    const res = await apiClient.post('/wallet/reset');
    return res.data.data;
  },

  getWalletTransactions: async () => {
    return deduplicateGet('wallet:transactions', async () => {
      const res = await apiClient.get('/wallet/transactions');
      return res.data.data as import('@trademitra/shared').WalletTransactionEntity[];
    });
  },

  // Option Chain
  getOptionChain: async (symbol = 'NIFTY', expiry?: string) => {
    const cacheKey = `option-chain:${symbol}:${expiry || 'current'}`;
    return deduplicateGet(cacheKey, async () => {
      const res = await apiClient.get('/contracts/option-chain', {
        params: { symbol, expiry },
      });
      return res.data.data;
    });
  },

  // Orders
  getOrders: async (status?: string) => {
    const cacheKey = `orders:${status || 'all'}`;
    return deduplicateGet(cacheKey, async () => {
      const res = await apiClient.get('/orders', {
        params: { status },
      });
      return res.data.data;
    });
  },

  placeOrder: async (payload: {
    contractId: string;
    orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    transactionType: 'BUY' | 'SELL';
    productType: 'NRML' | 'MIS';
    quantity: number;
    price?: number;
    triggerPrice?: number;
    targetPrice?: number;
    trailingStopLoss?: number;
  }) => {
    clearApiCache();
    const res = await apiClient.post('/orders', payload);
    return res.data.data;
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
    clearApiCache();
    const res = await apiClient.put(`/orders/${orderId}`, payload);
    return res.data.data;
  },

  cancelOrder: async (orderId: string) => {
    clearApiCache();
    const res = await apiClient.delete(`/orders/${orderId}`);
    return res.data.data;
  },

  cancelAllOrders: async () => {
    clearApiCache();
    const res = await apiClient.delete('/orders/cancel-all');
    return res.data.data;
  },

  // Positions
  getPositions: async () => {
    return deduplicateGet('positions:active', async () => {
      const res = await apiClient.get('/positions');
      return res.data.data;
    });
  },

  // Notifications
  getNotifications: async () => {
    return deduplicateGet('notifications:list', async () => {
      const res = await apiClient.get('/notifications');
      return res.data.data as import('@trademitra/shared').NotificationEntity[];
    });
  },

  markNotificationsRead: async (notificationId?: string) => {
    clearApiCache();
    const res = await apiClient.post('/notifications/mark-read', { notificationId });
    return res.data;
  },

  broadcastNotification: async (title: string, message: string, data?: any) => {
    clearApiCache();
    const res = await apiClient.post('/notifications/broadcast', { title, message, data });
    return res.data.data;
  },
};

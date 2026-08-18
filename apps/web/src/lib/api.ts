import axios from 'axios';

const TOKEN_STORAGE_KEY = 'trademitra_jwt_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
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

export const api = {
  // Authentication
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    return res.data.data;
  },

  register: async (payload: { email: string; password: string; fullName: string; phone?: string }) => {
    const res = await apiClient.post('/auth/register', payload);
    if (res.data?.data?.token) {
      setStoredToken(res.data.data.token);
    }
    return res.data.data;
  },

  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data.data;
  },

  logout: () => {
    clearStoredToken();
  },

  // Health & Market Data
  getHealth: async () => {
    const res = await apiClient.get('/health');
    return res.data;
  },

  // Wallet
  getWallet: async () => {
    const res = await apiClient.get('/wallet');
    return res.data.data;
  },

  resetWallet: async () => {
    const res = await apiClient.post('/wallet/reset');
    return res.data.data;
  },

  // Option Chain
  getOptionChain: async (symbol = 'NIFTY', expiry?: string) => {
    const res = await apiClient.get('/contracts/option-chain', {
      params: { symbol, expiry },
    });
    return res.data.data;
  },

  // Orders
  getOrders: async (status?: string) => {
    const res = await apiClient.get('/orders', {
      params: { status },
    });
    return res.data.data;
  },

  placeOrder: async (payload: {
    contractId: string;
    orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    transactionType: 'BUY' | 'SELL';
    productType: 'NRML' | 'MIS';
    quantity: number;
    price?: number;
    triggerPrice?: number;
  }) => {
    const res = await apiClient.post('/orders', payload);
    return res.data.data;
  },

  modifyOrder: async (orderId: string, payload: { price?: number; triggerPrice?: number; quantity?: number }) => {
    const res = await apiClient.put(`/orders/${orderId}`, payload);
    return res.data.data;
  },

  cancelOrder: async (orderId: string) => {
    const res = await apiClient.delete(`/orders/${orderId}`);
    return res.data.data;
  },

  cancelAllOrders: async () => {
    const res = await apiClient.delete('/orders/cancel-all');
    return res.data.data;
  },

  // Positions
  getPositions: async () => {
    const res = await apiClient.get('/positions');
    return res.data.data;
  },
};

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Only attempt WebSocket connection if a custom VITE_WS_URL is provided, or on local dev server
    const wsUrl = import.meta.env.VITE_WS_URL || (isLocal ? 'http://localhost:4000' : null);

    if (wsUrl) {
      socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
    } else {
      // Safe no-op dummy socket when running in serverless environment without a standalone WS server
      const noop = () => socket;
      socket = {
        emit: noop,
        on: noop,
        off: noop,
        connect: noop,
        disconnect: noop,
        connected: false,
      } as unknown as Socket;
    }
  }
  return socket;
};


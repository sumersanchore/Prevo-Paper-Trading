import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const wsUrl =
      import.meta.env.VITE_WS_URL ||
      (typeof window !== 'undefined' && import.meta.env.PROD
        ? window.location.origin
        : 'http://localhost:4000');

    socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

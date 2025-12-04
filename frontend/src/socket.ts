import { io, Socket } from 'socket.io-client';
import { refreshAccessToken } from './api/client';

let socket: Socket | null = null;

async function ensureToken() {
  let token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (!token) {
    token = await refreshAccessToken();
  }
  return token;
}

export async function createSocket() {
  const API_URL = import.meta.env.VITE_API_URL || 'https://csetem.onrender.com';
  const token = await ensureToken();

  // Try a very lightweight health ping to warm the server before websocket connect.
  // This can often avoid the cold-start failing scenario on serverless hosting.
  try {
    await fetch(API_URL + '/health', { method: 'GET', cache: 'no-cache' });
  } catch (e) {
    // ignore; we'll still try to connect and socket connect will handle retries
    console.debug('Health ping failed; proceeding to connect socket', e);
  }

  if (!socket) {
    socket = io(API_URL, {
      // Do not automatically connect until we've set token/auth in socket.auth
      autoConnect: false,
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      // Graceful reconnection settings (backoff)
      reconnectionAttempts: 6,
      reconnectionDelay: 2000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('🔵 WebSocket connected:', socket?.id);
    });
    socket.on('disconnect', (reason) => {
      console.warn('🔴 WebSocket disconnected:', reason);
    });
    socket.on('connect_error', async (err: any) => {
      // If JWT expired, try to refresh and reconnect
      const msg = String(err?.message || err);
      console.warn('WebSocket connect_error:', msg);
      if (msg.toLowerCase().includes('jwt')) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          socket!.auth = { token: newToken };
          console.log('🔄 Reconnecting socket with refreshed token');
          socket!.connect();
        } else {
          // redirect to login or handle as needed
          window.location.href = '/login';
        }
      }
    });
    // Connect after registering handlers and ensuring token/auth is set
    try {
      socket.connect();
    } catch (e) {
      console.warn('Socket connect() failed to start', e);
    }
  }
  return socket;
}

export function getSocket() {
  return socket;
}

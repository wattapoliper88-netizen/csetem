import { io, Socket } from 'socket.io-client';
import { refreshAccessToken } from './api/client';

let socket: Socket | null = null;

async function ensureToken() {
  let token = localStorage.getItem('accessToken');
  if (!token) {
    token = await refreshAccessToken();
  }
  return token;
}

export async function createSocket() {
  const token = await ensureToken();
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || 'https://csetem.onrender.com', {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect_error', async (err: any) => {
      // If JWT expired, try to refresh and reconnect
      const msg = String(err?.message || err);
      if (msg.toLowerCase().includes('jwt')) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          socket!.auth = { token: newToken };
          socket!.connect();
        } else {
          // redirect to login or handle as needed
          window.location.href = '/login';
        }
      }
    });
  }
  return socket;
}

export function getSocket() {
  return socket;
}

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(accessToken: string) {
  if (!socket) {
    // Allow the client to fall back to polling if the websocket upgrade
    // is blocked by a proxy. Previously we forced `websocket` only
    // which fails early when upgrades are not allowed.
    socket = io(import.meta.env.VITE_API_URL || 'https://csetem.onrender.com', {
      auth: { token: accessToken },
      withCredentials: true,
    });
  }
  return socket;
}

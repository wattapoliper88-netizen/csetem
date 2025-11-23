import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(accessToken: string) {
  if (!socket) {
    // Diagnostic: force websocket-only transport temporarily to avoid polling/OPTIONS path
    // Remove this override after diagnosing proxy issues
    socket = io(import.meta.env.VITE_API_URL || 'https://csetem.onrender.com', {
      auth: { token: accessToken },
      transports: ['websocket'],
      withCredentials: true,
    });
  }
  return socket;
}

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(accessToken: string) {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || 'https://csetem.onrender.com', {
      auth: { token: accessToken },
    });
  }
  return socket;
}

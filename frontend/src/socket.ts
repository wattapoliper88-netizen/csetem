import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(accessToken: string) {
  if (!socket) {
    socket = io('http://localhost:3000', {
      auth: { token: accessToken },
    });
  }
  return socket;
}

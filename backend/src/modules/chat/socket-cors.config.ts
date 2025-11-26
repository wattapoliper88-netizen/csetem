import { Logger } from '@nestjs/common';

// Dynamically export Socket.IO CORS origins from environment
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://csetem.vercel.app',
      'https://csetem-frontend.onrender.com',
    ];

const _logger = new Logger('SocketCorsConfig');
_logger.log('✅ Socket.IO CORS origins:' + JSON.stringify(origins));

export const socketCorsConfig = {
  origin: origins,
  credentials: true,
};

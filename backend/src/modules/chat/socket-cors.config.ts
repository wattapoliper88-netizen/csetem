// Dynamically export Socket.IO CORS origins from environment
const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://csetem.vercel.app',
      'https://csetem-frontend.onrender.com',
    ];

console.log('✅ [socket-cors.config.ts] Socket.IO CORS origins:', origins);

export const socketCorsConfig = {
  origin: origins,
  credentials: true,
};

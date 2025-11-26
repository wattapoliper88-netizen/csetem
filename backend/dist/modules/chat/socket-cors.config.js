"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketCorsConfig = void 0;
const common_1 = require("@nestjs/common");
const origins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://csetem.vercel.app',
        'https://csetem-frontend.onrender.com',
    ];
const _logger = new common_1.Logger('SocketCorsConfig');
_logger.log('✅ Socket.IO CORS origins:' + JSON.stringify(origins));
exports.socketCorsConfig = {
    origin: origins,
    credentials: true,
};
//# sourceMappingURL=socket-cors.config.js.map
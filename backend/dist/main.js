"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const config_1 = require("@nestjs/config");
const cookieParser = require("cookie-parser");
const common_1 = require("@nestjs/common");
const express = require("express");
const path_1 = require("path");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);
    const configService = app.get(config_1.ConfigService);
    app.use(cookieParser());
    console.log('🔍 CORS_ORIGIN from ConfigService:', configService.get('CORS_ORIGIN'));
    console.log('🔍 CORS_ORIGIN from process.env:', process.env.CORS_ORIGIN);
    console.log('🔍 All env keys:', Object.keys(process.env).filter(k => k.includes('CORS')));
    const corsOriginValue = configService.get('CORS_ORIGIN') || process.env.CORS_ORIGIN;
    const defaultOrigins = [
        'https://csetem.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ];
    const corsOrigins = corsOriginValue
        ? corsOriginValue.split(',').map((o) => o.trim())
        : defaultOrigins;
    console.log('✅ Final CORS origins:', corsOrigins);
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin && corsOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Vary', 'Origin');
        }
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });
    app.use(express.json({ limit: '3gb' }));
    app.use(express.urlencoded({ limit: '3gb', extended: true }));
    app.use('/uploads', express.static((0, path_1.join)(__dirname, '..', 'uploads')));
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || corsOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Content-Type', 'Authorization'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    await app.listen(process.env.PORT || 3000);
}
bootstrap();
//# sourceMappingURL=main.js.map
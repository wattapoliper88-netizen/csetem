import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Debug: print CORS_ORIGIN value
  console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);
  const configService = app.get(ConfigService);
  
  app.use(cookieParser());
  
  console.log('🔍 CORS_ORIGIN from ConfigService:', configService.get('CORS_ORIGIN'));
  console.log('🔍 CORS_ORIGIN from process.env:', process.env.CORS_ORIGIN);
  console.log('🔍 All env keys:', Object.keys(process.env).filter(k => k.includes('CORS')));
  
  const corsOriginValue =
    configService.get<string>('CORS_ORIGIN') || process.env.CORS_ORIGIN;

  // Alap engedélyezett origin lista (prod + fejlesztés)
  const defaultOrigins = [
    'https://csetem.vercel.app',
    'https://richat.de',
    'https://www.richat.de',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  // Merge env CORS_ORIGIN with defaultOrigins
  const envOrigins = corsOriginValue
    ? corsOriginValue.split(',').map((o) => o.trim())
    : [];
    
  const corsOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

  console.log('✅ Final CORS origins:', corsOrigins);

  // Globális CORS header beállítás (nem csak OPTIONS)
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
  
  // Increase payload size limit for file uploads (3GB)
  app.use(express.json({ limit: '3gb' }));
  app.use(express.urlencoded({ limit: '3gb', extended: true }));
  
  // Serve uploaded files statically
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
    exposedHeaders: ['Content-Type','Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT || 3000);

  // Optional: Apply bucket CORS on startup if requested via env var
  if (process.env.APPLY_BUCKET_CORS_ON_STARTUP === 'true') {
    try {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'web-chat-data.appspot.com';
      console.log('APPLY_BUCKET_CORS_ON_STARTUP: attempting to apply CORS to', bucketName);
      let storage: Storage;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        storage = new Storage({ projectId: creds.project_id, credentials: creds });
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        if (fs.existsSync(keyPath)) {
          storage = new Storage({ keyFilename: keyPath });
        } else {
          throw new Error('Service account file not found: ' + keyPath);
        }
      } else {
        storage = new Storage();
      }

      const bucket = storage.bucket(bucketName);
      const cors = [
        {
          origin: (process.env.CORS_ORIGIN || 'https://csetem.vercel.app').split(',').map(s => s.trim()),
          method: ['GET', 'HEAD', 'PUT', 'POST', 'OPTIONS'],
          responseHeader: ['Content-Type', 'Content-Length', 'X-Goog-*', 'Authorization', 'X-Requested-With', 'Accept'],
          maxAgeSeconds: 3600,
        },
      ];
      const [metadata] = await bucket.setMetadata({ cors });
      console.log('Successfully applied CORS to bucket', bucketName, 'metadata.cors=', metadata.cors || metadata.corsConfig || 'none');
    } catch (e) {
      console.error('Failed to apply bucket CORS on startup:', e);
    }
  }
}
bootstrap();

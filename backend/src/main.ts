import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';

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

  // Produkciós default: csak a Vercel domain
  const defaultOrigins = [
    'https://csetem.vercel.app',
  ];

  const corsOrigins = corsOriginValue
    ? corsOriginValue.split(',').map((o) => o.trim())
    : defaultOrigins;

  console.log('✅ Final CORS origins:', corsOrigins);

  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      if (origin && corsOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type, Authorization',
      );
      res.header('Access-Control-Allow-Credentials', 'true');
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
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT || 3000);
}
bootstrap();

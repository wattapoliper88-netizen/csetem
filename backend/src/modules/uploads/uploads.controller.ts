import { Body, Controller, Post, HttpException, HttpStatus, Logger, Get, Query } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('debug')
  getDebugInfo() {
    // Ensure admin is initialized
    this.uploadsService.initAdmin();
    const apps = (admin as any).apps;
    return {
      firebaseInitialized: apps && apps.length > 0,
      appCount: apps ? apps.length : 0,
      bucketName: process.env.FIREBASE_STORAGE_BUCKET || 'web-chat-data.appspot.com (fallback)',
      hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      hasServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    };
  }

  @Post('signed-url')
  async getSignedUploadUrl(@Body() body: { path: string; contentType?: string }) {
    return this.uploadsService.getSignedUploadUrl(body.path, body.contentType);
  }

  @Get('debug-storage')
  async getStorageDebug(@Query('prefix') prefix?: string) {
    try {
      this.uploadsService.initAdmin();
      const fallbackBucket = 'web-chat-data.appspot.com';
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
      const bucket = admin.storage().bucket(bucketName);
      const [metadata] = await bucket.getMetadata();
      
      if (prefix) {
        if (process.env.DEBUG_STORAGE_LIST !== '1' && process.env.NODE_ENV !== 'development') {
          return { ok: false, error: 'Listing by prefix is disabled. Enable DEBUG_STORAGE_LIST=1 or run in development.' };
        }
        const [files] = await bucket.getFiles({ prefix });
        const names = (files || []).map(f => f.name).slice(0, 500);
        return { ok: true, bucketName, metadata, prefix, count: names.length, files: names };
      }
      return { ok: true, bucketName, metadata };
    } catch (e: any) {
      Logger.error('Storage debug failed', e);
      return { ok: false, error: e?.message || String(e) };
    }
  }

  @Post('read-url')
  async getReadUrl(@Body() body: { path?: string; url?: string }) {
    let path = body.path;
    if (!path && body.url) {
      path = body.url; // Service handles URL parsing if it starts with http
    }
    if (!path) {
      throw new HttpException({ error: 'Missing path or url' }, HttpStatus.BAD_REQUEST);
    }
    return this.uploadsService.getReadUrl(path);
  }

  @Post('read-urls')
  async getReadUrls(@Body() body: { paths: string[] }) {
    if (!body.paths || !Array.isArray(body.paths)) {
      throw new HttpException({ error: 'Missing paths array' }, HttpStatus.BAD_REQUEST);
    }
    return this.uploadsService.getReadUrls(body.paths);
  }
}

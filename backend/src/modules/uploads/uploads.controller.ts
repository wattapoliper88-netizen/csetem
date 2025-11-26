import { Body, Controller, Post, HttpException, HttpStatus, Logger, Get } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Ensure firebase-admin is initialized (safe to call multiple times)
function initAdmin() {
  if ((admin as any).apps && (admin as any).apps.length > 0) return;
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(parsed), storageBucket: bucket });
      return;
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      if (fs.existsSync(path)) {
        const content = fs.readFileSync(path, 'utf8');
        const parsed = JSON.parse(content);
        admin.initializeApp({ credential: admin.credential.cert(parsed), storageBucket: bucket });
        return;
      }
    }

    // Fallback to application default credentials
    admin.initializeApp({ credential: admin.credential.applicationDefault(), storageBucket: bucket });
  } catch (e) {
    // Log initialization error for easier debugging in production
    Logger.error('firebase-admin initialization failed', e as any);
    // rethrow so callers can handle and return 500
    throw e;
  }
}

@Controller('uploads')
export class UploadsController {
  constructor() {
    try {
      initAdmin();
    } catch (e) {
      // initialization error is logged inside initAdmin; continue so handler returns 500 with details
    }
  }

  @Get('debug')
  getDebugInfo() {
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
    Logger.log('signed-url request received', { path: body.path, contentType: body.contentType });
    try {
      Logger.log('Calling initAdmin...');
      initAdmin();
      Logger.log('initAdmin completed successfully');

      // Check if Firebase is properly initialized
      const apps = (admin as any).apps;
      Logger.log('Firebase apps initialized:', apps ? apps.length : 'none');
      if (!apps || apps.length === 0) {
        throw new Error('Firebase not initialized');
      }

      // Allow a fallback bucket so the app keeps working even if env var missing.
      const fallbackBucket = 'web-chat-data.appspot.com';
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
      Logger.log('Using bucket name:', bucketName);

      const destination = body.path;
      if (!destination) throw new HttpException('Missing path', HttpStatus.BAD_REQUEST);

      Logger.log('Creating bucket and file reference...');
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(destination);

      const options: any = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      };
      if (body.contentType) options.contentType = body.contentType;

      Logger.log('Generating signed upload URL...');
      const [uploadUrl] = await file.getSignedUrl(options as any);
      Logger.log('Upload URL generated successfully');

      // Try to generate a short-lived read signed URL so frontend can use it without public bucket rules.
      let readUrl: string | null = null;
      try {
        Logger.log('Generating read signed URL...');
        const expires = Date.now() + 60 * 60 * 1000; // 1 hour
        const [r] = await file.getSignedUrl({ action: 'read', expires });
        readUrl = r;
        Logger.log('Read URL generated successfully');
      } catch (e) {
        Logger.log('Read URL generation failed, using fallback', e);
        readUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media`;
      }

      Logger.log('Returning signed URLs');
      return { uploadUrl, path: destination, readUrl };
    } catch (e: any) {
      Logger.error('Error while generating signed upload URL', e);
      throw new HttpException({ error: 'Failed to generate signed upload URL', detail: e?.message || String(e) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('debug-storage')
  async getStorageDebug() {
    try {
      Logger.log('Running storage debug: calling initAdmin');
      initAdmin();

      const fallbackBucket = 'web-chat-data.appspot.com';
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
      Logger.log('Storage debug using bucket:', bucketName);

      const bucket = admin.storage().bucket(bucketName);
      Logger.log('Requesting bucket metadata...');
      const [metadata] = await bucket.getMetadata();
      Logger.log('Bucket metadata received');
      return { ok: true, bucketName, metadata };
    } catch (e: any) {
      Logger.error('Storage debug failed', e);
      return { ok: false, error: e?.message || String(e) };
    }
  }

  @Post('read-url')
  async getReadUrl(@Body() body: { path?: string; url?: string }) {
    try {
      Logger.log('read-url request received', body);
      initAdmin();
      const fallbackBucket = 'web-chat-data.appspot.com';
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;

      let path = body.path;
      if (!path && body.url) {
        try {
          const parsed = new URL(body.url);
          Logger.log('Parsing URL to path:', parsed.pathname);
          if (parsed.hostname.includes('firebasestorage.googleapis.com')) {
            const matches = parsed.pathname.match(/\/o\/(.+)/);
            if (matches && matches[1]) path = decodeURIComponent(matches[1]);
          } else if (parsed.hostname.includes('storage.googleapis.com')) {
            // Path after first segment which is bucket
            const splits = parsed.pathname.split('/').filter(Boolean);
            if (splits.length >= 2) {
              // [bucket, rest...]
              path = splits.slice(1).join('/');
            }
          } else if (parsed.hostname === 'csetem.onrender.com' || parsed.hostname.includes('localhost') || parsed.hostname.includes('127.0.0.1')) {
            // Backend URL, extract path after domain
            path = parsed.pathname.slice(1);
          }
        } catch (e) {
          Logger.warn('Failed to parse provided url into path', e as any);
        }
      }

      if (!path) {
        Logger.warn('Missing path or url for read-url', body);
        throw new HttpException({ error: 'Missing path or url' }, HttpStatus.BAD_REQUEST);
      }

      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(path);
      // Check if the file actually exists and return 404 if not
      const [exists] = await file.exists();
      if (!exists) {
        Logger.warn('Requested file does not exist for path', path);
        throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
      }
      const expires = Date.now() + 60 * 60 * 1000;
      // Generate signed URL for reading
      const [readUrl] = await file.getSignedUrl({ action: 'read', expires });
      Logger.log('Read URL generated successfully for path', path);
      return { readUrl };
    } catch (e: any) {
      // Log the raw input and slot error details for diagnostics
      Logger.error('Error while generating read URL', JSON.stringify(body));
      if (e && e.stack) Logger.error(e.stack);
      const detail = e?.message || String(e);
      throw new HttpException({ error: 'Failed to generate read URL', detail }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

import { Body, Controller, Post, HttpException, HttpStatus, Logger } from '@nestjs/common';
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

  @Post('signed-url')
  async getSignedUploadUrl(@Body() body: { path: string; contentType?: string }) {
    try {
      initAdmin();

      // Allow a fallback bucket so the app keeps working even if env var missing.
      const fallbackBucket = 'web-chat-data.appspot.com';
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;

      const destination = body.path;
      if (!destination) throw new HttpException('Missing path', HttpStatus.BAD_REQUEST);

      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(destination);

      const options: any = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      };
      if (body.contentType) options.contentType = body.contentType;

      const [uploadUrl] = await file.getSignedUrl(options as any);

      // Try to generate a short-lived read signed URL so frontend can use it without public bucket rules.
      let readUrl: string | null = null;
      try {
        const expires = Date.now() + 60 * 60 * 1000; // 1 hour
        const [r] = await file.getSignedUrl({ action: 'read', expires });
        readUrl = r;
      } catch (e) {
        readUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media`;
      }

      return { uploadUrl, path: destination, readUrl };
    } catch (e: any) {
      Logger.error('Error while generating signed upload URL', e);
      throw new HttpException({ error: 'Failed to generate signed upload URL', detail: e?.message || String(e) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

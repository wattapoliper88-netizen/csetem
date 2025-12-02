import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor() {
    try {
      this.initAdmin();
    } catch (e) {
      // initialization error is logged inside initAdmin
    }
  }

  // Ensure firebase-admin is initialized (safe to call multiple times)
  initAdmin() {
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

  async getSignedUploadUrl(path: string, contentType?: string) {
    this.logger.log('signed-url request received', { path, contentType });
    try {
      this.initAdmin();

      // Check if Firebase is properly initialized
      const apps = (admin as any).apps;
      if (!apps || apps.length === 0) {
        throw new Error('Firebase not initialized');
      }

      // Allow a fallback bucket so the app keeps working even if env var missing.
      const fallbackBucket = 'web-chat-data.appspot.com';
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;

      const destination = path;
      if (!destination) throw new HttpException('Missing path', HttpStatus.BAD_REQUEST);

      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(destination);

      const options: any = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      };
      if (contentType) options.contentType = contentType;

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
      this.logger.error('Error while generating signed upload URL', e);
      throw new HttpException({ error: 'Failed to generate signed upload URL', detail: e?.message || String(e) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getReadUrl(pathOrUrl: string) {
    try {
      this.initAdmin();
      const fallbackBucket = 'web-chat-data.appspot.com';
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;

      let path = pathOrUrl;
      // If it looks like a URL, try to parse it
      if (path.startsWith('http')) {
        try {
          const parsed = new URL(path);
          if (parsed.hostname.includes('firebasestorage.googleapis.com')) {
            const matches = parsed.pathname.match(/\/o\/(.+)/);
            if (matches && matches[1]) path = decodeURIComponent(matches[1]);
          } else if (parsed.hostname.includes('storage.googleapis.com')) {
            const splits = parsed.pathname.split('/').filter(Boolean);
            if (splits.length >= 2) {
              path = splits.slice(1).join('/');
            }
          } else {
            // Assume backend URL or other
            path = parsed.pathname.slice(1);
            path = decodeURIComponent(path);
          }
        } catch (e) {
          // ignore
        }
      }

      if (!path) {
        throw new HttpException({ error: 'Missing path or url' }, HttpStatus.BAD_REQUEST);
      }

      const bucket = admin.storage().bucket(bucketName);
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

      // If path points to local server uploads (served by express), return direct URL instead of querying storage
      if (normalizedPath.startsWith('uploads/')) {
        const serverUrl = process.env.API_URL || process.env.APP_URL || `https://${process.env.RENDER_EXTERNAL_URL || 'csetem.onrender.com'}`;
        const readUrlLocal = `${serverUrl}/${normalizedPath}`;
        return { readUrl: readUrlLocal };
      }

      const file = bucket.file(normalizedPath);
      // Check if the file actually exists and return 404 if not
      const [exists] = await file.exists();
      if (!exists) {
        // Return null or throw? For internal use, maybe return null.
        // But for the controller, we want to throw 404.
        // Let's throw 404 here and handle it if needed.
        throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
      }
      const expires = Date.now() + 60 * 60 * 1000; // 1 hour
      // Generate signed URL for reading
      const [readUrl] = await file.getSignedUrl({ action: 'read', expires });
      return { readUrl };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      this.logger.error('Error while generating read URL', e);
      const detail = e?.message || String(e);
      throw new HttpException({ error: 'Failed to generate read URL', detail }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  // Helper for internal use that doesn't throw 404 but returns null if not found or error
  async getSignedUrlForPath(path: string): Promise<string | null> {
    try {
      const result = await this.getReadUrl(path);
      return result.readUrl;
    } catch (e) {
      return null;
    }
  }

  async getReadUrls(paths: string[]) {
    this.initAdmin();
    const results: Record<string, string | null> = {};
    
    // Process in parallel but with a limit if needed. 
    // For now, Promise.all is fine for reasonable batch sizes (e.g. < 50).
    // If paths is very large, we might want to chunk it.
    const uniquePaths = [...new Set(paths)];
    
    await Promise.all(uniquePaths.map(async (path) => {
      try {
        // We use getReadUrl but catch errors so one failure doesn't fail the whole batch
        const result = await this.getReadUrl(path);
        results[path] = result.readUrl;
      } catch (e) {
        // If not found or error, return null for this path
        results[path] = null;
      }
    }));
    
    return results;
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import * as admin from 'firebase-admin';

// Ensure firebase-admin is initialized (safe to call multiple times)
function initAdmin() {
  if ((admin as any).apps && (admin as any).apps.length > 0) return;
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: bucket,
    });
  } catch (e) {
    // ignore if already initialized
  }
}

@Controller('uploads')
export class UploadsController {
  constructor() {
    initAdmin();
  }

  @Post('signed-url')
  async getSignedUploadUrl(@Body() body: { path: string; contentType?: string }) {
    // Allow a fallback bucket so the app keeps working even if env var missing.
    const fallbackBucket = 'web-chat-data.appspot.com';
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;

    const destination = body.path;
    if (!destination) return { error: 'Missing path' };

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
      // If signed read URL generation fails, fallback to public media URL (may require bucket rules)
      readUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media`;
    }

    return { uploadUrl, path: destination, readUrl };
  }
}

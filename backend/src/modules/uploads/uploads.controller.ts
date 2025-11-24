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
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return { error: 'FIREBASE_STORAGE_BUCKET not configured on server' };
    }

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

    const [url] = await file.getSignedUrl(options as any);

    // Public read URL (not signed) can be constructed but we return signed upload URL only
    return { uploadUrl: url, path: destination };
  }
}

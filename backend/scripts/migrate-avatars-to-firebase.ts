import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function initFirebase() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!bucketName) {
    throw new Error('FIREBASE_STORAGE_BUCKET env var is required');
  }

  let credential: admin.ServiceAccount | undefined;

  if (serviceAccountJson) {
    try {
      credential = JSON.parse(serviceAccountJson);
    } catch (err) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON');
    }
  } else if (serviceAccountPath) {
    const abs = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(process.cwd(), serviceAccountPath);
    if (!fs.existsSync(abs)) throw new Error('Service account file not found at ' + abs);
    credential = JSON.parse(fs.readFileSync(abs, 'utf-8')) as admin.ServiceAccount;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Let the SDK pick up the default credential
    admin.initializeApp({ storageBucket: bucketName });
    return admin.storage().bucket();
  } else {
    throw new Error('Provide FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH or set GOOGLE_APPLICATION_CREDENTIALS');
  }

  admin.initializeApp({
    credential: admin.credential.cert(credential as admin.ServiceAccount),
    storageBucket: bucketName,
  });

  return admin.storage().bucket();
}

function parseDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function extFromMime(mime?: string) {
  if (!mime) return '.png';
  if (mime.includes('jpeg')) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  return '.png';
}

async function migrate() {
  console.log('Initializing Firebase...');
  const bucket = await initFirebase();

  console.log('Connecting to database...');

  const users = await prisma.user.findMany({
    where: { avatarImage: { not: null } },
    select: { id: true, avatarImage: true },
  });

  console.log(`Found ${users.length} users with avatarImage set`);

  let migrated = 0;
  for (const u of users) {
    const avatar = u.avatarImage;
    if (!avatar) continue;

    // Skip if already an URL
    if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('gs://')) {
      console.log(`Skipping user ${u.id}: already URL`);
      continue;
    }

    // Try parsing data URL
    const parsed = parseDataUrl(avatar);
    let buffer: Buffer | null = null;
    let mime: string | undefined;

    if (parsed) {
      mime = parsed.mime;
      buffer = Buffer.from(parsed.base64, 'base64');
    } else {
      // Maybe raw base64 without data: prefix
      const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(avatar);
      if (isBase64) {
        buffer = Buffer.from(avatar.replace(/\s+/g, ''), 'base64');
      } else {
        console.log(`Skipping user ${u.id}: avatar not base64 or data URL`);
        continue;
      }
    }

    try {
      const extension = extFromMime(mime);
      const destination = `avatars/${u.id}/${Date.now()}${extension}`;
      const file = bucket.file(destination);

      console.log(`Uploading avatar for user ${u.id} -> ${destination}`);

      await file.save(buffer as Buffer, { contentType: mime || 'image/png', resumable: false });

      // Generate signed URL (10 years)
      const expires = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
      const [url] = await file.getSignedUrl({ action: 'read', expires });

      await prisma.user.update({ where: { id: u.id }, data: { avatarImage: url } });
      migrated++;
      console.log(`Updated user ${u.id} avatar -> ${url}`);
    } catch (err) {
      console.error(`Failed to migrate avatar for user ${u.id}:`, err);
    }
  }

  console.log(`Migration complete. Migrated ${migrated} avatars.`);
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

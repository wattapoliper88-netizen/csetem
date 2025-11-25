#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

async function main() {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'web-chat-data.appspot.com';
    const originsEnv = process.env.CORS_ORIGINS || 'https://csetem.vercel.app,http://localhost:5173,http://127.0.0.1:5173';
    const origins = originsEnv.split(',').map(s => s.trim()).filter(Boolean);

    // Determine credentials
    let storage;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      console.log('Using FIREBASE_SERVICE_ACCOUNT_JSON from env');
      const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      storage = new Storage({ projectId: creds.project_id, credentials: creds });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      console.log('Using service account file at', p);
      if (!fs.existsSync(p)) {
        throw new Error('Service account file not found at ' + p);
      }
      storage = new Storage({ keyFilename: p });
    } else {
      console.log('No service account env set, using application default credentials');
      storage = new Storage();
    }

    const bucket = storage.bucket(bucketName);

    const cors = [
      {
        origin: origins,
        method: ['GET', 'HEAD', 'PUT', 'POST', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Content-Length', 'X-Goog-*', 'Authorization', 'X-Requested-With', 'Accept'],
        maxAgeSeconds: 3600,
      },
    ];

    console.log('Applying CORS to bucket', bucketName);
    const [metadata] = await bucket.setMetadata({ cors });
    console.log('CORS applied. Bucket metadata cors:', metadata.cors || metadata.corsConfig || 'none');
    console.log('Done.');
  } catch (e) {
    console.error('Failed to set CORS:', e && e.message ? e.message : e);
    process.exitCode = 1;
  }
}

main();

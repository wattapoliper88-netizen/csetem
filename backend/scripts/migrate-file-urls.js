#!/usr/bin/env node
/*
  Migration script to normalize message.fileUrl values in the database.
  - Converts full storage URLs (firebasestorage.googleapis.com and storage.googleapis.com) to canonical storage object paths (messages/.. or uploads/..)
  - Removes query params like signed tokens and converts API_URL prefixed paths to relative ones
  - Ensure /uploads/* paths are stored with leading slash

  Usage: node backend/scripts/migrate-file-urls.js
*/

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeFileUrl(raw) {
  if (!raw) return null;
  let s = raw.trim();
  // Remove API server prefix if present
  const apiUrl = process.env.VITE_API_URL || process.env.API_URL || process.env.APP_URL;
  if (apiUrl && s.startsWith(apiUrl)) {
    s = s.slice(apiUrl.length);
  }
  // Strip common query params
  s = s.split('?')[0];

  // If already a server-local upload path
  if (s.startsWith('/uploads/')) {
    return s; // store as-is
  }
  if (s.startsWith('uploads/')) {
    return '/' + s;
  }

  // If HTTPS URL — try to parse
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const host = u.hostname || '';
      const pathname = u.pathname || '';

      if (host.includes('firebasestorage.googleapis.com')) {
        // path like /v0/b/<bucket>/o/<encodedPath>
        const matches = pathname.match(/\/o\/(.+)$/);
        if (matches && matches[1]) return decodeURIComponent(matches[1]);
      }
      if (host.includes('storage.googleapis.com')) {
        // path like /<bucket>/<object_path>
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return parts.slice(1).join('/');
      }
      // If path starts with /uploads, keep as-is
      if (pathname.startsWith('/uploads/')) return pathname;
      // otherwise, fallback to using the pathname without leading '/'
      return pathname.startsWith('/') ? pathname.slice(1) : pathname;
    } catch (e) {
      return s;
    }
  }

  // If short storage path, keep as-is (e.g., messages/...)
  return s;
}

const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');

(async () => {
  console.log('Starting migration: Normalize message.fileUrl values');
  try {
    const messages = await prisma.message.findMany({ where: { fileUrl: { not: null } }, select: { id: true, fileUrl: true } });
    console.log('Found messages count', messages.length);
    for (const m of messages) {
      const raw = m.fileUrl;
      const normalized = normalizeFileUrl(raw);
      if (!normalized || normalized === raw) continue;
      console.log('Would update message', m.id, '->', normalized);
      if (apply && !dryRun) {
        await prisma.message.update({ where: { id: m.id }, data: { fileUrl: normalized } });
        console.log('Updated message', m.id, '->', normalized);
      }
    }
    console.log('Migration finished');
  } catch (e) {
    console.error('Migration failed', e);
  } finally {
    await prisma.$disconnect();
  }
})();

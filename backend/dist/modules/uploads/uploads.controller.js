"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const fs = require("fs");
function initAdmin() {
    if (admin.apps && admin.apps.length > 0)
        return;
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
        admin.initializeApp({ credential: admin.credential.applicationDefault(), storageBucket: bucket });
    }
    catch (e) {
        common_1.Logger.error('firebase-admin initialization failed', e);
        throw e;
    }
}
let UploadsController = class UploadsController {
    constructor() {
        try {
            initAdmin();
        }
        catch (e) {
        }
    }
    getDebugInfo() {
        const apps = admin.apps;
        return {
            firebaseInitialized: apps && apps.length > 0,
            appCount: apps ? apps.length : 0,
            bucketName: process.env.FIREBASE_STORAGE_BUCKET || 'web-chat-data.appspot.com (fallback)',
            hasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
            hasServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        };
    }
    async getSignedUploadUrl(body) {
        common_1.Logger.log('signed-url request received', { path: body.path, contentType: body.contentType });
        try {
            common_1.Logger.log('Calling initAdmin...');
            initAdmin();
            common_1.Logger.log('initAdmin completed successfully');
            const apps = admin.apps;
            common_1.Logger.log('Firebase apps initialized:', apps ? apps.length : 'none');
            if (!apps || apps.length === 0) {
                throw new Error('Firebase not initialized');
            }
            const fallbackBucket = 'web-chat-data.appspot.com';
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
            common_1.Logger.log('Using bucket name:', bucketName);
            const destination = body.path;
            if (!destination)
                throw new common_1.HttpException('Missing path', common_1.HttpStatus.BAD_REQUEST);
            common_1.Logger.log('Creating bucket and file reference...');
            const bucket = admin.storage().bucket(bucketName);
            const file = bucket.file(destination);
            const options = {
                version: 'v4',
                action: 'write',
                expires: Date.now() + 15 * 60 * 1000,
            };
            if (body.contentType)
                options.contentType = body.contentType;
            common_1.Logger.log('Generating signed upload URL...');
            const [uploadUrl] = await file.getSignedUrl(options);
            common_1.Logger.log('Upload URL generated successfully');
            let readUrl = null;
            try {
                common_1.Logger.log('Generating read signed URL...');
                const expires = Date.now() + 60 * 60 * 1000;
                const [r] = await file.getSignedUrl({ action: 'read', expires });
                readUrl = r;
                common_1.Logger.log('Read URL generated successfully');
            }
            catch (e) {
                common_1.Logger.log('Read URL generation failed, using fallback', e);
                readUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media`;
            }
            common_1.Logger.log('Returning signed URLs');
            return { uploadUrl, path: destination, readUrl };
        }
        catch (e) {
            common_1.Logger.error('Error while generating signed upload URL', e);
            throw new common_1.HttpException({ error: 'Failed to generate signed upload URL', detail: (e === null || e === void 0 ? void 0 : e.message) || String(e) }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getStorageDebug(prefix) {
        try {
            common_1.Logger.log('Running storage debug: calling initAdmin');
            initAdmin();
            const fallbackBucket = 'web-chat-data.appspot.com';
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
            common_1.Logger.log('Storage debug using bucket:', bucketName);
            const bucket = admin.storage().bucket(bucketName);
            common_1.Logger.log('Requesting bucket metadata...');
            const [metadata] = await bucket.getMetadata();
            common_1.Logger.log('Bucket metadata received');
            if (prefix) {
                if (process.env.DEBUG_STORAGE_LIST !== '1' && process.env.NODE_ENV !== 'development') {
                    return { ok: false, error: 'Listing by prefix is disabled. Enable DEBUG_STORAGE_LIST=1 or run in development.' };
                }
                common_1.Logger.log('Listing files for prefix', prefix);
                const [files] = await bucket.getFiles({ prefix });
                const names = (files || []).map(f => f.name).slice(0, 500);
                return { ok: true, bucketName, metadata, prefix, count: names.length, files: names };
            }
            return { ok: true, bucketName, metadata };
        }
        catch (e) {
            common_1.Logger.error('Storage debug failed', e);
            return { ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) };
        }
    }
    async getReadUrl(body) {
        try {
            common_1.Logger.log('read-url request received', body);
            initAdmin();
            const fallbackBucket = 'web-chat-data.appspot.com';
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
            let path = body.path;
            if (!path && body.url) {
                try {
                    const parsed = new URL(body.url);
                    common_1.Logger.log('Parsing URL to path:', parsed.pathname);
                    common_1.Logger.log('Hostname:', parsed.hostname);
                    if (parsed.hostname.includes('firebasestorage.googleapis.com')) {
                        const matches = parsed.pathname.match(/\/o\/(.+)/);
                        if (matches && matches[1])
                            path = decodeURIComponent(matches[1]);
                    }
                    else if (parsed.hostname.includes('storage.googleapis.com')) {
                        const splits = parsed.pathname.split('/').filter(Boolean);
                        if (splits.length >= 2) {
                            path = splits.slice(1).join('/');
                        }
                    }
                    else if (parsed.hostname === 'csetem.onrender.com' || parsed.hostname.includes('localhost') || parsed.hostname.includes('127.0.0.1')) {
                        path = parsed.pathname.slice(1);
                        path = decodeURIComponent(path);
                    }
                    else {
                        path = parsed.pathname.slice(1);
                        path = decodeURIComponent(path);
                    }
                }
                catch (e) {
                    common_1.Logger.warn('Failed to parse provided url into path', e);
                }
            }
            if (!path) {
                common_1.Logger.warn('Missing path or url for read-url', body);
                throw new common_1.HttpException({ error: 'Missing path or url' }, common_1.HttpStatus.BAD_REQUEST);
            }
            const bucket = admin.storage().bucket(bucketName);
            const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
            common_1.Logger.log('Checking read-url against bucket and path', { bucketName, path: normalizedPath });
            if (normalizedPath.startsWith('uploads/')) {
                const serverUrl = process.env.API_URL || process.env.APP_URL || `https://${process.env.RENDER_EXTERNAL_URL || 'csetem.onrender.com'}`;
                const readUrlLocal = `${serverUrl}/${normalizedPath}`;
                common_1.Logger.log('Detected local upload path, returning server-hosted read URL', { readUrlLocal });
                return { readUrl: readUrlLocal };
            }
            common_1.Logger.log('Checking read-url against bucket and path', { bucketName, path: normalizedPath });
            const file = bucket.file(normalizedPath);
            const [exists] = await file.exists();
            common_1.Logger.log('File exists check result:', exists);
            if (!exists) {
                common_1.Logger.warn('Requested file does not exist for path', normalizedPath);
                try {
                    if (process.env.DEBUG_STORAGE_LIST === '1') {
                        const parts = normalizedPath.split('/').filter(Boolean);
                        const prefix = parts.length >= 2 ? `${parts[0]}/${parts[1]}/` : `${parts[0]}/`;
                        common_1.Logger.log('DEBUG_STORAGE_LIST enabled; listing files with prefix', prefix);
                        const [files] = await bucket.getFiles({ prefix });
                        const names = (files || []).map(f => f.name).slice(0, 50);
                        common_1.Logger.log('Nearby files for prefix', { prefix, count: names.length, names });
                    }
                }
                catch (listErr) {
                    common_1.Logger.warn('Failed to list nearby files for debugging', listErr);
                }
                throw new common_1.HttpException({ error: 'Not found' }, common_1.HttpStatus.NOT_FOUND);
            }
            const expires = Date.now() + 60 * 60 * 1000;
            const [readUrl] = await file.getSignedUrl({ action: 'read', expires });
            common_1.Logger.log('Read URL generated successfully for path', path);
            return { readUrl };
        }
        catch (e) {
            common_1.Logger.error('Error while generating read URL', JSON.stringify(body));
            if (e && e.stack)
                common_1.Logger.error(e.stack);
            const detail = (e === null || e === void 0 ? void 0 : e.message) || String(e);
            throw new common_1.HttpException({ error: 'Failed to generate read URL', detail }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Get)('debug'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UploadsController.prototype, "getDebugInfo", null);
__decorate([
    (0, common_1.Post)('signed-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getSignedUploadUrl", null);
__decorate([
    (0, common_1.Get)('debug-storage'),
    __param(0, (0, common_1.Query)('prefix')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getStorageDebug", null);
__decorate([
    (0, common_1.Post)('read-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getReadUrl", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.Controller)('uploads'),
    __metadata("design:paramtypes", [])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map
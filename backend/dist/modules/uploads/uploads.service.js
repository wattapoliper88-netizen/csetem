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
var UploadsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const admin = require("firebase-admin");
const fs = require("fs");
let UploadsService = UploadsService_1 = class UploadsService {
    constructor() {
        this.logger = new common_1.Logger(UploadsService_1.name);
        try {
            this.initAdmin();
        }
        catch (e) {
        }
    }
    initAdmin() {
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
    async getSignedUploadUrl(path, contentType) {
        this.logger.log('signed-url request received', { path, contentType });
        try {
            this.initAdmin();
            const apps = admin.apps;
            if (!apps || apps.length === 0) {
                throw new Error('Firebase not initialized');
            }
            const fallbackBucket = 'web-chat-data.appspot.com';
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
            const destination = path;
            if (!destination)
                throw new common_1.HttpException('Missing path', common_1.HttpStatus.BAD_REQUEST);
            const bucket = admin.storage().bucket(bucketName);
            const file = bucket.file(destination);
            const options = {
                version: 'v4',
                action: 'write',
                expires: Date.now() + 15 * 60 * 1000,
            };
            if (contentType)
                options.contentType = contentType;
            const [uploadUrl] = await file.getSignedUrl(options);
            let readUrl = null;
            try {
                const expires = Date.now() + 60 * 60 * 1000;
                const [r] = await file.getSignedUrl({ action: 'read', expires });
                readUrl = r;
            }
            catch (e) {
                readUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media`;
            }
            return { uploadUrl, path: destination, readUrl };
        }
        catch (e) {
            this.logger.error('Error while generating signed upload URL', e);
            throw new common_1.HttpException({ error: 'Failed to generate signed upload URL', detail: (e === null || e === void 0 ? void 0 : e.message) || String(e) }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getReadUrl(pathOrUrl) {
        try {
            this.initAdmin();
            const fallbackBucket = 'web-chat-data.appspot.com';
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
            let path = pathOrUrl;
            if (path.startsWith('http')) {
                try {
                    const parsed = new URL(path);
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
                    else {
                        path = parsed.pathname.slice(1);
                        path = decodeURIComponent(path);
                    }
                }
                catch (e) {
                }
            }
            if (!path) {
                throw new common_1.HttpException({ error: 'Missing path or url' }, common_1.HttpStatus.BAD_REQUEST);
            }
            const bucket = admin.storage().bucket(bucketName);
            const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
            if (normalizedPath.startsWith('uploads/')) {
                const serverUrl = process.env.API_URL || process.env.APP_URL || `https://${process.env.RENDER_EXTERNAL_URL || 'csetem.onrender.com'}`;
                const readUrlLocal = `${serverUrl}/${normalizedPath}`;
                return { readUrl: readUrlLocal };
            }
            const file = bucket.file(normalizedPath);
            const [exists] = await file.exists();
            if (!exists) {
                throw new common_1.HttpException({ error: 'Not found' }, common_1.HttpStatus.NOT_FOUND);
            }
            const expires = Date.now() + 60 * 60 * 1000;
            const [readUrl] = await file.getSignedUrl({ action: 'read', expires });
            return { readUrl };
        }
        catch (e) {
            if (e instanceof common_1.HttpException)
                throw e;
            this.logger.error('Error while generating read URL', e);
            const detail = (e === null || e === void 0 ? void 0 : e.message) || String(e);
            throw new common_1.HttpException({ error: 'Failed to generate read URL', detail }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getSignedUrlForPath(path) {
        try {
            const result = await this.getReadUrl(path);
            return result.readUrl;
        }
        catch (e) {
            return null;
        }
    }
    async getReadUrls(paths) {
        this.initAdmin();
        const results = {};
        const uniquePaths = [...new Set(paths)];
        await Promise.all(uniquePaths.map(async (path) => {
            try {
                const result = await this.getReadUrl(path);
                results[path] = result.readUrl;
            }
            catch (e) {
                results[path] = null;
            }
        }));
        return results;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map
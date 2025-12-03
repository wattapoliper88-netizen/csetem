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
const uploads_service_1 = require("./uploads.service");
let UploadsController = class UploadsController {
    constructor(uploadsService) {
        this.uploadsService = uploadsService;
    }
    getDebugInfo() {
        this.uploadsService.initAdmin();
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
        return this.uploadsService.getSignedUploadUrl(body.path, body.contentType);
    }
    async getStorageDebug(prefix) {
        try {
            this.uploadsService.initAdmin();
            const fallbackBucket = 'web-chat-data.appspot.com';
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
            const bucket = admin.storage().bucket(bucketName);
            const [metadata] = await bucket.getMetadata();
            if (prefix) {
                if (process.env.DEBUG_STORAGE_LIST !== '1' && process.env.NODE_ENV !== 'development') {
                    return { ok: false, error: 'Listing by prefix is disabled. Enable DEBUG_STORAGE_LIST=1 or run in development.' };
                }
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
        let path = body.path;
        if (!path && body.url) {
            path = body.url;
        }
        if (!path) {
            throw new common_1.HttpException({ error: 'Missing path or url' }, common_1.HttpStatus.BAD_REQUEST);
        }
        return this.uploadsService.getReadUrl(path);
    }
    async getReadUrls(body) {
        if (!body.paths || !Array.isArray(body.paths)) {
            throw new common_1.HttpException({ error: 'Missing paths array' }, common_1.HttpStatus.BAD_REQUEST);
        }
        return this.uploadsService.getReadUrls(body.paths);
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
__decorate([
    (0, common_1.Post)('read-urls'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getReadUrls", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.Controller)('uploads'),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map
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
    async getSignedUploadUrl(body) {
        try {
            initAdmin();
            const fallbackBucket = 'web-chat-data.appspot.com';
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || fallbackBucket;
            const destination = body.path;
            if (!destination)
                throw new common_1.HttpException('Missing path', common_1.HttpStatus.BAD_REQUEST);
            const bucket = admin.storage().bucket(bucketName);
            const file = bucket.file(destination);
            const options = {
                version: 'v4',
                action: 'write',
                expires: Date.now() + 15 * 60 * 1000,
            };
            if (body.contentType)
                options.contentType = body.contentType;
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
            common_1.Logger.error('Error while generating signed upload URL', e);
            throw new common_1.HttpException({ error: 'Failed to generate signed upload URL', detail: (e === null || e === void 0 ? void 0 : e.message) || String(e) }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('signed-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getSignedUploadUrl", null);
exports.UploadsController = UploadsController = __decorate([
    (0, common_1.Controller)('uploads'),
    __metadata("design:paramtypes", [])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map
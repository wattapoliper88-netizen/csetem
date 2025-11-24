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
function initAdmin() {
    if (admin.apps && admin.apps.length > 0)
        return;
    const bucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            storageBucket: bucket,
        });
    }
    catch (e) {
    }
}
let UploadsController = class UploadsController {
    constructor() {
        initAdmin();
    }
    async getSignedUploadUrl(body) {
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
        if (!bucketName) {
            return { error: 'FIREBASE_STORAGE_BUCKET not configured on server' };
        }
        const destination = body.path;
        if (!destination)
            return { error: 'Missing path' };
        const bucket = admin.storage().bucket(bucketName);
        const file = bucket.file(destination);
        const options = {
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000,
        };
        if (body.contentType)
            options.contentType = body.contentType;
        const [url] = await file.getSignedUrl(options);
        return { uploadUrl: url, path: destination };
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
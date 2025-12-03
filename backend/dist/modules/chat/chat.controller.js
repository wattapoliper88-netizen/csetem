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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const chat_service_1 = require("./chat.service");
const chat_gateway_1 = require("./chat.gateway");
let ChatController = class ChatController {
    constructor(chatService, chatGateway) {
        this.chatService = chatService;
        this.chatGateway = chatGateway;
    }
    async myConversation(req) {
        return this.chatService.getMyConversation(req.user.userId, req.user.isAdmin);
    }
    async listConversations(req) {
        if (!req.user.isAdmin)
            return [];
        return this.chatService.listConversationsForAdmin(req.user.userId);
    }
    async getMessages(req, conversationId, limit = 50, cursor) {
        return this.chatService.getMessages(conversationId, req.user.userId, req.user.isAdmin, Number(limit), cursor);
    }
    async sendMessage(req, body, file) {
        const created = await this.chatService.createMessage(body.conversationId, req.user.userId, body.content || '', req.user.isAdmin, file, body.audioThumbnail, body.fileUrl, body.fileName, body.fileType);
        try {
            this.chatGateway.server.to(body.conversationId).emit('message:new', created);
            this.chatGateway.checkAndSendOfflineNotification(body.conversationId, req.user.userId, body.content || (body.fileUrl ? 'Fájl melléklet' : 'Üzenet'));
        }
        catch (err) {
        }
        return created;
    }
    async getLinkPreview(url) {
        return this.chatService.getLinkPreview(url);
    }
    async getFolders(req, conversationId) {
        return this.chatService.getFolders(conversationId, req.user.userId);
    }
    async closeFolder(req, folderId) {
        return this.chatService.closeFolder(folderId, req.user.userId);
    }
    async deleteMessages(req, body) {
        return this.chatService.deleteMessages(body.messageIds, req.user.userId, req.user.isAdmin);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('conversations/me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "myConversation", null);
__decorate([
    (0, common_1.Get)('conversations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Get)('messages/:conversationId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('messages'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, `${uniqueSuffix}${(0, path_1.extname)(file.originalname)}`);
            },
        }),
        limits: {
            fileSize: 3 * 1024 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)('link-preview'),
    __param(0, (0, common_1.Query)('url')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getLinkPreview", null);
__decorate([
    (0, common_1.Get)('folders/:conversationId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getFolders", null);
__decorate([
    (0, common_1.Post)('folders/:folderId/close'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('folderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "closeFolder", null);
__decorate([
    (0, common_1.Post)('messages/delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "deleteMessages", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        chat_gateway_1.ChatGateway])
], ChatController);
//# sourceMappingURL=chat.controller.js.map
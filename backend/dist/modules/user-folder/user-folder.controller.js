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
exports.UserFolderController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../../prisma/prisma.service");
const user_folder_service_1 = require("./user-folder.service");
let UserFolderController = class UserFolderController {
    constructor(folderService, prisma) {
        this.folderService = folderService;
        this.prisma = prisma;
    }
    async checkAdmin(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!(user === null || user === void 0 ? void 0 : user.isAdmin))
            throw new Error('Admin access required');
    }
    async list(req) {
        await this.checkAdmin(req.user.userId);
        try {
            return this.folderService.listFolders();
        }
        catch (err) {
            const msg = (err === null || err === void 0 ? void 0 : err.message) || String(err);
            if (msg.includes('relation "UserFolder"') || msg.includes('UserFolder')) {
                throw new common_1.HttpException('Database migration for user folders has not been applied', common_1.HttpStatus.NOT_IMPLEMENTED);
            }
            throw err;
        }
    }
    async create(req, body) {
        await this.checkAdmin(req.user.userId);
        return this.folderService.createFolder({ name: body.name, parentId: body.parentId || null, thumbnail: body.thumbnail || null, createdBy: req.user.userId });
    }
    async update(req, folderId, body) {
        await this.checkAdmin(req.user.userId);
        return this.folderService.updateFolder(folderId, { name: body.name, thumbnail: body.thumbnail || null });
    }
    async delete(req, folderId) {
        await this.checkAdmin(req.user.userId);
        await this.folderService.deleteFolder(folderId);
        return { success: true };
    }
    async assignUser(req, folderId, userId) {
        await this.checkAdmin(req.user.userId);
        return this.folderService.assignUser(folderId, userId);
    }
    async unassignUser(req, folderId, userId) {
        await this.checkAdmin(req.user.userId);
        await this.folderService.unassignUser(folderId, userId);
        return { success: true };
    }
};
exports.UserFolderController = UserFolderController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserFolderController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserFolderController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':folderId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('folderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], UserFolderController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':folderId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('folderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UserFolderController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':folderId/users/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('folderId')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], UserFolderController.prototype, "assignUser", null);
__decorate([
    (0, common_1.Delete)(':folderId/users/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('folderId')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], UserFolderController.prototype, "unassignUser", null);
exports.UserFolderController = UserFolderController = __decorate([
    (0, common_1.Controller)('me/admin/user-folders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [user_folder_service_1.UserFolderService, prisma_service_1.PrismaService])
], UserFolderController);
//# sourceMappingURL=user-folder.controller.js.map
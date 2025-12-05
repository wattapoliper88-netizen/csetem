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
var UserController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const prisma_service_1 = require("../../prisma/prisma.service");
const bcrypt = require("bcrypt");
let UserController = UserController_1 = class UserController {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(UserController_1.name);
    }
    async checkAdmin(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!(user === null || user === void 0 ? void 0 : user.isAdmin)) {
            throw new common_1.ForbiddenException('Admin access required');
        }
    }
    async me(req) {
        const user = await this.prisma.user.update({
            where: { id: req.user.userId },
            data: { lastSeen: new Date() },
            select: { id: true, email: true, username: true, isAdmin: true, verified: true, avatarImage: true, lastSeen: true },
        });
        return user;
    }
    async updateAvatar(req, body) {
        const user = await this.prisma.user.update({
            where: { id: req.user.userId },
            data: { avatarImage: body.avatarImage },
            select: { id: true, email: true, username: true, isAdmin: true, verified: true, avatarImage: true },
        });
        return user;
    }
    async updateUsername(req, body) {
        const exists = await this.prisma.user.findFirst({ where: { username: body.username } });
        if (exists && exists.id !== req.user.userId) {
            throw new common_1.ForbiddenException('A felhasználónév már foglalt');
        }
        const user = await this.prisma.user.update({
            where: { id: req.user.userId },
            data: { username: body.username },
            select: { id: true, email: true, username: true, isAdmin: true, verified: true, avatarImage: true },
        });
        return user;
    }
    async updatePassword(req, body) {
        const user = await this.prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user)
            throw new common_1.ForbiddenException('Nincs ilyen felhasználó');
        const match = await bcrypt.compare(body.currentPassword, user.passwordHash);
        if (!match) {
            throw new common_1.ForbiddenException('A jelenlegi jelszó nem egyezik');
        }
        const passwordHash = await bcrypt.hash(body.newPassword, 10);
        await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
        return { success: true };
    }
    async deleteUser(req, userId) {
        await this.checkAdmin(req.user.userId);
        try {
            const convs = await this.prisma.conversation.findMany({ where: { OR: [{ userId }, { adminId: userId }] }, select: { id: true } });
            const convIds = convs.map(c => c.id);
            const msgRecords = convIds.length > 0 ? await this.prisma.message.findMany({ where: { conversationId: { in: convIds } }, select: { id: true } }) : [];
            const msgIds = msgRecords.map(m => m.id);
            const ops = [];
            if (msgIds.length > 0)
                ops.push(this.prisma.folderMessage.deleteMany({ where: { messageId: { in: msgIds } } }));
            if (convIds.length > 0)
                ops.push(this.prisma.folder.deleteMany({ where: { conversationId: { in: convIds } } }));
            if (convIds.length > 0)
                ops.push(this.prisma.message.deleteMany({ where: { conversationId: { in: convIds } } }));
            if (convIds.length > 0)
                ops.push(this.prisma.conversation.deleteMany({ where: { id: { in: convIds } } }));
            ops.push(this.prisma.message.deleteMany({ where: { senderId: userId } }));
            ops.push(this.prisma.user.delete({ where: { id: userId } }));
            await this.prisma.$transaction(ops);
            this.logger.log(`Deleted user and cleaned up related records for userId=${userId}`);
        }
        catch (error) {
            this.logger.error('Failed to delete user or related entities: ' + (error instanceof Error ? error.message : JSON.stringify(error)), JSON.stringify(error));
            throw new Error('Failed to delete user due to related data. Please check server logs.');
        }
        return { success: true };
    }
    async toggleBanUser(req, userId, body) {
        await this.checkAdmin(req.user.userId);
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { verified: !body.banned },
        });
        return user;
    }
    async toggleAdmin(req, userId, body) {
        await this.checkAdmin(req.user.userId);
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { isAdmin: body.isAdmin },
        });
        return user;
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "me", null);
__decorate([
    (0, common_1.Put)('avatar'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateAvatar", null);
__decorate([
    (0, common_1.Put)('username'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateUsername", null);
__decorate([
    (0, common_1.Put)('password'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updatePassword", null);
__decorate([
    (0, common_1.Delete)('admin/user/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "deleteUser", null);
__decorate([
    (0, common_1.Put)('admin/user/:userId/ban'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "toggleBanUser", null);
__decorate([
    (0, common_1.Put)('admin/user/:userId/admin'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "toggleAdmin", null);
exports.UserController = UserController = UserController_1 = __decorate([
    (0, common_1.Controller)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserController);
//# sourceMappingURL=user.controller.js.map
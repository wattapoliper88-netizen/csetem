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
var UserFolderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserFolderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let UserFolderService = UserFolderService_1 = class UserFolderService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(UserFolderService_1.name);
    }
    async listFolders() {
        const folders = await this.prisma.userFolder.findMany({
            include: { children: true, members: true },
        });
        return folders;
    }
    async getFolder(id) {
        return this.prisma.userFolder.findUnique({ where: { id } });
    }
    async createFolder(data) {
        return this.prisma.userFolder.create({ data: { name: data.name, parentId: data.parentId || null, thumbnail: data.thumbnail || null, createdBy: data.createdBy } });
    }
    async updateFolder(id, data) {
        return this.prisma.userFolder.update({ where: { id }, data: { name: data.name, thumbnail: data.thumbnail } });
    }
    async deleteFolder(id) {
        return this.prisma.userFolder.delete({ where: { id } });
    }
    async assignUser(folderId, userId) {
        return this.prisma.userFolderMember.create({ data: { folderId, userId } });
    }
    async unassignUser(folderId, userId) {
        return this.prisma.userFolderMember.deleteMany({ where: { folderId, userId } });
    }
};
exports.UserFolderService = UserFolderService;
exports.UserFolderService = UserFolderService = UserFolderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserFolderService);
//# sourceMappingURL=user-folder.service.js.map
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
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ChatService = ChatService_1 = class ChatService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ChatService_1.name);
    }
    async getOrCreateUserConversation(userId, adminId) {
        let conv = await this.prisma.conversation.findFirst({
            where: { userId, adminId },
        });
        if (!conv) {
            conv = await this.prisma.conversation.create({
                data: { userId, adminId },
            });
        }
        return conv;
    }
    async getMyConversation(userId, isAdmin) {
        if (isAdmin) {
            throw new common_1.ForbiddenException('Use GET /conversations for admin');
        }
        let admin = await this.prisma.user.findFirst({ where: { isAdmin: true } });
        if (!admin) {
            admin = await this.prisma.user.update({
                where: { id: userId },
                data: { isAdmin: true },
            });
            this.logger.warn('⚠️ No admin found, promoted current user to admin: ' + JSON.stringify({
                userId,
            }));
        }
        const conv = await this.getOrCreateUserConversation(userId, admin.id);
        this.logger.log('getMyConversation: ' + JSON.stringify({
            userId,
            adminId: admin.id,
            conversationId: conv.id,
        }));
        return conv;
    }
    async listConversationsForAdmin(adminId) {
        this.logger.log('listConversationsForAdmin called with adminId: ' + adminId);
        const conversations = await this.prisma.conversation.findMany({
            where: { adminId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        isAdmin: true,
                        verified: true,
                        lastSeen: true,
                        avatarImage: true
                    }
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                senderId: { not: adminId },
                                readAt: null
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        this.logger.log('Found conversations (sanitized): ' + JSON.stringify(conversations.map(c => ({
            id: c.id,
            userId: c.userId,
            adminId: c.adminId,
            createdAt: c.createdAt,
            unreadCount: c._count.messages,
            user: {
                id: c.user.id,
                email: c.user.email,
                username: c.user.username,
                isAdmin: c.user.isAdmin,
                verified: c.user.verified,
                lastSeen: c.user.lastSeen,
                avatarImageLength: (c.user.avatarImage ? c.user.avatarImage.length : 0)
            }
        }))));
        return conversations.map(c => ({
            ...c,
            unreadCount: c._count.messages,
            _count: undefined
        }));
    }
    async getMessages(conversationId, userId, isAdmin, limit = 50, cursor) {
        const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv)
            throw new common_1.NotFoundException();
        if (!isAdmin && conv.userId !== userId) {
            throw new common_1.ForbiddenException();
        }
        if (isAdmin && conv.adminId !== userId) {
            throw new common_1.ForbiddenException();
        }
        await this.prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: userId },
                readAt: null
            },
            data: {
                readAt: new Date()
            }
        });
        return this.prisma.message.findMany({
            where: {
                conversationId
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
                sender: {
                    select: { id: true, username: true, email: true, lastSeen: true, avatarImage: true }
                }
            }
        });
    }
    async createMessage(conversationId, senderId, content, isAdmin, file, audioThumbnail, fileUrl, fileName, fileType) {
        const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv)
            throw new common_1.NotFoundException();
        if (!isAdmin && conv.userId !== senderId) {
            throw new common_1.ForbiddenException();
        }
        if (isAdmin && conv.adminId !== senderId) {
            throw new common_1.ForbiddenException();
        }
        const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
        if (sender && !sender.verified && !sender.isAdmin) {
            const isPermissionRequest = content === null || content === void 0 ? void 0 : content.includes('Engedélyt kérek a csetfalra íráshoz');
            if (!isPermissionRequest) {
                throw new common_1.ForbiddenException('Nincs jogosultságod üzenetet küldeni. Kérj engedélyt az adminisztrátoroktól!');
            }
        }
        const messageData = {
            conversationId,
            senderId,
            content: content || (file ? `📎 ${file.originalname}` : '')
        };
        if (file) {
            messageData.fileUrl = `/uploads/${file.filename}`;
            messageData.fileName = file.originalname;
            messageData.fileType = file.mimetype;
            if (audioThumbnail && file.mimetype.startsWith('audio/')) {
                messageData.audioThumbnail = audioThumbnail;
            }
        }
        else if (fileUrl) {
            let sanitizedUrl = fileUrl;
            if (/^https?\/\//i.test(sanitizedUrl) && !/^https?:\/\//i.test(sanitizedUrl)) {
                sanitizedUrl = sanitizedUrl.replace(/^(https?)\/\//i, '$1://');
            }
            if (sanitizedUrl.startsWith('//')) {
                sanitizedUrl = 'https:' + sanitizedUrl;
            }
            if (sanitizedUrl !== fileUrl) {
                this.logger.log('Normalized incoming fileUrl: ' + JSON.stringify({ original: fileUrl, sanitized: sanitizedUrl }));
            }
            let parsedPath = null;
            try {
                const u = new URL(sanitizedUrl);
                const host = u.hostname;
                if (host.includes('firebasestorage.googleapis.com')) {
                    const matches = u.pathname.match(/\/o\/(.+)/);
                    if (matches && matches[1])
                        parsedPath = decodeURIComponent(matches[1]);
                }
                else if (host.includes('storage.googleapis.com')) {
                    const splits = u.pathname.split('/').filter(Boolean);
                    if (splits.length >= 2)
                        parsedPath = splits.slice(1).join('/');
                }
                else if (u.pathname.startsWith('/uploads/')) {
                    parsedPath = u.pathname;
                }
            }
            catch (e) {
            }
            if (parsedPath) {
                if (parsedPath.startsWith('/uploads/')) {
                    messageData.fileUrl = parsedPath;
                }
                else {
                    messageData.fileUrl = parsedPath;
                }
            }
            else {
                messageData.fileUrl = sanitizedUrl;
            }
            if (fileName)
                messageData.fileName = fileName;
            if (fileType)
                messageData.fileType = fileType;
            if (audioThumbnail && fileType && fileType.startsWith('audio/')) {
                messageData.audioThumbnail = audioThumbnail;
            }
        }
        return this.prisma.message.create({
            data: messageData,
            include: {
                sender: {
                    select: { id: true, username: true, email: true, lastSeen: true }
                }
            }
        });
    }
    async getLinkPreview(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await response.text();
            const titleMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i)
                || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:title|twitter:title)["']/i)
                || html.match(/<title>([^<]+)<\/title>/i);
            const descriptionMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:description|description|twitter:description)["']\s+content=["']([^"']+)["']/i)
                || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:description|description|twitter:description)["']/i);
            const imageMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image|og:image:url)["']\s+content=["']([^"']+)["']/i)
                || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:image|twitter:image|og:image:url)["']/i);
            const siteNameMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:site_name|twitter:site)["']\s+content=["']([^"']+)["']/i)
                || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:site_name|twitter:site)["']/i);
            return {
                url,
                title: titleMatch ? titleMatch[1] : new URL(url).hostname,
                description: descriptionMatch ? descriptionMatch[1] : null,
                image: imageMatch ? imageMatch[1] : null,
                siteName: siteNameMatch ? siteNameMatch[1] : new URL(url).hostname,
            };
        }
        catch (error) {
            return {
                url,
                title: new URL(url).hostname,
                description: null,
                image: null,
                siteName: new URL(url).hostname,
            };
        }
    }
    async getFolders(conversationId, userId) {
        const folders = await this.prisma.folder.findMany({
            where: { conversationId },
            include: {
                messages: {
                    select: { messageId: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return folders.map(folder => ({
            id: folder.id,
            name: folder.name,
            icon: folder.icon,
            visibility: folder.visibility,
            createdBy: folder.createdBy,
            closedBy: JSON.parse(folder.closedBy || '[]'),
            messageIds: folder.messages.map(m => m.messageId),
        }));
    }
    async closeFolder(folderId, userId) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId }
        });
        if (!folder) {
            throw new common_1.NotFoundException('Folder not found');
        }
        const closedBy = JSON.parse(folder.closedBy || '[]');
        if (!closedBy.includes(userId)) {
            closedBy.push(userId);
        }
        return this.prisma.folder.update({
            where: { id: folderId },
            data: { closedBy: JSON.stringify(closedBy) }
        });
    }
    async deleteMessages(messageIds, userId, isAdmin) {
        const messages = await this.prisma.message.findMany({
            where: { id: { in: messageIds } },
            include: { conversation: true }
        });
        for (const msg of messages) {
            if (!isAdmin && msg.conversation.userId !== userId) {
                throw new common_1.ForbiddenException('Not authorized to delete these messages');
            }
            if (isAdmin && msg.conversation.adminId !== userId) {
                throw new common_1.ForbiddenException('Not authorized to delete these messages');
            }
        }
        const updates = await Promise.all(messageIds.map(async (messageId) => {
            const message = messages.find(m => m.id === messageId);
            if (!message)
                return null;
            const deletedBy = JSON.parse(message.deletedBy || '[]');
            if (!deletedBy.includes(userId)) {
                deletedBy.push(userId);
            }
            const conversation = message.conversation;
            const bothUserIds = [conversation.userId, conversation.adminId];
            if (deletedBy.length >= 2 && bothUserIds.every(id => deletedBy.includes(id))) {
                return this.prisma.message.delete({
                    where: { id: messageId }
                });
            }
            return this.prisma.message.update({
                where: { id: messageId },
                data: { deletedBy: JSON.stringify(deletedBy) }
            });
        }));
        return updates.filter(Boolean);
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChatService);
//# sourceMappingURL=chat.service.js.map
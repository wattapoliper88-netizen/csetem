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
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const email_service_1 = require("../../email/email.service");
const uploads_service_1 = require("../uploads/uploads.service");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    constructor(chatService, jwtService, config, prisma, emailService, uploadsService) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.config = config;
        this.prisma = prisma;
        this.emailService = emailService;
        this.uploadsService = uploadsService;
        this.logger = new common_1.Logger(ChatGateway_1.name);
    }
    afterInit() {
    }
    async handleConnection(client) {
        var _a, _b;
        this.logger.log('Socket connection attempt: ' + JSON.stringify({ id: client.id, transport: client.conn.transport.name, hasToken: !!((_a = client.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) }));
        try {
            const token = (_b = client.handshake.auth) === null || _b === void 0 ? void 0 : _b.token;
            this.logger.log('Socket connect attempt: ' + JSON.stringify({ id: client.id, hasToken: !!token }));
            if (!token) {
                this.logger.warn('Socket connection rejected: missing auth token ' + JSON.stringify({ id: client.id, handshake: client.handshake }));
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token, {
                secret: this.config.get('JWT_ACCESS_SECRET'),
            });
            client.user = { userId: payload.sub, isAdmin: payload.isAdmin };
            this.prisma.user.update({
                where: { id: payload.sub },
                data: { lastSeen: new Date() },
            }).catch(() => { });
            this.server.emit('user:online', { userId: payload.sub, lastSeen: new Date() });
        }
        catch (err) {
            this.logger.error('Socket connection auth error: ' + (err instanceof Error ? err.message : JSON.stringify(err)), JSON.stringify({ id: client.id, handshake: client.handshake }));
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        const user = client.user;
        if (user === null || user === void 0 ? void 0 : user.userId) {
            this.prisma.user.update({
                where: { id: user.userId },
                data: { lastSeen: new Date() },
            }).catch(() => { });
            this.server.emit('user:offline', { userId: user.userId, lastSeen: new Date() });
        }
    }
    async handleSendMessage(client, payload) {
        const user = client.user;
        if (!user)
            return;
        const msg = await this.chatService.createMessage(payload.conversationId, user.userId, payload.content, user.isAdmin);
        this.logger.log('Broadcasting message to conversation: ' + JSON.stringify({ conversationId: payload.conversationId, messageId: msg.id }));
        this.server.to(payload.conversationId).emit('message:new', msg);
        client.to(payload.conversationId).emit('typing', { userId: user.userId, isTyping: false });
        this.checkAndSendOfflineNotification(payload.conversationId, user.userId, payload.content);
    }
    async checkAndSendOfflineNotification(conversationId, senderId, content) {
        this.logger.log(`Checking offline notification for conversation ${conversationId}, sender ${senderId}`);
        try {
            const conversation = await this.prisma.conversation.findUnique({
                where: { id: conversationId },
            });
            if (!conversation) {
                this.logger.warn(`Conversation ${conversationId} not found for offline notification`);
                return;
            }
            const recipientId = conversation.userId === senderId ? conversation.adminId : conversation.userId;
            this.logger.log(`Recipient ID determined: ${recipientId}`);
            const connectedSockets = Array.from(this.server.sockets.sockets.values());
            const isOnline = connectedSockets.some((s) => { var _a; return ((_a = s.user) === null || _a === void 0 ? void 0 : _a.userId) === recipientId; });
            this.logger.log(`Recipient ${recipientId} online status: ${isOnline} (connected sockets: ${connectedSockets.length})`);
            if (!isOnline) {
                const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
                const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
                if (recipient && recipient.email && sender) {
                    this.logger.log(`Sending offline email to ${recipient.email} from ${sender.username}`);
                    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
                    let avatarUrl = sender.avatarImage;
                    if (avatarUrl) {
                        const resolved = await this.uploadsService.getSignedUrlForPath(avatarUrl);
                        if (resolved)
                            avatarUrl = resolved;
                    }
                    await this.emailService.sendOfflineNotification(recipient.email, sender.username, preview, avatarUrl, conversationId);
                }
                else {
                    this.logger.warn(`Cannot send email: Recipient found: ${!!recipient}, Has email: ${!!(recipient === null || recipient === void 0 ? void 0 : recipient.email)}, Sender found: ${!!sender}`);
                }
            }
            else {
                this.logger.log('Recipient is online, skipping email.');
            }
        }
        catch (e) {
            this.logger.error('Failed to handle offline notification', e);
        }
    }
    async handleJoin(client, data) {
        const user = client.user;
        this.logger.log('User joining conversation: ' + JSON.stringify({ userId: user === null || user === void 0 ? void 0 : user.userId, conversationId: data.conversationId }));
        client.join(data.conversationId);
    }
    async handleTyping(client, data) {
        const user = client.user;
        if (!user)
            return;
        client.to(data.conversationId).emit('typing', {
            userId: user.userId,
            conversationId: data.conversationId,
            isTyping: data.isTyping,
            textLength: data.textLength || 0
        });
    }
    async handleHeartbeat(client) {
        const user = client.user;
        if (!user)
            return;
        this.prisma.user.update({
            where: { id: user.userId },
            data: { lastSeen: new Date() },
        }).catch(() => { });
        this.server.emit('user:online', { userId: user.userId, lastSeen: new Date() });
    }
    async handleFolderCreate(client, data) {
        const user = client.user;
        if (!user) {
            this.logger.warn('❌ folder:create - No user found');
            return;
        }
        this.logger.log('📁 folder:create received: ' + JSON.stringify({
            userId: user.userId,
            conversationId: data.conversationId,
            folderName: data.folder.name,
            visibility: data.folder.visibility
        }));
        try {
            const folder = await this.prisma.folder.create({
                data: {
                    id: data.folder.id,
                    name: data.folder.name,
                    icon: data.folder.icon,
                    conversationId: data.conversationId,
                    visibility: data.folder.visibility,
                    createdBy: user.userId,
                    closedBy: '[]',
                },
            });
            if (data.folder.messageIds && data.folder.messageIds.length > 0) {
                const uniqueMessageIds = [...new Set(data.folder.messageIds)];
                await this.prisma.folderMessage.createMany({
                    data: uniqueMessageIds.map((messageId) => ({
                        folderId: folder.id,
                        messageId: messageId,
                    })),
                    skipDuplicates: true,
                });
            }
            this.server.to(data.conversationId).emit('folder:new', {
                ...folder,
                messageIds: data.folder.messageIds || [],
            });
            client.emit('folder:new', {
                ...folder,
                messageIds: data.folder.messageIds || [],
            });
            this.logger.log('✅ Folder saved and broadcasted to conversation: ' + data.conversationId);
        }
        catch (error) {
            this.logger.error('❌ Error creating folder: ' + (error instanceof Error ? error.message : JSON.stringify(error)), JSON.stringify(error));
            client.emit('folder:error', { message: 'Failed to create folder' });
        }
    }
    async handleAudioPosition(client, data) {
        const user = client.user;
        if (!user)
            return;
        this.logger.log('🎵 Audio position received: ' + JSON.stringify({
            userId: user.userId,
            conversationId: data.conversationId,
            messageId: data.messageId,
            position: data.position
        }));
        const userData = await this.prisma.user.findUnique({
            where: { id: user.userId },
            select: { username: true }
        });
        client.to(data.conversationId).emit('audio-position:received', {
            messageId: data.messageId,
            position: data.position,
            senderId: user.userId,
            username: (userData === null || userData === void 0 ? void 0 : userData.username) || 'Ismeretlen'
        });
    }
    async handleFolderAddMessages(client, data) {
        const user = client.user;
        if (!user)
            return;
        this.logger.log('📁 folder:add-messages received: ' + JSON.stringify({
            userId: user.userId,
            folderId: data.folderId,
            messageCount: data.messageIds.length
        }));
        try {
            const existing = await this.prisma.folderMessage.findMany({
                where: {
                    folderId: data.folderId,
                    messageId: { in: data.messageIds }
                },
                select: { messageId: true }
            });
            const existingIds = new Set(existing.map(e => e.messageId));
            const newIds = data.messageIds.filter(id => !existingIds.has(id));
            if (newIds.length > 0) {
                await this.prisma.folderMessage.createMany({
                    data: newIds.map(id => ({
                        folderId: data.folderId,
                        messageId: id
                    }))
                });
                this.server.to(data.conversationId).emit('folder:updated', {
                    folderId: data.folderId,
                    addedMessageIds: newIds
                });
                this.logger.log(`✅ Added ${newIds.length} messages to folder ${data.folderId}`);
            }
            else {
                this.logger.log(`ℹ️ No new messages to add to folder ${data.folderId}`);
            }
        }
        catch (error) {
            this.logger.error('❌ Error adding messages to folder: ' + (error instanceof Error ? error.message : JSON.stringify(error)));
        }
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('conversation:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('heartbeat'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleHeartbeat", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('folder:create'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleFolderCreate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('audio-position'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleAudioPosition", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('folder:add-messages'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleFolderAddMessages", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: [
                'https://csetem.vercel.app',
                'http://localhost:3000',
                'http://localhost:5173',
                'http://127.0.0.1:5173'
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        },
        pingInterval: 25000,
        pingTimeout: 60000,
    }),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        jwt_1.JwtService,
        config_1.ConfigService,
        prisma_service_1.PrismaService,
        email_service_1.EmailService,
        uploads_service_1.UploadsService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map
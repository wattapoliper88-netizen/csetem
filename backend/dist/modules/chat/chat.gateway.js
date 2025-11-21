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
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const chat_service_1 = require("./chat.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
let ChatGateway = class ChatGateway {
    constructor(chatService, jwtService, config, prisma) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.config = config;
        this.prisma = prisma;
    }
    async handleConnection(client) {
        var _a;
        try {
            const token = (_a = client.handshake.auth) === null || _a === void 0 ? void 0 : _a.token;
            if (!token) {
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
        catch {
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
        console.log('Broadcasting message to conversation:', { conversationId: payload.conversationId, messageId: msg.id });
        this.server.to(payload.conversationId).emit('message:new', msg);
        client.to(payload.conversationId).emit('typing', { userId: user.userId, isTyping: false });
    }
    async handleJoin(client, data) {
        const user = client.user;
        console.log('User joining conversation:', { userId: user === null || user === void 0 ? void 0 : user.userId, conversationId: data.conversationId });
        client.join(data.conversationId);
    }
    async handleTyping(client, data) {
        const user = client.user;
        if (!user)
            return;
        client.to(data.conversationId).emit('typing', {
            userId: user.userId,
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
            console.log('❌ folder:create - No user found');
            return;
        }
        console.log('📁 folder:create received:', {
            userId: user.userId,
            conversationId: data.conversationId,
            folderName: data.folder.name,
            visibility: data.folder.visibility
        });
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
                await this.prisma.folderMessage.createMany({
                    data: data.folder.messageIds.map((messageId) => ({
                        folderId: folder.id,
                        messageId: messageId,
                    })),
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
            console.log('✅ Folder saved and broadcasted to conversation:', data.conversationId);
        }
        catch (error) {
            console.error('❌ Error creating folder:', error);
            client.emit('folder:error', { message: 'Failed to create folder' });
        }
    }
    async handleAudioPosition(client, data) {
        const user = client.user;
        if (!user)
            return;
        console.log('🎵 Audio position received:', {
            userId: user.userId,
            conversationId: data.conversationId,
            messageId: data.messageId,
            position: data.position
        });
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
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: 'http://localhost:5173',
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        jwt_1.JwtService,
        config_1.ConfigService,
        prisma_service_1.PrismaService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { socketCorsConfig } from './socket-cors.config';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

import { EmailService } from '../../email/email.service';
import { UploadsService } from '../uploads/uploads.service';

@WebSocketGateway({
  cors: {
    origin: [
      'https://csetem.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ],
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  },
  // Allow both websocket and polling transports to support fallback when websocket upgrade fails
  // transports: ['websocket'], // Removed to allow polling fallback
  // Tweak heartbeat settings to keep connections stable behind proxies/load-balancers
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
    private emailService: EmailService,
    private uploadsService: UploadsService,
  ) {}

  afterInit() {
    // ...existing code...
    // A CORS beállításokat csak a WebSocketGateway dekorátorban szabad megadni.
  }

  async handleConnection(client: Socket) {
    this.logger.log('Socket connection attempt: ' + JSON.stringify({ id: client.id, transport: client.conn.transport.name, hasToken: !!client.handshake.auth?.token }));
    try {
      const token = client.handshake.auth?.token;
      // Log for diagnostics so we can tell why the server closes sockets
      this.logger.log('Socket connect attempt: ' + JSON.stringify({ id: client.id, hasToken: !!token }));
      if (!token) {
        this.logger.warn('Socket connection rejected: missing auth token ' + JSON.stringify({ id: client.id, handshake: client.handshake }));
        client.disconnect();
        return;
      }
      const payload: any = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      (client as any).user = { userId: payload.sub, isAdmin: payload.isAdmin };
      
      // Update lastSeen to mark user as online - don't await
      this.prisma.user.update({
        where: { id: payload.sub },
        data: { lastSeen: new Date() },
      }).catch(() => {});
      
      // Broadcast online status
      this.server.emit('user:online', { userId: payload.sub, lastSeen: new Date() });
    } catch (err) {
      this.logger.error('Socket connection auth error: ' + (err instanceof Error ? err.message : JSON.stringify(err)), JSON.stringify({ id: client.id, handshake: client.handshake }));
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = (client as any).user;
    if (user?.userId) {
      // Update lastSeen on disconnect - don't await
      this.prisma.user.update({
        where: { id: user.userId },
        data: { lastSeen: new Date() },
      }).catch(() => {});
      
      // Broadcast offline status
      this.server.emit('user:offline', { userId: user.userId, lastSeen: new Date() });
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; content: string },
  ) {
    const user = (client as any).user;
    if (!user) return;

    const msg = await this.chatService.createMessage(
      payload.conversationId,
      user.userId,
      payload.content,
      user.isAdmin,
    );

    this.logger.log('Broadcasting message to conversation: ' + JSON.stringify({ conversationId: payload.conversationId, messageId: msg.id }));
    this.server.to(payload.conversationId).emit('message:new', msg);
    
    // Stop typing indicator when message is sent
    client.to(payload.conversationId).emit('typing', { userId: user.userId, isTyping: false });

    // Check if recipient is offline and send email
    this.checkAndSendOfflineNotification(payload.conversationId, user.userId, payload.content);
  }

  public async checkAndSendOfflineNotification(conversationId: string, senderId: string, content: string) {
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
      
      // Check if recipient is online
      const connectedSockets = Array.from(this.server.sockets.sockets.values());
      const isOnline = connectedSockets.some(
        (s: any) => s.user?.userId === recipientId
      );
      
      this.logger.log(`Recipient ${recipientId} online status: ${isOnline} (connected sockets: ${connectedSockets.length})`);

      if (!isOnline) {
        // Fetch recipient email
        const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
        const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
        
        if (recipient && recipient.email && sender) {
           this.logger.log(`Sending offline email to ${recipient.email} from ${sender.username}`);
           // Truncate content for privacy/brevity
           const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
           
           let avatarUrl = sender.avatarImage;
           if (avatarUrl) {
             // Try to resolve signed URL if it's a storage path
             const resolved = await this.uploadsService.getSignedUrlForPath(avatarUrl);
             if (resolved) avatarUrl = resolved;
           }
           
           await this.emailService.sendOfflineNotification(recipient.email, sender.username, preview, avatarUrl);
        } else {
           this.logger.warn(`Cannot send email: Recipient found: ${!!recipient}, Has email: ${!!recipient?.email}, Sender found: ${!!sender}`);
        }
      } else {
        this.logger.log('Recipient is online, skipping email.');
      }
    } catch (e) {
      this.logger.error('Failed to handle offline notification', e);
    }
  }

  @SubscribeMessage('conversation:join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user = (client as any).user;
    this.logger.log('User joining conversation: ' + JSON.stringify({ userId: user?.userId, conversationId: data.conversationId }));
    client.join(data.conversationId);
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean; textLength?: number },
  ) {
    const user = (client as any).user;
    if (!user) return;
    client.to(data.conversationId).emit('typing', { 
      userId: user.userId, 
      isTyping: data.isTyping,
      textLength: data.textLength || 0
    });
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    if (!user) return;
    
    // Update lastSeen - don't await to avoid blocking
    this.prisma.user.update({
      where: { id: user.userId },
      data: { lastSeen: new Date() },
    }).catch(() => {}); // Ignore errors
    
    // Broadcast online status
    this.server.emit('user:online', { userId: user.userId, lastSeen: new Date() });
  }

  @SubscribeMessage('folder:create')
  async handleFolderCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; folder: any },
  ) {
    const user = (client as any).user;
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
      // Save folder to database
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

      // Create folder-message relationships
      if (data.folder.messageIds && data.folder.messageIds.length > 0) {
        // Ensure unique message IDs to avoid constraint violations
        const uniqueMessageIds = [...new Set(data.folder.messageIds as string[])];
        
        await this.prisma.folderMessage.createMany({
          data: uniqueMessageIds.map((messageId: string) => ({
            folderId: folder.id,
            messageId: messageId,
          })),
          skipDuplicates: true, // Skip if relationship already exists (though it shouldn't for new folder)
        });
      }

      // Broadcast the new folder to all users in the conversation (including sender)
      this.server.to(data.conversationId).emit('folder:new', {
        ...folder,
        messageIds: data.folder.messageIds || [],
      });
      
      // Also send to the sender
      client.emit('folder:new', {
        ...folder,
        messageIds: data.folder.messageIds || [],
      });
      
      this.logger.log('✅ Folder saved and broadcasted to conversation: ' + data.conversationId);
    } catch (error) {
      this.logger.error('❌ Error creating folder: ' + (error instanceof Error ? error.message : JSON.stringify(error)), JSON.stringify(error));
      client.emit('folder:error', { message: 'Failed to create folder' });
    }
  }

  @SubscribeMessage('audio-position')
  async handleAudioPosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string; position: number },
  ) {
    const user = (client as any).user;
    if (!user) return;
    
    this.logger.log('🎵 Audio position received: ' + JSON.stringify({ 
      userId: user.userId, 
      conversationId: data.conversationId, 
      messageId: data.messageId,
      position: data.position
    }));
    
    // Get user details to send username
    const userData = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { username: true }
    });
    
    // Broadcast position to other users in the conversation
    client.to(data.conversationId).emit('audio-position:received', {
      messageId: data.messageId,
      position: data.position,
      senderId: user.userId,
      username: userData?.username || 'Ismeretlen'
    });
  }

  @SubscribeMessage('folder:add-messages')
  async handleFolderAddMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; folderId: string; messageIds: string[] },
  ) {
    const user = (client as any).user;
    if (!user) return;

    this.logger.log('📁 folder:add-messages received: ' + JSON.stringify({
      userId: user.userId,
      folderId: data.folderId,
      messageCount: data.messageIds.length
    }));

    try {
      // Check which messages are already in the folder to avoid unique constraint violations
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
        
        // Broadcast update to all users in the conversation
        this.server.to(data.conversationId).emit('folder:updated', {
          folderId: data.folderId,
          addedMessageIds: newIds
        });
        
        this.logger.log(`✅ Added ${newIds.length} messages to folder ${data.folderId}`);
      } else {
        this.logger.log(`ℹ️ No new messages to add to folder ${data.folderId}`);
      }
      
    } catch (error) {
      this.logger.error('❌ Error adding messages to folder: ' + (error instanceof Error ? error.message : JSON.stringify(error)));
    }
  }
}

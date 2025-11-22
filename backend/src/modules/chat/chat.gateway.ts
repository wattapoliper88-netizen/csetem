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
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

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
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  afterInit() {
    // ...existing code...
    // A CORS beállításokat csak a WebSocketGateway dekorátorban szabad megadni.
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
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
    } catch {
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

    console.log('Broadcasting message to conversation:', { conversationId: payload.conversationId, messageId: msg.id });
    this.server.to(payload.conversationId).emit('message:new', msg);
    
    // Stop typing indicator when message is sent
    client.to(payload.conversationId).emit('typing', { userId: user.userId, isTyping: false });
  }

  @SubscribeMessage('conversation:join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user = (client as any).user;
    console.log('User joining conversation:', { userId: user?.userId, conversationId: data.conversationId });
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
        await this.prisma.folderMessage.createMany({
          data: data.folder.messageIds.map((messageId: string) => ({
            folderId: folder.id,
            messageId: messageId,
          })),
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
      
      console.log('✅ Folder saved and broadcasted to conversation:', data.conversationId);
    } catch (error) {
      console.error('❌ Error creating folder:', error);
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
    
    console.log('🎵 Audio position received:', { 
      userId: user.userId, 
      conversationId: data.conversationId, 
      messageId: data.messageId,
      position: data.position
    });
    
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
}

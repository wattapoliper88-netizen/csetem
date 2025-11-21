import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private chatService;
    private jwtService;
    private config;
    private prisma;
    server: Server;
    constructor(chatService: ChatService, jwtService: JwtService, config: ConfigService, prisma: PrismaService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleSendMessage(client: Socket, payload: {
        conversationId: string;
        content: string;
    }): Promise<void>;
    handleJoin(client: Socket, data: {
        conversationId: string;
    }): Promise<void>;
    handleTyping(client: Socket, data: {
        conversationId: string;
        isTyping: boolean;
        textLength?: number;
    }): Promise<void>;
    handleHeartbeat(client: Socket): Promise<void>;
    handleFolderCreate(client: Socket, data: {
        conversationId: string;
        folder: any;
    }): Promise<void>;
    handleAudioPosition(client: Socket, data: {
        conversationId: string;
        messageId: string;
        position: number;
    }): Promise<void>;
}

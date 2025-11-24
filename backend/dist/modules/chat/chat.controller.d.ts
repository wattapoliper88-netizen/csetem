import { ChatService } from './chat.service';
export declare class ChatController {
    private chatService;
    constructor(chatService: ChatService);
    myConversation(req: any): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        adminId: string;
    }>;
    listConversations(req: any): Promise<({
        user: {
            email: string;
            username: string;
            id: string;
            verified: boolean;
            isAdmin: boolean;
            lastSeen: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        adminId: string;
    })[]>;
    getMessages(req: any, conversationId: string, limit?: number, cursor?: string): Promise<({
        sender: {
            email: string;
            username: string;
            id: string;
            lastSeen: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        conversationId: string;
        senderId: string;
        content: string;
        fileUrl: string | null;
        fileName: string | null;
        fileType: string | null;
        audioThumbnail: string | null;
        readAt: Date | null;
        deleted: boolean;
        deletedBy: string;
    })[]>;
    sendMessage(req: any, body: {
        conversationId: string;
        content?: string;
        audioThumbnail?: string;
        fileUrl?: string;
        fileName?: string;
        fileType?: string;
    }, file?: Express.Multer.File): Promise<{
        sender: {
            email: string;
            username: string;
            id: string;
            lastSeen: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        conversationId: string;
        senderId: string;
        content: string;
        fileUrl: string | null;
        fileName: string | null;
        fileType: string | null;
        audioThumbnail: string | null;
        readAt: Date | null;
        deleted: boolean;
        deletedBy: string;
    }>;
    getLinkPreview(url: string): Promise<{
        url: string;
        title: string;
        description: string;
        image: string;
        siteName: string;
    }>;
    getFolders(req: any, conversationId: string): Promise<{
        id: string;
        name: string;
        icon: string;
        visibility: string;
        createdBy: string;
        closedBy: any;
        messageIds: string[];
    }[]>;
    closeFolder(req: any, folderId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        conversationId: string;
        icon: string;
        visibility: string;
        createdBy: string;
        closedBy: string;
    }>;
    deleteMessages(req: any, body: {
        messageIds: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        conversationId: string;
        senderId: string;
        content: string;
        fileUrl: string | null;
        fileName: string | null;
        fileType: string | null;
        audioThumbnail: string | null;
        readAt: Date | null;
        deleted: boolean;
        deletedBy: string;
    }[]>;
}

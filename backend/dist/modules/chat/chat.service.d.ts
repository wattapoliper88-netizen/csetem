import { PrismaService } from '../../prisma/prisma.service';
export declare class ChatService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getOrCreateUserConversation(userId: string, adminId: string): Promise<{
        id: string;
        userId: string;
        adminId: string;
        createdAt: Date;
    }>;
    getMyConversation(userId: string, isAdmin: boolean): Promise<{
        id: string;
        userId: string;
        adminId: string;
        createdAt: Date;
    }>;
    listConversationsForAdmin(adminId: string): Promise<({
        user: {
            id: string;
            email: string;
            username: string;
            avatarImage: string;
            verified: boolean;
            isAdmin: boolean;
            lastSeen: Date;
        };
    } & {
        id: string;
        userId: string;
        adminId: string;
        createdAt: Date;
    })[]>;
    getMessages(conversationId: string, userId: string, isAdmin: boolean, limit?: number, cursor?: string): Promise<({
        sender: {
            id: string;
            email: string;
            username: string;
            avatarImage: string;
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
    createMessage(conversationId: string, senderId: string, content: string, isAdmin: boolean, file?: Express.Multer.File, audioThumbnail?: string, fileUrl?: string, fileName?: string, fileType?: string): Promise<{
        sender: {
            id: string;
            email: string;
            username: string;
            avatarImage: string;
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
    getFolders(conversationId: string, userId: string): Promise<{
        id: string;
        name: string;
        icon: string;
        visibility: string;
        createdBy: string;
        closedBy: any;
        messageIds: string[];
    }[]>;
    closeFolder(folderId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        conversationId: string;
        icon: string;
        visibility: string;
        createdBy: string;
        closedBy: string;
    }>;
    deleteMessages(messageIds: string[], userId: string, isAdmin: boolean): Promise<{
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

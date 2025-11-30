import { PrismaService } from '../../prisma/prisma.service';
export declare class ChatService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getOrCreateUserConversation(userId: string, adminId: string): Promise<any>;
    getMyConversation(userId: string, isAdmin: boolean): Promise<any>;
    listConversationsForAdmin(adminId: string): Promise<any>;
    getMessages(conversationId: string, userId: string, isAdmin: boolean, limit?: number, cursor?: string): Promise<any>;
    createMessage(conversationId: string, senderId: string, content: string, isAdmin: boolean, file?: Express.Multer.File, audioThumbnail?: string, fileUrl?: string, fileName?: string, fileType?: string): Promise<any>;
    getLinkPreview(url: string): Promise<{
        url: string;
        title: string;
        description: string;
        image: string;
        siteName: string;
    }>;
    getFolders(conversationId: string, userId: string): Promise<any>;
    closeFolder(folderId: string, userId: string): Promise<any>;
    deleteMessages(messageIds: string[], userId: string, isAdmin: boolean): Promise<any[]>;
}

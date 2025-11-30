import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
export declare class ChatController {
    private chatService;
    private chatGateway;
    constructor(chatService: ChatService, chatGateway: ChatGateway);
    myConversation(req: any): Promise<any>;
    listConversations(req: any): Promise<any>;
    getMessages(req: any, conversationId: string, limit?: number, cursor?: string): Promise<any>;
    sendMessage(req: any, body: {
        conversationId: string;
        content?: string;
        audioThumbnail?: string;
        fileUrl?: string;
        fileName?: string;
        fileType?: string;
    }, file?: Express.Multer.File): Promise<any>;
    getLinkPreview(url: string): Promise<{
        url: string;
        title: string;
        description: string;
        image: string;
        siteName: string;
    }>;
    getFolders(req: any, conversationId: string): Promise<any>;
    closeFolder(req: any, folderId: string): Promise<any>;
    deleteMessages(req: any, body: {
        messageIds: string[];
    }): Promise<any[]>;
}

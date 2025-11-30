import { PrismaService } from '../../prisma/prisma.service';
export declare class UserFolderService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    listFolders(): Promise<any>;
    getFolder(id: string): Promise<any>;
    createFolder(data: {
        name: string;
        parentId?: string | null;
        thumbnail?: string | null;
        createdBy: string;
    }): Promise<any>;
    updateFolder(id: string, data: {
        name?: string;
        thumbnail?: string | null;
    }): Promise<any>;
    deleteFolder(id: string): Promise<any>;
    assignUser(folderId: string, userId: string): Promise<any>;
    unassignUser(folderId: string, userId: string): Promise<any>;
}

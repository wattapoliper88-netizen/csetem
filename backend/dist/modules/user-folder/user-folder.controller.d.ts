import { PrismaService } from '../../prisma/prisma.service';
import { UserFolderService } from './user-folder.service';
export declare class UserFolderController {
    private folderService;
    private prisma;
    constructor(folderService: UserFolderService, prisma: PrismaService);
    private checkAdmin;
    list(req: any): Promise<any>;
    create(req: any, body: {
        name: string;
        parentId?: string;
        thumbnail?: string | null;
    }): Promise<any>;
    update(req: any, folderId: string, body: {
        name?: string;
        thumbnail?: string | null;
    }): Promise<any>;
    delete(req: any, folderId: string): Promise<{
        success: boolean;
    }>;
    assignUser(req: any, folderId: string, userId: string): Promise<any>;
    unassignUser(req: any, folderId: string, userId: string): Promise<{
        success: boolean;
    }>;
}

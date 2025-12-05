import { PrismaService } from '../../prisma/prisma.service';
import { UserFolderService } from './user-folder.service';
export declare class UserFolderController {
    private folderService;
    private prisma;
    constructor(folderService: UserFolderService, prisma: PrismaService);
    private checkAdmin;
    list(req: any): Promise<({
        children: {
            id: string;
            createdAt: Date;
            name: string;
            createdBy: string;
            thumbnail: string | null;
            parentId: string | null;
        }[];
        members: {
            id: string;
            userId: string;
            folderId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string;
        thumbnail: string | null;
        parentId: string | null;
    })[]>;
    create(req: any, body: {
        name: string;
        parentId?: string;
        thumbnail?: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string;
        thumbnail: string | null;
        parentId: string | null;
    }>;
    update(req: any, folderId: string, body: {
        name?: string;
        thumbnail?: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string;
        thumbnail: string | null;
        parentId: string | null;
    }>;
    delete(req: any, folderId: string): Promise<{
        success: boolean;
    }>;
    assignUser(req: any, folderId: string, userId: string): Promise<{
        id: string;
        userId: string;
        folderId: string;
    }>;
    unassignUser(req: any, folderId: string, userId: string): Promise<{
        success: boolean;
    }>;
}

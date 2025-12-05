import { PrismaService } from '../../prisma/prisma.service';
export declare class UserFolderService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    listFolders(): Promise<({
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
    getFolder(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string;
        thumbnail: string | null;
        parentId: string | null;
    }>;
    createFolder(data: {
        name: string;
        parentId?: string | null;
        thumbnail?: string | null;
        createdBy: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string;
        thumbnail: string | null;
        parentId: string | null;
    }>;
    updateFolder(id: string, data: {
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
    deleteFolder(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        createdBy: string;
        thumbnail: string | null;
        parentId: string | null;
    }>;
    assignUser(folderId: string, userId: string): Promise<{
        id: string;
        userId: string;
        folderId: string;
    }>;
    unassignUser(folderId: string, userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
}

import { PrismaService } from '../../prisma/prisma.service';
export declare class UserController {
    private prisma;
    constructor(prisma: PrismaService);
    private checkAdmin;
    me(req: any): Promise<{
        email: string;
        username: string;
        id: string;
        avatarImage: string;
        verified: boolean;
        isAdmin: boolean;
        lastSeen: Date;
    }>;
    updateAvatar(req: any, body: {
        avatarImage: string;
    }): Promise<{
        email: string;
        username: string;
        id: string;
        avatarImage: string;
        verified: boolean;
        isAdmin: boolean;
    }>;
    deleteUser(req: any, userId: string): Promise<{
        success: boolean;
    }>;
    toggleBanUser(req: any, userId: string, body: {
        banned: boolean;
    }): Promise<{
        email: string;
        username: string;
        id: string;
        passwordHash: string;
        avatarImage: string | null;
        verified: boolean;
        isAdmin: boolean;
        lastSeen: Date;
        createdAt: Date;
        updatedAt: Date;
    }>;
    toggleAdmin(req: any, userId: string, body: {
        isAdmin: boolean;
    }): Promise<{
        email: string;
        username: string;
        id: string;
        passwordHash: string;
        avatarImage: string | null;
        verified: boolean;
        isAdmin: boolean;
        lastSeen: Date;
        createdAt: Date;
        updatedAt: Date;
    }>;
}

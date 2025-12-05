import { PrismaService } from '../../prisma/prisma.service';
export declare class UserController {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    private checkAdmin;
    me(req: any): Promise<{
        id: string;
        email: string;
        username: string;
        avatarImage: string;
        verified: boolean;
        isAdmin: boolean;
        lastSeen: Date;
    }>;
    updateAvatar(req: any, body: {
        avatarImage: string;
    }): Promise<{
        id: string;
        email: string;
        username: string;
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
        id: string;
        email: string;
        username: string;
        passwordHash: string;
        avatarImage: string | null;
        verified: boolean;
        isAdmin: boolean;
        lastSeen: Date;
        lastNotificationSentAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    toggleAdmin(req: any, userId: string, body: {
        isAdmin: boolean;
    }): Promise<{
        id: string;
        email: string;
        username: string;
        passwordHash: string;
        avatarImage: string | null;
        verified: boolean;
        isAdmin: boolean;
        lastSeen: Date;
        lastNotificationSentAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}

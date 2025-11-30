import { PrismaService } from '../../prisma/prisma.service';
export declare class UserController {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    private checkAdmin;
    me(req: any): Promise<any>;
    updateAvatar(req: any, body: {
        avatarImage: string;
    }): Promise<any>;
    deleteUser(req: any, userId: string): Promise<{
        success: boolean;
    }>;
    toggleBanUser(req: any, userId: string, body: {
        banned: boolean;
    }): Promise<any>;
    toggleAdmin(req: any, userId: string, body: {
        isAdmin: boolean;
    }): Promise<any>;
}

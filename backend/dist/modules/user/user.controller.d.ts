import { PrismaService } from '../../prisma/prisma.service';
export declare class UserController {
    private prisma;
    constructor(prisma: PrismaService);
    me(req: any): Promise<{
        email: string;
        username: string;
        id: string;
        avatarImage: string | null;
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
        avatarImage: string | null;
        verified: boolean;
        isAdmin: boolean;
    }>;
}

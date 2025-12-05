export declare class EmailService {
    private readonly logger;
    private resend;
    constructor();
    sendVerificationCode(email: string, code: string): Promise<void>;
    sendOfflineNotification(toEmail: string, senderName: string, messageContent: string, senderAvatarUrl?: string | null, conversationId?: string): Promise<void>;
    sendPasswordReset(email: string, tempPassword: string): Promise<void>;
}

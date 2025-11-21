export declare class EmailService {
    private readonly logger;
    sendVerificationCode(email: string, code: string): Promise<void>;
}

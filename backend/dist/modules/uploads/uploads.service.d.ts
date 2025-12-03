export declare class UploadsService {
    private readonly logger;
    constructor();
    initAdmin(): void;
    getSignedUploadUrl(path: string, contentType?: string): Promise<{
        uploadUrl: string;
        path: string;
        readUrl: string;
    }>;
    getReadUrl(pathOrUrl: string): Promise<{
        readUrl: string;
    }>;
    getSignedUrlForPath(path: string): Promise<string | null>;
    getReadUrls(paths: string[]): Promise<Record<string, string>>;
}

import { UploadsService } from './uploads.service';
export declare class UploadsController {
    private readonly uploadsService;
    constructor(uploadsService: UploadsService);
    getDebugInfo(): {
        firebaseInitialized: boolean;
        appCount: any;
        bucketName: string;
        hasServiceAccountJson: boolean;
        hasServiceAccountPath: boolean;
    };
    getSignedUploadUrl(body: {
        path: string;
        contentType?: string;
    }): Promise<{
        uploadUrl: string;
        path: string;
        readUrl: string;
    }>;
    getStorageDebug(prefix?: string): Promise<{
        ok: boolean;
        bucketName: string;
        metadata: any;
        prefix: string;
        count: number;
        files: string[];
        error?: undefined;
    } | {
        ok: boolean;
        bucketName: string;
        metadata: any;
        prefix?: undefined;
        count?: undefined;
        files?: undefined;
        error?: undefined;
    } | {
        ok: boolean;
        error: any;
        bucketName?: undefined;
        metadata?: undefined;
        prefix?: undefined;
        count?: undefined;
        files?: undefined;
    }>;
    getReadUrl(body: {
        path?: string;
        url?: string;
    }): Promise<{
        readUrl: string;
    }>;
    getReadUrls(body: {
        paths: string[];
    }): Promise<Record<string, string>>;
}

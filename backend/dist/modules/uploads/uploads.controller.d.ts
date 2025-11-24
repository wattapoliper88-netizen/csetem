export declare class UploadsController {
    constructor();
    getSignedUploadUrl(body: {
        path: string;
        contentType?: string;
    }): Promise<{
        uploadUrl: string;
        path: string;
        readUrl: string;
    }>;
}

export declare class UploadsController {
    constructor();
    getSignedUploadUrl(body: {
        path: string;
        contentType?: string;
    }): Promise<{
        error: string;
        uploadUrl?: undefined;
        path?: undefined;
    } | {
        uploadUrl: string;
        path: string;
        error?: undefined;
    }>;
}

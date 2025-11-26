import { Request, Response } from 'express';
export declare class MigrationController {
    private readonly logger;
    runMigration(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}

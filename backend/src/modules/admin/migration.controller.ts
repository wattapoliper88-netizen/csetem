import { Controller, Post, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { exec } from 'child_process';
import * as path from 'path';

@Controller('admin')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  @Post('migrate')
  async runMigration(@Req() req: Request, @Res() res: Response) {
    const secret = req.header('x-migration-secret');
    const expected = process.env.MIGRATION_ADMIN_SECRET;
    if (!expected || !secret || secret !== expected) {
      return res.status(HttpStatus.FORBIDDEN).json({ error: 'Forbidden' });
    }

    try {
      // Run the compiled migration script from dist. Use absolute path.
      const projectRoot = path.resolve(__dirname, '../../../..');
      const scriptPath = path.join(projectRoot, 'dist', 'scripts', 'migrate-avatars-to-firebase.js');

      this.logger.log(`Spawning migration: node ${scriptPath}`);

      const child = exec(`node "${scriptPath}"`, { env: process.env }, (error, stdout, stderr) => {
        if (error) {
          this.logger.error('Migration failed', error);
        }
        if (stdout) this.logger.log(stdout);
        if (stderr) this.logger.error(stderr);
      });

      // Stream logs back to caller (best-effort)
      child.stdout?.pipe(res.write.bind(res));
      child.stderr?.pipe(res.write.bind(res));

      // Return accepted and let process run
      return res.status(HttpStatus.ACCEPTED).json({ status: 'Migration started' });
    } catch (err) {
      this.logger.error('Failed to start migration', err as any);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to start migration' });
    }
  }
}

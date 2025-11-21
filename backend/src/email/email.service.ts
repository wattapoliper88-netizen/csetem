import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationCode(email: string, code: string): Promise<void> {
    // Mock email sending - replace with real provider later
    this.logger.log(`Send verification code ${code} to ${email}`);
  }
}

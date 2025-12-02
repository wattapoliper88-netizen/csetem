import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY is not defined. Email sending will be disabled.');
      return;
    }

    this.resend = new Resend(apiKey);
    this.logger.log('Resend client initialized');
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    // Mock email sending - replace with real provider later
    this.logger.log(`Send verification code ${code} to ${email}`);
    // TODO: Implement real sending if needed
  }

  async sendOfflineNotification(toEmail: string, senderName: string, messageContent: string): Promise<void> {
    this.logger.log(`Attempting to send offline notification to ${toEmail}`);
    
    if (!this.resend) {
      this.logger.warn('Resend client not initialized, skipping offline email notification');
      return;
    }

    try {
      // Use onboarding@resend.dev for testing if no custom domain is verified
      // The 'to' address must be the verified email address (usually the one used to sign up)
      // when using the onboarding domain.
      const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
      
      const data = await this.resend.emails.send({
        from: `Csetem Értesítő <${fromEmail}>`,
        to: [toEmail],
        subject: `Új üzeneted érkezett tőle: ${senderName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0891b2;">Új üzeneted érkezett!</h2>
            <p>Szia!</p>
            <p><strong>${senderName}</strong> üzenetet küldött neked, miközben nem voltál elérhető.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #374151; font-style: italic;">"${messageContent}"</p>
            </div>
            <p>Jelentkezz be a válaszadáshoz!</p>
            <a href="${process.env.APP_URL || 'https://csetem.vercel.app'}" style="display: inline-block; background-color: #0891b2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Megnyitás</a>
          </div>
        `,
      });

      if (data.error) {
        this.logger.error('Resend API returned error:', data.error);
        throw new Error(data.error.message);
      }

      this.logger.log(`Offline notification sent to ${toEmail}: ${data.data?.id}`);
    } catch (error) {
      this.logger.error('Failed to send offline notification email', error);
    }
  }
}

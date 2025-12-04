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
    this.logger.log(`Sending verification code to ${email}`);
    
    if (!this.resend) {
      this.logger.warn('Resend client not initialized, skipping verification email');
      // Fallback to logging for development without API key
      this.logger.log(`[DEV] Verification code for ${email}: ${code}`);
      return;
    }

    try {
      const fromEmail = process.env.EMAIL_FROM || 'ertesito@richat.de';
      
      const data = await this.resend.emails.send({
        from: `Richi <${fromEmail}>`,
        to: [email],
        subject: `Richat ellenőrző kód: ${code}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0891b2;">Üdvözöl a Richat!</h2>
            <p>A belépéshez szükséges ellenőrző kódod:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #374151;">${code}</span>
            </div>
            <p>Ez a kód 5 percig érvényes.</p>
            <p>Ha nem te kérted ezt a kódot, hagyd figyelmen kívül ezt az emailt.</p>
          </div>
        `,
      });

      if (data.error) {
        this.logger.error('Resend API returned error:', data.error);
        // Don't throw error to prevent 500 response to client
        // throw new Error(data.error.message);
        this.logger.log(`[FALLBACK] Verification code for ${email}: ${code}`);
        return;
      }

      this.logger.log(`Verification email sent to ${email}: ${data.data?.id}`);
    } catch (error) {
      this.logger.error('Failed to send verification email', error);
      // Fallback logging in case of error
      this.logger.log(`[FALLBACK] Verification code for ${email}: ${code}`);
    }
  }

  async sendOfflineNotification(toEmail: string, senderName: string, messageContent: string, senderAvatarUrl?: string | null): Promise<void> {
    this.logger.log(`Attempting to send offline notification to ${toEmail}`);
    
    if (!this.resend) {
      this.logger.warn('Resend client not initialized, skipping offline email notification');
      return;
    }

    try {
      // Use onboarding@resend.dev for testing if no custom domain is verified
      // The 'to' address must be the verified email address (usually the one used to sign up)
      // when using the onboarding domain.
      const fromEmail = process.env.EMAIL_FROM || 'ertesito@richat.de';
      
      // Use sender's avatar or generate a default one with initials
      const avatarUrl = senderAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0891b2&color=fff`;
      
      const avatarHtml = `<img src="${avatarUrl}" alt="${senderName}" style="width: 60px; height: 60px; border-radius: 50%; display: block; margin: 0 auto 10px auto;">`;

      const data = await this.resend.emails.send({
        from: `Richi <${fromEmail}>`,
        to: [toEmail],
        subject: `Új üzeneted érkezett tőle: ${senderName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
            <h2 style="color: #0891b2;">Új üzeneted érkezett!</h2>
            <p style="text-align: left;">Szia!</p>
            
            <div style="margin: 20px 0;">
              ${avatarHtml}
              <p style="margin: 0; font-size: 16px;">
                <strong>${senderName}</strong> üzenetet küldött neked, miközben nem voltál elérhető.
              </p>
            </div>

            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left;">
              <p style="margin: 0; color: #374151; font-style: italic;">"${messageContent}"</p>
            </div>
            
            <p>Jelentkezz be a válaszadáshoz!</p>
            <a href="${process.env.APP_URL || 'https://richat.de'}" style="display: inline-block; background-color: #0891b2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Megnyitás</a>
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

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = Number(process.env.SMTP_PORT) || 465;
    // If port is 465, default to secure: true. If 587, default to secure: false.
    // Allow overriding via SMTP_SECURE env var.
    const secure = process.env.SMTP_SECURE 
      ? process.env.SMTP_SECURE === 'true' 
      : port === 465;

    this.logger.log(`Configuring SMTP: Host=${process.env.SMTP_HOST || 'smtp.gmail.com'}, Port=${port}, Secure=${secure}, User=${process.env.SMTP_USER}`);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: port,
      secure: secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false 
      },
      connectionTimeout: 10000, // 10 seconds timeout
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('SMTP Connection Error:', error);
      } else {
        this.logger.log('SMTP Server is ready to take our messages');
      }
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    // Mock email sending - replace with real provider later
    this.logger.log(`Send verification code ${code} to ${email}`);
    // TODO: Implement real sending if needed
  }

  async sendOfflineNotification(toEmail: string, senderName: string, messageContent: string): Promise<void> {
    this.logger.log(`Attempting to send offline notification to ${toEmail}`);
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      this.logger.warn('SMTP not configured, skipping offline email notification');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Csetem Értesítő" <${process.env.SMTP_USER}>`,
        to: toEmail,
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
      this.logger.log(`Offline notification sent to ${toEmail}: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Failed to send offline notification email', error);
    }
  }
}

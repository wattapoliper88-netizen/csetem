import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    console.log(`[EmailService] Initializing with Host=${host}, User=${user ? '***' : 'MISSING'}, Pass=${pass ? '***' : 'MISSING'}`);

    if (host === 'smtp.gmail.com') {
      // Use the built-in 'gmail' service preset which handles port/secure automatically
      this.logger.log('Using Gmail service preset with IPv4 enforcement');
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: pass,
        },
        // Force IPv4 to avoid IPv6 timeout issues in some cloud environments
        // @ts-ignore: 'family' is a valid option for the underlying socket but missing in some type definitions
        family: 4,
        logger: true, // Enable internal nodemailer logging
        debug: true   // Enable debug output
      } as nodemailer.TransportOptions);
    } else {
      // Custom SMTP configuration
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE === 'true';
      
      this.logger.log(`Using custom SMTP config: Port=${port}, Secure=${secure}`);
      this.transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure,
        auth: {
          user: user,
          pass: pass,
        },
        tls: {
          rejectUnauthorized: false 
        },
      });
    }

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('[EmailService] SMTP Connection Error (Verify):', error);
        this.logger.error('SMTP Connection Error:', error);
      } else {
        console.log('[EmailService] SMTP Server is ready to take our messages');
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

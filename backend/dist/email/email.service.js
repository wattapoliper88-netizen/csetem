"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const resend_1 = require("resend");
let EmailService = EmailService_1 = class EmailService {
    constructor() {
        this.logger = new common_1.Logger(EmailService_1.name);
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            this.logger.warn('RESEND_API_KEY is not defined. Email sending will be disabled.');
            return;
        }
        this.resend = new resend_1.Resend(apiKey);
        this.logger.log('Resend client initialized');
    }
    async sendVerificationCode(email, code) {
        this.logger.log(`Send verification code ${code} to ${email}`);
    }
    async sendOfflineNotification(toEmail, senderName, messageContent) {
        var _a;
        this.logger.log(`Attempting to send offline notification to ${toEmail}`);
        if (!this.resend) {
            this.logger.warn('Resend client not initialized, skipping offline email notification');
            return;
        }
        try {
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
            this.logger.log(`Offline notification sent to ${toEmail}: ${(_a = data.data) === null || _a === void 0 ? void 0 : _a.id}`);
        }
        catch (error) {
            this.logger.error('Failed to send offline notification email', error);
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EmailService);
//# sourceMappingURL=email.service.js.map
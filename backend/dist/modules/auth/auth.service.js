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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const bcrypt = require("bcrypt");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const email_service_1 = require("../../email/email.service");
const crypto = require("crypto");
let AuthService = class AuthService {
    constructor(prisma, jwtService, config, emailService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.config = config;
        this.emailService = emailService;
    }
    hash(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }
    addMinutes(date, minutes) {
        return new Date(date.getTime() + minutes * 60000);
    }
    async register(dto) {
        console.log('Register attempt:', { email: dto.email, username: dto.username });
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: dto.email }, { username: dto.username }] },
        });
        console.log('Existing user found:', existing);
        if (existing) {
            throw new common_1.BadRequestException('Email or username already in use');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                username: dto.username,
                passwordHash,
                verified: true,
                isAdmin: false,
            },
        });
        const admin = await this.prisma.user.findFirst({ where: { isAdmin: true } });
        if (admin) {
            await this.prisma.conversation.create({
                data: {
                    userId: user.id,
                    adminId: admin.id,
                },
            });
            console.log('✅ Conversation created for new user with admin:', { userId: user.id, adminId: admin.id });
        }
        const tokens = this.issueTokens(user.id, user.isAdmin);
        return { user: { id: user.id, email: user.email, username: user.username }, ...tokens };
    }
    async forgotPassword(email) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new common_1.BadRequestException('Nincs ilyen email cím');
        }
        const tempPassword = crypto.randomBytes(8).toString('base64url').slice(0, 10);
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });
        await this.emailService.sendPasswordReset(email, tempPassword);
        return { message: 'Új jelszó elküldve' };
    }
    async verifyCode(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user)
            throw new common_1.BadRequestException('Invalid email or code');
        const vc = await this.prisma.verificationCode.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });
        if (!vc)
            throw new common_1.BadRequestException('No verification code found');
        if (new Date() > vc.expiresAt) {
            throw new common_1.BadRequestException('Verification code expired');
        }
        const codeHash = this.hash(dto.code);
        if (codeHash !== vc.codeHash) {
            throw new common_1.BadRequestException('Invalid verification code');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { verified: true },
        });
        await this.prisma.verificationCode.delete({ where: { id: vc.id } });
        const tokens = this.issueTokens(user.id, user.isAdmin);
        return { user: { id: user.id, email: user.email, username: user.username }, ...tokens };
    }
    async login(dto) {
        const start = Date.now();
        console.log('Login attempt:', { username: dto.username, time: new Date().toISOString() });
        const userStart = Date.now();
        const user = await this.prisma.user.findUnique({
            where: { username: dto.username },
        });
        console.log('User found:', user ? { id: user.id, username: user.username, verified: user.verified } : null, 'db_ms=', Date.now() - userStart);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const compareStart = Date.now();
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        console.log('Password valid:', valid, 'bcrypt_ms=', Date.now() - compareStart);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const tokens = this.issueTokens(user.id, user.isAdmin);
        console.log('Issued tokens in ms:', Date.now() - start);
        return { user: { id: user.id, email: user.email, username: user.username }, ...tokens };
    }
    async refreshTokens(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.config.get('JWT_REFRESH_SECRET'),
            });
            const tokens = this.issueTokens(payload.sub, payload.isAdmin);
            return tokens;
        }
        catch (e) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    issueTokens(userId, isAdmin) {
        const payload = { sub: userId, isAdmin };
        const accessToken = this.jwtService.sign(payload, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: '15m',
        });
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });
        return { accessToken, refreshToken };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        email_service_1.EmailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
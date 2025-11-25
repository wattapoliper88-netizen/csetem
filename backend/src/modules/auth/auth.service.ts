import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  private hash(str: string) {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  async register(dto: RegisterDto) {
    console.log('Register attempt:', { email: dto.email, username: dto.username });
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    console.log('Existing user found:', existing);
    if (existing) {
      throw new BadRequestException('Email or username already in use');
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

    // Automatically create conversation with admin
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

  async verifyCode(dto: VerifyCodeDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('Invalid email or code');

    const vc = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!vc) throw new BadRequestException('No verification code found');

    if (new Date() > vc.expiresAt) {
      throw new BadRequestException('Verification code expired');
    }

    const codeHash = this.hash(dto.code);
    if (codeHash !== vc.codeHash) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verified: true },
    });
    await this.prisma.verificationCode.delete({ where: { id: vc.id } });

    const tokens = this.issueTokens(user.id, user.isAdmin);
    return { user: { id: user.id, email: user.email, username: user.username }, ...tokens };
  }

  async login(dto: LoginDto) {
    console.log('Login attempt:', { username: dto.username });
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    console.log('User found:', user ? { id: user.id, username: user.username, verified: user.verified } : null);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    // Eltávolítva a verified ellenőrzés - tiltott userek is be tudnak jelentkezni

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    console.log('Password valid:', valid);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = this.issueTokens(user.id, user.isAdmin);
    return { user: { id: user.id, email: user.email, username: user.username }, ...tokens };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      // Issue new tokens for the user
      const tokens = this.issueTokens(payload.sub, payload.isAdmin);
      return tokens;
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private issueTokens(userId: string, isAdmin: boolean) {
    const payload = { sub: userId, isAdmin };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }
}

import { Controller, Get, Put, Req, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async me(@Req() req: any) {
    // Update lastSeen on every request
    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data: { lastSeen: new Date() },
      select: { id: true, email: true, username: true, isAdmin: true, verified: true, avatarImage: true, lastSeen: true },
    });
    return user;
  }

  @Put('avatar')
  async updateAvatar(@Req() req: any, @Body() body: { avatarImage: string }) {
    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data: { avatarImage: body.avatarImage },
      select: { id: true, email: true, username: true, isAdmin: true, verified: true, avatarImage: true },
    });
    return user;
  }
}

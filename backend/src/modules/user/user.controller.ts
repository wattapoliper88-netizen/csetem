import { Controller, Get, Put, Req, UseGuards, Body, Delete, Param, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private prisma: PrismaService) {}

  private async checkAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

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

  @Delete('admin/user/:userId')
  async deleteUser(@Req() req: any, @Param('userId') userId: string) {
    await this.checkAdmin(req.user.userId);
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  @Put('admin/user/:userId/ban')
  async banUser(@Req() req: any, @Param('userId') userId: string) {
    await this.checkAdmin(req.user.userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { verified: false },
    });
    return user;
  }

  @Put('admin/user/:userId/admin')
  async toggleAdmin(@Req() req: any, @Param('userId') userId: string, @Body() body: { isAdmin: boolean }) {
    await this.checkAdmin(req.user.userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isAdmin: body.isAdmin },
    });
    return user;
  }
}

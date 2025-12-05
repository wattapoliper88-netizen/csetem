import { Controller, Get, Put, Req, UseGuards, Body, Delete, Param, ForbiddenException, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);
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

  @Put('username')
  async updateUsername(@Req() req: any, @Body() body: { username: string }) {
    const exists = await this.prisma.user.findFirst({ where: { username: body.username } });
    if (exists && exists.id !== req.user.userId) {
      throw new ForbiddenException('A felhasználónév már foglalt');
    }
    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data: { username: body.username },
      select: { id: true, email: true, username: true, isAdmin: true, verified: true, avatarImage: true },
    });
    return user;
  }

  @Put('password')
  async updatePassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) throw new ForbiddenException('Nincs ilyen felhasználó');

    const match = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!match) {
      throw new ForbiddenException('A jelenlegi jelszó nem egyezik');
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return { success: true };
  }

  @Delete('admin/user/:userId')
  async deleteUser(@Req() req: any, @Param('userId') userId: string) {
    await this.checkAdmin(req.user.userId);
    // To avoid foreign key constraint failures, clean up related records first.
    try {
      // Find conversations where the user participates as user or admin
      const convs = await this.prisma.conversation.findMany({ where: { OR: [{ userId }, { adminId: userId }] }, select: { id: true } });
      const convIds = convs.map(c => c.id);

      // Gather message ids in these conversations
      const msgRecords = convIds.length > 0 ? await this.prisma.message.findMany({ where: { conversationId: { in: convIds } }, select: { id: true } }) : [];
      const msgIds = msgRecords.map(m => m.id);

      // Delete folder-message relations for those messages
      const ops: any[] = [];
      if (msgIds.length > 0) ops.push(this.prisma.folderMessage.deleteMany({ where: { messageId: { in: msgIds } } }));
      if (convIds.length > 0) ops.push(this.prisma.folder.deleteMany({ where: { conversationId: { in: convIds } } }));
      if (convIds.length > 0) ops.push(this.prisma.message.deleteMany({ where: { conversationId: { in: convIds } } }));
      if (convIds.length > 0) ops.push(this.prisma.conversation.deleteMany({ where: { id: { in: convIds } } }));

      // Delete messages where user is the sender (in other conversations)
      ops.push(this.prisma.message.deleteMany({ where: { senderId: userId } }));

      // Finally delete the user
      ops.push(this.prisma.user.delete({ where: { id: userId } }));

      await this.prisma.$transaction(ops);
      this.logger.log(`Deleted user and cleaned up related records for userId=${userId}`);
    } catch (error) {
      // Log the error with details for debugging and return server error
      this.logger.error('Failed to delete user or related entities: ' + (error instanceof Error ? error.message : JSON.stringify(error)), JSON.stringify(error));
      throw new Error('Failed to delete user due to related data. Please check server logs.');
    }
    return { success: true };
  }

  @Put('admin/user/:userId/ban')
  async toggleBanUser(@Req() req: any, @Param('userId') userId: string, @Body() body: { banned: boolean }) {
    await this.checkAdmin(req.user.userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { verified: !body.banned },
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

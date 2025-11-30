import { Controller, Get, Req, UseGuards, Post, Body, Delete, Param, Put } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UserFolderService } from './user-folder.service';

@Controller('me/admin/user-folders')
@UseGuards(JwtAuthGuard)
export class UserFolderController {
  constructor(private folderService: UserFolderService, private prisma: PrismaService) {}

  private async checkAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) throw new Error('Admin access required');
  }

  @Get()
  async list(@Req() req: any) {
    await this.checkAdmin(req.user.userId);
    return this.folderService.listFolders();
  }

  @Post()
  async create(@Req() req: any, @Body() body: { name: string; parentId?: string; thumbnail?: string | null }) {
    await this.checkAdmin(req.user.userId);
    return this.folderService.createFolder({ name: body.name, parentId: body.parentId || null, thumbnail: body.thumbnail || null, createdBy: req.user.userId });
  }

  @Put(':folderId')
  async update(@Req() req: any, @Param('folderId') folderId: string, @Body() body: { name?: string; thumbnail?: string | null }) {
    await this.checkAdmin(req.user.userId);
    return this.folderService.updateFolder(folderId, { name: body.name, thumbnail: body.thumbnail || null });
  }

  @Delete(':folderId')
  async delete(@Req() req: any, @Param('folderId') folderId: string) {
    await this.checkAdmin(req.user.userId);
    await this.folderService.deleteFolder(folderId);
    return { success: true };
  }

  @Post(':folderId/users/:userId')
  async assignUser(@Req() req: any, @Param('folderId') folderId: string, @Param('userId') userId: string) {
    await this.checkAdmin(req.user.userId);
    return this.folderService.assignUser(folderId, userId);
  }

  @Delete(':folderId/users/:userId')
  async unassignUser(@Req() req: any, @Param('folderId') folderId: string, @Param('userId') userId: string) {
    await this.checkAdmin(req.user.userId);
    await this.folderService.unassignUser(folderId, userId);
    return { success: true };
  }
}

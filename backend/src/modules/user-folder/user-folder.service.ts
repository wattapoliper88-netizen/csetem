import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserFolderService {
  private readonly logger = new Logger(UserFolderService.name);
  constructor(private prisma: PrismaService) {}

  async listFolders() {
    // Return a tree-like structure by eager loading children and members
    const folders = await this.prisma.userFolder.findMany({
      include: { children: true, members: true },
    });
    return folders;
  }

  async getFolder(id: string) {
    return this.prisma.userFolder.findUnique({ where: { id } });
  }

  async createFolder(data: { name: string; parentId?: string | null; thumbnail?: string | null; createdBy: string }) {
    return this.prisma.userFolder.create({ data: { name: data.name, parentId: data.parentId || null, thumbnail: data.thumbnail || null, createdBy: data.createdBy } });
  }

  async updateFolder(id: string, data: { name?: string; thumbnail?: string | null }) {
    return this.prisma.userFolder.update({ where: { id }, data: { name: data.name, thumbnail: data.thumbnail } });
  }

  async deleteFolder(id: string) {
    // Deleting the folder will cascade to child folders and members due to the Prisma schema
    return this.prisma.userFolder.delete({ where: { id } });
  }

  async assignUser(folderId: string, userId: string) {
    return this.prisma.userFolderMember.create({ data: { folderId, userId } });
  }

  async unassignUser(folderId: string, userId: string) {
    return this.prisma.userFolderMember.deleteMany({ where: { folderId, userId } });
  }
}

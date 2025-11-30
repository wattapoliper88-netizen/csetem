import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserFolderService } from './user-folder.service';
import { UserFolderController } from './user-folder.controller';

@Module({
  controllers: [UserFolderController],
  providers: [UserFolderService, PrismaService],
  exports: [UserFolderService],
})
export class UserFolderModule {}

import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../../email/email.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [PrismaModule, JwtModule.register({}), EmailModule, UploadsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}

import { HealthModule } from './modules/health/health.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ChatModule } from './modules/chat/chat.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),
    PrismaModule,
    EmailModule,
    AuthModule,
    UserModule,
    ChatModule,
    require('./modules/admin/admin.module').AdminModule,
    // Uploads module provides signed upload URLs for Firebase Storage
    // (created to avoid CORS issues when frontend uploads directly to Firebase)
    require('./modules/uploads/uploads.module').UploadsModule,
    HealthModule,
  ],
})
export class AppModule {}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    const start = Date.now();
    await this.$connect();
    console.log('Prisma connected in ms=', Date.now() - start, 'pid=', process.pid, 'uptime=', process.uptime());
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Prisma disconnected pid=', process.pid, 'uptime=', process.uptime());
  }
}

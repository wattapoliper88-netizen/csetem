import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      uptime: process.uptime(),
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      now: new Date().toISOString(),
    };
  }
}

export default HealthController;

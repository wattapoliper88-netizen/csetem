import { Controller, Get, Options, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller()
export class StatusController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Options('messages')
  optionsMessages(@Req() req: Request, @Res() res: Response) {
    const origin = (req.headers.origin as string) || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.sendStatus(204);
  }
}

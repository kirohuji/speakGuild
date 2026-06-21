import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { DailyPracticeService } from './daily-practice.service';

@Controller('practice/daily-practice')
export class DailyPracticeController {
  constructor(private readonly service: DailyPracticeService) {}

  @Get('settings')
  async settings() {
    return this.service.getSettings();
  }

  @Post('progress')
  async progress(@Req() req: Request, @Body() body: { itemIds?: string[] }) {
    const session = await requireAuthSession(req);
    return this.service.getProgress(session.user.id, body.itemIds);
  }

  @Post('complete')
  async complete(@Req() req: Request, @Body() body: any) {
    const session = await requireAuthSession(req);
    return this.service.complete(session.user.id, body);
  }
}

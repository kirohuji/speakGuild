import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { DailyPracticeService } from './daily-practice.service';

@Controller('practice/daily-practice')
export class DailyPracticeController {
  constructor(private readonly service: DailyPracticeService) {}

  @Post('progress')
  async progress(@Req() req: Request, @Body() body: { itemIds?: string[] }) {
    const session = await requireAuthSession(req);
    return this.service.getProgress(session.user.id, body.itemIds);
  }

  /**
   * The Today screen needs an authoritative recovery read before it creates a
   * plan.  This is intentionally separate from the generic incremental sync
   * cursor: logging out clears that cursor along with local data.
   */
  @Get('run')
  async currentRun(
    @Req() req: Request,
    @Query('date') date: string,
    @Query('mode') mode: 'practice' | 'review',
    @Query('scope') scope: 'single' | 'mixed',
    @Query('packId') packId?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.service.getCurrentRun(session.user.id, { date, mode, scope, packId });
  }

  @Post('complete')
  async complete(@Req() req: Request, @Body() body: any) {
    const session = await requireAuthSession(req);
    return this.service.complete(session.user.id, body);
  }

  @Post('activity')
  async recordActivity(@Req() req: Request, @Body() body: any) {
    const session = await requireAuthSession(req);
    return this.service.recordActivity(session.user.id, body);
  }
}

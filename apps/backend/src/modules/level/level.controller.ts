import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LevelService } from './level.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('api/v1/level')
export class LevelController {
  constructor(private readonly levelService: LevelService) {}

  @Get('overview')
  async getOverview(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.levelService.getOverview(session.user.id);
  }

  @Get('weekly-stats')
  async getWeeklyStats(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.levelService.getWeeklyStats(session.user.id);
  }

  @Get('common-errors')
  async getCommonErrors(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.levelService.getCommonErrors(session.user.id);
  }

  @Get('recommended-path')
  async getRecommendedPath(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.levelService.getRecommendedPath(session.user.id);
  }
}

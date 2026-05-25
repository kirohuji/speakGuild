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
}

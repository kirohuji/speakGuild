import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProfileService } from './profile.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('overview')
  async getOverview(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.profileService.getOverview(session.user.id);
  }

  @Get('activity-heatmap')
  async getActivityHeatmap(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.profileService.getActivityHeatmap(session.user.id);
  }

  @Get('practice-records')
  async getPracticeRecords(
    @Req() req: Request,
    @Query() pagination: PaginationDto,
  ) {
    const session = await requireAuthSession(req);
    return this.profileService.getPracticeRecords(session.user.id, pagination);
  }
}

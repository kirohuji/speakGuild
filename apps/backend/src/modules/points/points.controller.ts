import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PointsService } from './points.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  /** 获取积分余额 */
  @Get('balance')
  async getBalance(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.pointsService.getBalance(session.user.id);
  }

  /** 获取今日签到状态 */
  @Get('check-in/status')
  async getCheckInStatus(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.pointsService.getCheckInStatus(session.user.id);
  }

  /** 获取签到日历 */
  @Get('check-in/calendar')
  async getCheckInCalendar(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.pointsService.getCheckInCalendar(session.user.id, startDate, endDate);
  }

  /** 每日签到 */
  @Post('check-in')
  async checkIn(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.pointsService.checkIn(session.user.id);
  }

  /** 积分流水 */
  @Get('transactions')
  async getTransactions(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.pointsService.getTransactions(
      session.user.id,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
    );
  }
}

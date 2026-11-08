import { Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MembershipService } from './membership.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('plans')
  getPlans() {
    return this.membershipService.getPlans();
  }

  @Get('current')
  async getCurrentMembership(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.membershipService.getCurrentMembership(session.user.id);
  }

  @Get('benefits')
  getBenefits() {
    return this.membershipService.getBenefits();
  }

  /**
   * 客户端不上传 CustomerInfo，服务端只根据已认证的用户 ID 向 RevenueCat 查询。
   * 购买/恢复后调用，用于弥补 webhook 传播延迟。
   */
  @Post('revenuecat/sync')
  async syncRevenueCatMembership(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.membershipService.syncRevenueCatMembership(session.user.id);
  }
}

import { Controller, Get, Req } from '@nestjs/common';
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
}

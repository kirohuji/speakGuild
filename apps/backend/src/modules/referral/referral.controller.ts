import { Controller, Get, Post, Body, Req } from '@nestjs/common'
import type { Request } from 'express'
import { ReferralService } from './referral.service'
import { requireAuthSession } from '../auth/session.util'

@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('code')
  async getCode(@Req() req: Request) {
    const session = await requireAuthSession(req)
    return this.referralService.getOrCreateCode(session.user.id)
  }

  @Get('stats')
  async stats(@Req() req: Request) {
    const session = await requireAuthSession(req)
    return this.referralService.getReferralStats(session.user.id)
  }

  @Post('apply')
  async apply(@Req() req: Request, @Body() body: { code: string }) {
    const session = await requireAuthSession(req)
    return this.referralService.applyReferral(session.user.id, body.code)
  }
}

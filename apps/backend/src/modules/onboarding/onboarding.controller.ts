import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OnboardingService } from './onboarding.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  async getStatus(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.onboardingService.getStatus(session.user.id);
  }

  @Post('goals')
  async selectGoals(@Req() req: Request, @Body() body: { goals: string[] }) {
    const session = await requireAuthSession(req);
    return this.onboardingService.selectGoals(session.user.id, body.goals);
  }

  @Post('ability')
  async selectAbility(@Req() req: Request, @Body() body: { outputLevel: string }) {
    const session = await requireAuthSession(req);
    return this.onboardingService.selectAbility(session.user.id, body.outputLevel);
  }

  @Post('diagnostic/result')
  async submitDiagnostic(@Req() req: Request, @Body() body: any) {
    const session = await requireAuthSession(req);
    return this.onboardingService.submitDiagnostic(session.user.id, body);
  }
}

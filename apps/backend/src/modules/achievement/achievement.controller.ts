import { Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { AchievementService } from './achievement.service'
import { requireAuthSession } from '../auth/session.util'

@Controller('achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  async getAll() {
    return this.achievementService.getAll()
  }

  @Get('mine')
  async mine(@Req() req: Request) {
    const session = await requireAuthSession(req)
    return this.achievementService.getUserAchievements(session.user.id)
  }

  @Post('check')
  async check(@Req() req: Request) {
    const session = await requireAuthSession(req)
    const newlyUnlocked = await this.achievementService.checkAndUnlock(session.user.id)
    return { unlocked: newlyUnlocked }
  }
}

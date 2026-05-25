import { Controller, Get, Param, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { AchievementService } from './achievement.service'
import { AchievementEngineService } from './achievement-engine.service'
import { requireAuthSession } from '../auth/session.util'

@Controller('api/v1/achievements')
export class AchievementController {
  constructor(
    private readonly achievementService: AchievementService,
    private readonly achievementEngine: AchievementEngineService,
  ) {}

  // ---- V1 (legacy, kept for backward compatibility) ----
  @Get('legacy')
  async getAllLegacy() {
    return this.achievementService.getAll()
  }

  @Get('legacy/mine')
  async mineLegacy(@Req() req: Request) {
    const session = await requireAuthSession(req)
    return this.achievementService.getUserAchievements(session.user.id)
  }

  // ---- V2 (new achievement system) ----
  @Get()
  async getAll(@Req() req: Request) {
    const session = await requireAuthSession(req)
    return this.achievementEngine.getAllWithUserStatus(session.user.id)
  }

  @Get('unlocked')
  async getUnlocked(@Req() req: Request) {
    const session = await requireAuthSession(req)
    const all = await this.achievementEngine.getAllWithUserStatus(session.user.id)
    return all.filter(
      (a: any) => a.userStatus === 'unlocked' || a.userStatus === 'seen',
    )
  }

  @Post(':id/seen')
  async markSeen(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req)
    return this.achievementEngine.markSeen(session.user.id, id)
  }

  @Post('check')
  async check(@Req() req: Request) {
    const session = await requireAuthSession(req)
    // Trigger a full check — in production, this is event-driven
    const newlyUnlocked: string[] = []
    return { unlocked: newlyUnlocked }
  }
}

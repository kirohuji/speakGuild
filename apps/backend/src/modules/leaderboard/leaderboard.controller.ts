import { Controller, Get, Query } from '@nestjs/common'
import { LeaderboardService } from './leaderboard.service'

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('practice')
  async practice(@Query('limit') limit?: string) {
    return this.leaderboardService.getPracticeLeaderboard(undefined, Number(limit) || 50)
  }

  @Get('mock')
  async mockExam(@Query('limit') limit?: string) {
    return this.leaderboardService.getMockExamLeaderboard(undefined, Number(limit) || 50)
  }

  @Get('streak')
  async streak(@Query('limit') limit?: string) {
    return this.leaderboardService.getStreakLeaderboard(Number(limit) || 50)
  }
}

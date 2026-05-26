import { Controller, Get, Param, Post, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LearningService } from './learning.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  /** 获取全部教材（学习单元）列表 */
  @Get('units')
  async getUnits(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.learningService.getLearningUnits(session.user.id);
  }

  /** 获取学习单元详情（顺序学习内容） */
  @Get('units/:id')
  async getUnitDetail(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.learningService.getLearningUnitDetail(session.user.id, id);
  }

  /** 获取今日任务 */
  @Get('today')
  async getTodayTasks(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.learningService.getTodayTasks(session.user.id);
  }

  /** 更新学习单元进度 */
  @Post('units/:id/progress')
  async updateProgress(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: {
      vocabLearned?: number;
      chunkMastered?: number;
      completedPractice?: boolean;
      completedScript?: boolean;
    },
  ) {
    const session = await requireAuthSession(req);
    return this.learningService.updateUnitProgress(session.user.id, id, body);
  }

  /** 开始学习一个单元 */
  @Post('units/:id/start')
  async startUnit(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.learningService.startUnit(session.user.id, id);
  }
}

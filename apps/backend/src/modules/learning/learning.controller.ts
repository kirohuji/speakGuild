import { Controller, Delete, Get, Param, Post, Body, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LearningService } from './learning.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  /** 获取全部教材分类标签（供筛选下拉使用） */
  @Get('tags')
  async getTags() {
    return this.learningService.getTags();
  }

  /** 获取全部教材（学习单元）列表，支持分页、按分类标签过滤和模糊搜索 */
  @Get('units')
  async getUnits(
    @Req() req: Request,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const session = await requireAuthSession(req);
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const size = Math.min(50, Math.max(1, parseInt(pageSize || '20', 10) || 20));
    return this.learningService.getLearningUnits(session.user.id, tag, search, pageNum, size);
  }

  /** 获取用户正在学习的单元（有进度记录的） */
  @Get('my-units')
  async getMyUnits(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.learningService.getMyLearningUnits(session.user.id);
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

  /** 退出学习一个单元 */
  @Delete('units/:id')
  async quitUnit(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.learningService.quitUnit(session.user.id, id);
  }
}

import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EnglishPracticeService } from './english-practice.service';
import { SubmitRecordingDto, SaveExpressionDto } from './dto/english-practice.dto';
import { requireAuthSession } from '../auth/session.util';

/** 英语输出训练 — 练习模式 API */
@Controller('api/v1/practice')
export class EnglishPracticeController {
  constructor(private readonly practiceService: EnglishPracticeService) {}

  /** 获取场景下的训练话题列表 */
  @Get('topics')
  async getTopics(@Query('sceneId') sceneId: string) {
    return this.practiceService.getTopicsByScene(sceneId);
  }

  /** 话题详情（词汇预热 + Chunk 激活 + 句型骨架） */
  @Get('topics/:id')
  async getTopicDetail(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.practiceService.getTopicDetail(id, session.user.id);
  }

  /** 提交录音转写（记录练习行为） */
  @Post('topics/:id/record')
  async submitRecording(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitRecordingDto,
  ) {
    const session = await requireAuthSession(req);
    return this.practiceService.submitRecording(session.user.id, { ...dto, topicId: id });
  }

  /** 保存表达到表达库 */
  @Post('topics/:id/save')
  async saveExpression(
    @Req() req: Request,
    @Body() dto: SaveExpressionDto,
  ) {
    const session = await requireAuthSession(req);
    return this.practiceService.saveExpression(session.user.id, dto);
  }
}

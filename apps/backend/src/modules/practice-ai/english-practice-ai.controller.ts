import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { EnglishPracticeAiService } from './english-practice-ai.service';
import { EnglishFeedbackDto, EnglishUpgradeDto } from './dto/english-feedback.dto';

/** 英语输出训练 — AI 纠错 & 表达升级 */
@Controller('practice-ai')
export class EnglishPracticeAiController {
  constructor(private readonly service: EnglishPracticeAiService) {}

  /** SSE 流式纠错反馈 */
  @Post('feedback')
  async streamFeedback(@Body() dto: EnglishFeedbackDto, @Res() res: Response) {
    await this.service.streamFeedback(dto, res);
  }

  /** 表达升级（非流式） */
  @Post('upgrade')
  async upgradeExpression(@Body() dto: EnglishUpgradeDto) {
    return this.service.upgradeExpression(dto);
  }
}

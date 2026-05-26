import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import type { Request } from 'express';
import { EnglishPracticeAiService } from './english-practice-ai.service';
import { DialogueSummaryDto, DialogueTurnJudgeDto, EnglishFeedbackDto, EnglishUpgradeDto } from './dto/english-feedback.dto';
import { EnglishPracticeService } from '../practice/english-practice.service';
import { requireAuthSession } from '../auth/session.util';

/** 英语输出训练 — AI 纠错 & 表达升级 & 对话汇总 */
@Controller('practice-ai')
export class EnglishPracticeAiController {
  constructor(
    private readonly service: EnglishPracticeAiService,
    private readonly practiceService: EnglishPracticeService,
  ) {}

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

  /** 单轮开放式 NPC 对话输入判定 */
  @Post('dialogue-turn')
  async judgeDialogueTurn(@Req() req: Request, @Body() dto: DialogueTurnJudgeDto) {
    await requireAuthSession(req);
    return this.service.judgeDialogueTurn(dto);
  }

  /** 对话汇总分析 */
  @Post('dialogue-summary')
  async summarizeDialogue(@Req() req: Request, @Body() dto: DialogueSummaryDto) {
    const session = await requireAuthSession(req);
    // Fetch dialogue records for this topic
    const dialogues = await this.practiceService.getTopicDialogues(dto.topicId, session.user.id);

    return this.service.summarizeDialogue({
      topicTitle: dto.topicTitle,
      promptEn: dto.promptEn,
      dialogues,
      objectives: dto.objectives ?? [],
      coreChunks: dto.coreChunks ?? [],
    });
  }
}

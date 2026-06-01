import { Body, Controller, Param, Post, Req, Res, HttpException } from '@nestjs/common';
import { Response } from 'express';
import type { Request } from 'express';
import { EnglishPracticeAiService } from './english-practice-ai.service';
import { DialogueSummaryDto, DialogueTurnJudgeDto, EnglishFeedbackDto, EnglishUpgradeDto } from './dto/english-feedback.dto';
import { EnglishPracticeService } from '../practice/english-practice.service';
import { requireAuthSession } from '../auth/session.util';
import { AiQuotaService } from '../../common/ai-quota/ai-quota.service';

/** 英语输出训练 — AI 纠错 & 表达升级 & 对话汇总 */
@Controller('practice-ai')
export class EnglishPracticeAiController {
  constructor(
    private readonly service: EnglishPracticeAiService,
    private readonly practiceService: EnglishPracticeService,
    private readonly quotaService: AiQuotaService,
  ) {}

  /** SSE 流式纠错反馈 */
  @Post('feedback')
  async streamFeedback(@Req() req: Request, @Body() dto: EnglishFeedbackDto, @Res() res: Response) {
    const session = await requireAuthSession(req);
    const check = await this.quotaService.checkAndDeduct(session.user.id, 'feedback');
    if (!check.allowed) {
      return res.status(403).json({
        code: 403,
        message: check.message,
        data: { remaining: 0, canExchange: true, exchangeCost: check.exchangeCost },
      });
    }
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
    const session = await requireAuthSession(req);
    const check = await this.quotaService.checkAndDeduct(session.user.id, 'dialogue');
    if (!check.allowed) {
      throw new HttpException(
        { code: 403, message: check.message, data: { canExchange: true, exchangeCost: check.exchangeCost } },
        403,
      );
    }
    return this.service.judgeDialogueTurn(dto);
  }

  /** 对话汇总分析 */
  @Post('dialogue-summary')
  async summarizeDialogue(@Req() req: Request, @Body() dto: DialogueSummaryDto) {
    const session = await requireAuthSession(req);
    const check = await this.quotaService.checkAndDeduct(session.user.id, 'summary');
    if (!check.allowed) {
      throw new HttpException(
        { code: 403, message: check.message, data: { canExchange: true, exchangeCost: check.exchangeCost } },
        403,
      );
    }
    const providedDialogues = Array.isArray(dto.dialogues) ? dto.dialogues : [];
    const dialogues = providedDialogues.length > 0
      ? providedDialogues
      : await this.practiceService.getTopicDialogues(dto.topicId, session.user.id);

    return this.service.summarizeDialogue({
      topicTitle: dto.topicTitle,
      promptEn: dto.promptEn,
      dialogues,
      objectives: dto.objectives ?? [],
      coreChunks: dto.coreChunks ?? [],
    });
  }

  @Post('sessions/:sessionId/analyze')
  async analyzePracticeSession(@Req() req: Request, @Param('sessionId') sessionId: string) {
    const session = await requireAuthSession(req);
    const check = await this.quotaService.checkAndDeduct(session.user.id, 'summary');
    if (!check.allowed) {
      throw new HttpException(
        { code: 403, message: check.message, data: { canExchange: true, exchangeCost: check.exchangeCost } },
        403,
      );
    }
    await this.practiceService.markPracticeSessionAnalyzing(session.user.id, sessionId);

    try {
      const practiceSession = await this.practiceService.getPracticeSessionForAnalysis(session.user.id, sessionId);
      const result = await this.service.summarizePracticeSession(practiceSession);
      await this.practiceService.savePracticeSessionAnalysis(
        session.user.id,
        sessionId,
        result.analysis,
        result.raw,
      );
      return result;
    } catch (error: any) {
      await this.practiceService.savePracticeSessionAnalysisError(
        session.user.id,
        sessionId,
        error?.message || '分析失败',
      );
      throw error;
    }
  }

  /** 单词增强：中文释义 + 分级例句 */
  @Post('word-enrichment')
  async wordEnrichment(@Body() dto: { word: string; englishDefinitions?: string }) {
    return this.service.enrichWord(dto.word, dto.englishDefinitions);
  }
}

import { Body, Controller, Param, Post, Req, HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { EnglishPracticeAiService } from './english-practice-ai.service';
import { DialogueTurnJudgeDto, PlacementAssessmentDto, GenerateDrillsDto, GenerateWarmupPipelineDto, WarmupTurnJudgeDto } from './dto/english-feedback.dto';
import { EnglishPracticeService } from '../practice/english-practice.service';
import { requireAuthSession } from '../auth/session.util';
import { AiQuotaService } from '../../common/ai-quota/ai-quota.service';

/** 英语输出训练 — AI 对话判定 & 练习会话分析 & 单词增强 */
@Controller('practice-ai')
export class EnglishPracticeAiController {
  constructor(
    private readonly service: EnglishPracticeAiService,
    private readonly practiceService: EnglishPracticeService,
    private readonly quotaService: AiQuotaService,
  ) {}

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
    return this.service.judgeDialogueTurn(dto, session.user.id);
  }

  /** 知识点热身单题快速判定 */
  @Post('warmup-turn')
  async judgeWarmupTurn(@Req() req: Request, @Body() dto: WarmupTurnJudgeDto) {
    const session = await requireAuthSession(req);
    const check = await this.quotaService.checkAndDeduct(session.user.id, 'dialogue');
    if (!check.allowed) {
      throw new HttpException(
        { code: 403, message: check.message, data: { canExchange: true, exchangeCost: check.exchangeCost } },
        403,
      );
    }
    return this.service.judgeWarmupTurn(dto, session.user.id);
  }

  @Post('placement-assessment')
  async placementAssessment(@Req() req: Request, @Body() dto: PlacementAssessmentDto) {
    const session = await requireAuthSession(req);
    const check = await this.quotaService.checkAndDeduct(session.user.id, 'summary');
    if (!check.allowed) {
      throw new HttpException(
        { code: 403, message: check.message, data: { canExchange: true, exchangeCost: check.exchangeCost } },
        403,
      );
    }
    return this.service.assessPlacement(dto, session.user.id);
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
      const result = await this.service.summarizePracticeSession(practiceSession, session.user.id);
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

  /** AI 生成练习题：根据关键词和题型生成练习项目（管理后台用） */
  @Post('generate-drills')
  async generateDrills(@Req() req: Request, @Body() dto: GenerateDrillsDto) {
    await requireAuthSession(req);
    return this.service.generateDrills(dto);
  }

  /** AI 一次性补齐知识点练习：根据材料覆盖和结构目标生成多个题组 */
  @Post('generate-warmup-pipeline')
  async generateWarmupPipeline(@Req() req: Request, @Body() dto: GenerateWarmupPipelineDto) {
    await requireAuthSession(req);
    return this.service.generateWarmupPipeline(dto);
  }
}

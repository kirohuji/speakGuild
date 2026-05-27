import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EnglishPracticeService } from './english-practice.service';
import { CreatePracticeSessionDto, SaveExpressionDto, SubmitPracticeDialogueDto, SubmitPracticeTurnDto, SubmitRecordingDto } from './dto/english-practice.dto';
import { requireAuthSession } from '../auth/session.util';

/** 英语输出训练 — 练习模式 API */
@Controller('practice')
export class EnglishPracticeController {
  constructor(private readonly practiceService: EnglishPracticeService) {}

  /** 获取场景下的训练话题列表 */
  @Get('topics')
  async getTopics(@Query('sceneId') sceneId: string) {
    return this.practiceService.getTopicsByScene(sceneId);
  }

  /** 话题详情（词汇预热 + Chunk 激活 + 句型骨架 + Ink 脚本） */
  @Get('topics/:id')
  async getTopicDetail(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.practiceService.getTopicDetail(id, session.user.id);
  }

  /** 获取话题关联的 Ink 脚本 */
  @Get('topics/:id/ink')
  async getTopicInk(@Param('id') id: string) {
    return this.practiceService.getTopicInkScript(id);
  }

  @Post('topics/:id/sessions')
  async createSession(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: Partial<CreatePracticeSessionDto>,
  ) {
    const session = await requireAuthSession(req);
    return this.practiceService.createPracticeSession(session.user.id, id);
  }

  @Get('sessions/:sessionId')
  async getSession(@Req() req: Request, @Param('sessionId') sessionId: string) {
    const session = await requireAuthSession(req);
    return this.practiceService.getPracticeSession(session.user.id, sessionId);
  }

  @Post('sessions/:sessionId/turns')
  async submitTurn(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitPracticeTurnDto,
  ) {
    const session = await requireAuthSession(req);
    return this.practiceService.submitPracticeTurn(session.user.id, sessionId, dto);
  }

  @Post('sessions/:sessionId/complete')
  async completeSession(@Req() req: Request, @Param('sessionId') sessionId: string) {
    const session = await requireAuthSession(req);
    return this.practiceService.completePracticeSession(session.user.id, sessionId);
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

  /** 提交练习对话记录 */
  @Post('topics/:id/dialogue')
  async submitDialogue(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitPracticeDialogueDto,
  ) {
    const session = await requireAuthSession(req);
    return this.practiceService.submitPracticeDialogue(session.user.id, id, dto);
  }

  /** 获取话题的所有对话记录 */
  @Get('topics/:id/dialogues')
  async getTopicDialogues(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.practiceService.getTopicDialogues(id, session.user.id);
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

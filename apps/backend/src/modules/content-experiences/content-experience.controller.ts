import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { ContentExperienceService } from './content-experience.service';
import { SaveNovelProgressDto, SaveTopicSubmissionDto } from './dto/content-experience.dto';

@Controller('learning/experiences')
export class ContentExperienceController {
  constructor(private readonly experiences: ContentExperienceService) {}

  @Get('scenes/:sceneId')
  async getScene(@Req() req: Request, @Param('sceneId') sceneId: string) {
    const session = await requireAuthSession(req);
    return this.experiences.getPublicSceneExperience(session.user.id, sceneId);
  }

  @Post('topics/:topicId/submissions')
  async saveSubmission(
    @Req() req: Request,
    @Param('topicId') topicId: string,
    @Body() dto: SaveTopicSubmissionDto,
  ) {
    const session = await requireAuthSession(req);
    return this.experiences.saveTopicSubmission(session.user.id, topicId, dto);
  }

  // POST /topics/:topicId/review 已移除。
  // 旧路径逐条 AI 反馈 → 新路径走 TopicSession.analyzeTopicSession（统一综合评估）。

  // ═══ TopicSession 路由 ═══

  @Post('topics/:topicId/sessions/start')
  async startSession(@Req() req: Request, @Param('topicId') topicId: string) {
    const session = await requireAuthSession(req);
    return this.experiences.startTopicSession(session.user.id, topicId);
  }

  @Post('topics/:topicId/sessions/:id/complete')
  async completeSession(
    @Req() req: Request,
    @Param('topicId') topicId: string,
    @Param('id') id: string,
  ) {
    const session = await requireAuthSession(req);
    return this.experiences.completeTopicSession(session.user.id, id);
  }

  @Get('topics/:topicId/sessions')
  async listSessions(@Req() req: Request, @Param('topicId') topicId: string) {
    const session = await requireAuthSession(req);
    return this.experiences.listTopicSessions(session.user.id, topicId);
  }

  @Get('topics/:topicId/sessions/latest')
  async latestSession(@Req() req: Request, @Param('topicId') topicId: string) {
    const session = await requireAuthSession(req);
    return this.experiences.getLatestTopicSession(session.user.id, topicId);
  }

  @Post('topics/:topicId/sessions/:id/analyze')
  async analyzeSession(
    @Req() req: Request,
    @Param('topicId') topicId: string,
    @Param('id') id: string,
  ) {
    const session = await requireAuthSession(req);
    return this.experiences.analyzeTopicSession(session.user.id, id);
  }

  @Put('novels/:sceneId/progress')
  async saveNovelProgress(
    @Req() req: Request,
    @Param('sceneId') sceneId: string,
    @Body() dto: SaveNovelProgressDto,
  ) {
    const session = await requireAuthSession(req);
    return this.experiences.saveNovelProgress(session.user.id, sceneId, dto);
  }
}

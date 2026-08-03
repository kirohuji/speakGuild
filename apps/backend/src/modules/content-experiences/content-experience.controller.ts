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

  @Post('topics/:topicId/review')
  async reviewSubmission(@Req() req: Request, @Param('topicId') topicId: string) {
    const session = await requireAuthSession(req);
    return this.experiences.reviewLatestSubmission(session.user.id, topicId);
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

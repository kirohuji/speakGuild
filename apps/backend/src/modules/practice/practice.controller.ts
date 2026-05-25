import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PracticeService } from './practice.service';
import { PracticeActionDto } from './dto/practice-action.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller()
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Get('practice/topic/:topicId/questions')
  async getTopicQuestions(
    @Req() req: Request,
    @Param('topicId') topicId: string,
  ) {
    const session = await requireAuthSession(req);
    return this.practiceService.getTopicQuestions(session.user.id, topicId);
  }

  @Get('practice/question/:questionId')
  async getQuestionDetail(
    @Req() req: Request,
    @Param('questionId') questionId: string,
  ) {
    const session = await requireAuthSession(req);
    return this.practiceService.getQuestionDetail(session.user.id, questionId);
  }

  @Post('practice/action')
  async recordAction(@Req() req: Request, @Body() dto: PracticeActionDto) {
    const session = await requireAuthSession(req);
    return this.practiceService.recordAction(session.user.id, dto);
  }

  @Get('dictionary/lookup')
  async lookupDictionary(@Req() req: Request, @Query('term') term: string) {
    const session = await requireAuthSession(req);
    return this.practiceService.lookupDictionary(session.user.id, term);
  }
}

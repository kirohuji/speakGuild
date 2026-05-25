import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MockExamService } from './mock-exam.service';
import { StartExamDto, SubmitExamDto } from './dto/submit-exam.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('mock')
export class MockExamController {
  constructor(private readonly mockExamService: MockExamService) {}

  @Get('papers')
  async getPapers(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.mockExamService.getPapers(session.user.id);
  }

  @Get('recent-scores')
  async getRecentScores(@Req() req: Request, @Query() pagination: PaginationDto) {
    const session = await requireAuthSession(req);
    return this.mockExamService.getRecentScores(session.user.id, pagination);
  }

  @Get('scores')
  async getScores(@Req() req: Request, @Query('limit') limit?: string) {
    const session = await requireAuthSession(req);
    return this.mockExamService.getScores(session.user.id, limit ? parseInt(limit, 10) : 10);
  }

  @Get('dashboard')
  async getDashboard(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.mockExamService.getDashboard(session.user.id);
  }

  @Post('start')
  async startExam(@Req() req: Request, @Body() dto: StartExamDto) {
    const session = await requireAuthSession(req);
    return this.mockExamService.startExam(session.user.id, dto);
  }

  @Post('submit')
  async submitExam(@Req() req: Request, @Body() dto: SubmitExamDto) {
    const session = await requireAuthSession(req);
    return this.mockExamService.submitExam(session.user.id, dto);
  }
}

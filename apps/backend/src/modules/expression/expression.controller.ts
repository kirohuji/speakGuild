import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ExpressionService } from './expression.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('expressions')
export class ExpressionController {
  constructor(private readonly expressionService: ExpressionService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('type') type?: string,
    @Query('sceneName') sceneName?: string,
    @Query('reviewState') reviewState?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.listExpressions(session.user.id, {
      type: type as any,
      sceneName,
      reviewState: reviewState as any,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    const session = await requireAuthSession(req);
    return this.expressionService.createExpression(session.user.id, body);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.expressionService.deleteExpression(session.user.id, id);
  }

  @Get('review')
  async getReview(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.expressionService.getReviewList(session.user.id);
  }

  @Post(':id/review')
  async completeReview(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.expressionService.completeReview(session.user.id, id);
  }
}

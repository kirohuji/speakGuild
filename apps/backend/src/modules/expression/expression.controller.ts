import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ExpressionService, type MasteryStatus } from './expression.service';
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
    @Query('notebookId') notebookId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.listExpressions(session.user.id, {
      type: type as any,
      sceneName,
      reviewState: reviewState as MasteryStatus,
      notebookId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Patch('notebook-items/:notebookItemId/status')
  async updateNotebookItemStatus(
    @Req() req: Request,
    @Param('notebookItemId') notebookItemId: string,
    @Body('status') status: MasteryStatus,
    @Body('quality') quality?: number,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.updateNotebookItemStatus(
      session.user.id,
      notebookItemId,
      status,
      quality,
    );
  }

  @Delete('notebook-items/:notebookItemId')
  async removeNotebookItem(
    @Req() req: Request,
    @Param('notebookItemId') notebookItemId: string,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.deleteNotebookItem(session.user.id, notebookItemId);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    const session = await requireAuthSession(req);
    return this.expressionService.createExpression(session.user.id, body);
  }

}

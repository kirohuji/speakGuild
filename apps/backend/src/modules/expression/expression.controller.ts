import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ExpressionService, type MasteryStatus } from './expression.service';
import { requireAuthSession } from '../auth/session.util';
import type { ReviewRating } from '../../common/spaced-repetition';

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
    @Query('search') search?: string,
    @Query('sort') sort?: 'newest' | 'oldest',
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.listExpressions(session.user.id, {
      type: type as any,
      sceneName,
      reviewState: reviewState as MasteryStatus,
      notebookId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
      sort,
    });
  }

  @Patch('notebook-items/batch/status')
  async updateNotebookItemsStatus(
    @Req() req: Request,
    @Body('notebookItemIds') notebookItemIds: string[],
    @Body('status') status: MasteryStatus,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.updateNotebookItemsStatus(session.user.id, notebookItemIds ?? [], status);
  }

  @Post('notebook-items/batch/add-to-notebook')
  async addNotebookItemsToNotebook(
    @Req() req: Request,
    @Body('notebookItemIds') notebookItemIds: string[],
    @Body('notebookId') notebookId: string,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.addNotebookItemsToNotebook(session.user.id, notebookItemIds ?? [], notebookId);
  }

  @Patch('notebook-items/:notebookItemId/status')
  async updateNotebookItemStatus(
    @Req() req: Request,
    @Param('notebookItemId') notebookItemId: string,
    @Body('status') status: MasteryStatus,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.updateNotebookItemStatus(
      session.user.id,
      notebookItemId,
      status,
    );
  }

  @Post('notebook-items/:notebookItemId/review')
  async reviewNotebookItem(
    @Req() req: Request,
    @Param('notebookItemId') notebookItemId: string,
    @Body('rating') rating: ReviewRating,
  ) {
    const session = await requireAuthSession(req);
    return this.expressionService.reviewNotebookItem(session.user.id, notebookItemId, rating);
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

import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { LearningNotebookService } from './learning-notebook.service';

@Controller('learning-notebooks')
export class LearningNotebookController {
  constructor(private readonly notebooks: LearningNotebookService) {}

  @Get()
  async list(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.notebooks.list(session.user.id);
  }

  @Post()
  async create(@Req() req: Request, @Body('name') name: string) {
    const session = await requireAuthSession(req);
    return this.notebooks.create(session.user.id, name);
  }

  @Patch(':id')
  async rename(@Req() req: Request, @Param('id') id: string, @Body('name') name: string) {
    const session = await requireAuthSession(req);
    return this.notebooks.rename(session.user.id, id, name);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    return this.notebooks.remove(session.user.id, id);
  }

  @Get('expressions/:expressionItemId')
  async getExpressionNotebooks(
    @Req() req: Request,
    @Param('expressionItemId') expressionItemId: string,
  ) {
    const session = await requireAuthSession(req);
    return this.notebooks.getExpressionNotebookIds(session.user.id, expressionItemId);
  }

  @Post('expressions/:expressionItemId')
  async setExpressionNotebooks(
    @Req() req: Request,
    @Param('expressionItemId') expressionItemId: string,
    @Body('notebookIds') notebookIds: string[],
  ) {
    const session = await requireAuthSession(req);
    return this.notebooks.setExpressionNotebooks(session.user.id, expressionItemId, notebookIds ?? []);
  }
}

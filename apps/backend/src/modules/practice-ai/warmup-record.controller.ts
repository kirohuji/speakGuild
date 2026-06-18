import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { WarmupRecordService } from './warmup-record.service';

@Controller('practice/warmup-records')
export class WarmupRecordController {
  constructor(private readonly service: WarmupRecordService) {}

  @Get()
  async list(@Req() req: Request, @Query('topicId') topicId?: string) {
    const session = await requireAuthSession(req);
    return this.service.list(session.user.id, topicId);
  }

  @Post()
  async save(@Req() req: Request, @Body() body: { topicId: string; items: any[] }) {
    const session = await requireAuthSession(req);
    return this.service.save(session.user.id, body.topicId, body.items);
  }

  @Post('assess')
  async assess(@Req() req: Request, @Body() body: { topicId: string; topicTitle: string; items: any[] }) {
    const session = await requireAuthSession(req);
    return this.service.assessAndSave(session.user.id, body.topicId, body.topicTitle, body.items);
  }
}

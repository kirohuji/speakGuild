import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ContentAccessService } from './content-access.service';
import { ContentReviewService } from './content-review.service';

@Controller('admin/content-reviews')
export class ContentReviewController {
  constructor(
    private readonly reviews: ContentReviewService,
    private readonly access: ContentAccessService,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const session = await this.access.requireManager(req);
    return this.reviews.list(session, { status, page: Number(page || 1), pageSize: Number(pageSize || 20) });
  }

  @Post()
  async submit(@Req() req: Request, @Body() body: { sceneId: string; kind: 'learning_package' | 'narrative_package' }) {
    const session = await this.access.requireManager(req);
    return this.reviews.submit(session, body.sceneId, body.kind);
  }

  @Post(':id/approve')
  async approve(@Req() req: Request, @Param('id') id: string, @Body() body: { reviewNote?: string }) {
    const session = await this.access.requireAdmin(req);
    return this.reviews.approve(session, id, body.reviewNote);
  }

  @Post(':id/reject')
  async reject(@Req() req: Request, @Param('id') id: string, @Body() body: { reviewNote: string }) {
    const session = await this.access.requireAdmin(req);
    return this.reviews.reject(session, id, body.reviewNote);
  }
}

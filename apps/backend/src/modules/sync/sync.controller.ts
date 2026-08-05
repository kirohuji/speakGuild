import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SyncService } from './sync.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /** 批量推送客户端离线变更 */
  @Post('push')
  async push(@Req() req: Request, @Body() body: { items: any[] }) {
    const session = await requireAuthSession(req);
    return this.syncService.push(session.user.id, body.items ?? []);
  }

  /** 增量拉取用户数据（按类型独立 cursor） */
  @Get('pull')
  async pull(@Req() req: Request, @Query('cursors') cursorsJson?: string) {
    const session = await requireAuthSession(req);
    const cursors: Record<string, string> = cursorsJson
      ? JSON.parse(cursorsJson)
      : {};
    return this.syncService.pull(session.user.id, cursors);
  }

  /** 公共内容增量 manifest */
  @Get('content/manifest')
  async contentManifest(@Query('since') since?: string) {
    return this.syncService.getContentManifest(since ?? null);
  }
}

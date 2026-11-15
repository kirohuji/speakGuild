import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
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

  /** 增量拉取用户数据（按类型独立 cursor；types 可选，限制只拉指定类型） */
  @Get('pull')
  async pull(
    @Req() req: Request,
    @Query('cursors') cursorsJson?: string,
    @Query('types') typesJson?: string,
    @Query('compact') compact?: string,
  ) {
    const session = await requireAuthSession(req);
    let cursors: Record<string, string>;
    let types: string[] | undefined;
    try {
      cursors = cursorsJson ? JSON.parse(cursorsJson) : {};
      types = typesJson ? JSON.parse(typesJson) : undefined;
      if (!cursors || Array.isArray(cursors) || typeof cursors !== 'object') throw new Error();
      if (types !== undefined && (!Array.isArray(types) || types.some(type => typeof type !== 'string'))) throw new Error();
      for (const value of Object.values(cursors)) {
        if (value == null) continue;
        if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value.split('|')[0]))) throw new Error();
      }
    } catch {
      throw new BadRequestException('同步游标或类型格式无效');
    }
    return this.syncService.pull(session.user.id, cursors, types, compact === 'true');
  }

  /** 公共内容增量 manifest */
  @Get('content/manifest')
  async contentManifest(@Query('since') since?: string) {
    return this.syncService.getContentManifest(since ?? null);
  }
}

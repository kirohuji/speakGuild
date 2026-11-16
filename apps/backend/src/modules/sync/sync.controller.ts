import { BadRequestException, Body, Controller, Get, Header, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
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

  /** Cold-start zip snapshot of compact user pull pages */
  @Get('pull/snapshot')
  @Header('Content-Type', 'application/zip')
  async pullSnapshot(@Req() req: Request, @Res() res: Response) {
    const session = await requireAuthSession(req);
    const { buffer, complete } = await this.syncService.buildPullSnapshotZip(session.user.id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="sync-snapshot.zip"');
    res.setHeader('X-Sync-Snapshot-Complete', complete ? '1' : '0');
    res.send(buffer);
  }

  /** 公共内容增量 manifest */
  @Get('content/manifest')
  async contentManifest(@Query('since') since?: string) {
    return this.syncService.getContentManifest(since ?? null);
  }
}

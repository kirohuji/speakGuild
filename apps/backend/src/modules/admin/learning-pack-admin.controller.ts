import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { requireAdmin } from '../auth/admin.util';
import { LearningPackAdminService } from './learning-pack-admin.service';

@Controller('admin/learning-packs')
export class LearningPackAdminController {
  constructor(private readonly service: LearningPackAdminService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('sceneId') sceneId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await requireAdmin(req);
    return this.service.list({
      sceneId,
      status,
      page: Number(page || 1),
      pageSize: Number(pageSize || 20),
    });
  }

  @Get('scenes')
  async scenes(@Req() req: Request) {
    await requireAdmin(req);
    return this.service.listScenes();
  }

  @Post('generate')
  async generate(
    @Req() req: Request,
    @Body() body: { sceneId: string; version?: number; title?: string; publish?: boolean },
  ) {
    const session = await requireAdmin(req);
    return this.service.generate(session.user.id, body.sceneId, body);
  }

  @Post('upload')
  async upload(
    @Req() req: Request,
    @Body() body: { sceneId: string; assetId: string; version?: number; title?: string; publish?: boolean },
  ) {
    await requireAdmin(req);
    return this.service.createFromUploadedZip(body);
  }

  @Get(':id/download')
  async download(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    await requireAdmin(req);
    const pack = await this.service.download(id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${pack.filename}"`);
    res.setHeader('Content-Length', String(pack.buffer.byteLength));
    if (pack.checksum) res.setHeader('X-Learning-Pack-Checksum', pack.checksum);
    res.send(pack.buffer);
  }

  @Post(':id/publish')
  async publish(@Req() req: Request, @Param('id') id: string) {
    await requireAdmin(req);
    return this.service.publish(id);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await requireAdmin(req);
    return this.service.remove(id);
  }
}

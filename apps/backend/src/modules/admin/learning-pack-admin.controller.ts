import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
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

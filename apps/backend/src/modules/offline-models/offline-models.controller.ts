import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { OfflineModelsService } from './offline-models.service';
import { PrepareOfflineModelDto, ValidateOfflineModelDto } from './offline-models.dto';

@Controller('admin/offline-models')
export class AdminOfflineModelsController {
  constructor(private readonly models: OfflineModelsService) {}
  private async admin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any).role !== 'admin') throw new ForbiddenException('需要管理员权限');
    return session.user.id;
  }
  @Get() async list(@Req() req: Request) { await this.admin(req); return this.models.list(); }
  @Get(':id') async detail(@Req() req: Request, @Param('id') id: string) { await this.admin(req); return this.models.detail(id); }
  @Post() async prepare(@Req() req: Request, @Body() input: PrepareOfflineModelDto) { return this.models.prepare(await this.admin(req), input); }
  @Post(':id/retry') async retry(@Req() req: Request, @Param('id') id: string) { return this.models.retry(id, await this.admin(req)); }
  @Post(':id/cancel') async cancel(@Req() req: Request, @Param('id') id: string) { await this.admin(req); return this.models.cancel(id); }
  @Post(':id/publish') async publish(@Req() req: Request, @Param('id') id: string) { await this.admin(req); return this.models.publish(id); }
  @Post(':id/unpublish') async unpublish(@Req() req: Request, @Param('id') id: string) { await this.admin(req); return this.models.unpublish(id); }
  @Put(':id/validation') async validate(@Req() req: Request, @Param('id') id: string, @Body() input: ValidateOfflineModelDto) { await this.admin(req); return this.models.validate(id, input); }
  @Delete(':id') async remove(@Req() req: Request, @Param('id') id: string) { await this.admin(req); return this.models.remove(id); }
}
@Controller('offline-models')
export class OfflineModelsController {
  constructor(private readonly models: OfflineModelsService) {}
  @Get(':variantId/manifest') async manifest(@Req() req: Request, @Param('variantId') id: string) { await requireAuthSession(req); return this.models.manifest(id); }
}

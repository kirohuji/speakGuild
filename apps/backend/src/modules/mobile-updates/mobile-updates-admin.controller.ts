import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { MobileUpdatesService } from './mobile-updates.service';
import { CreateMobileBundleDto, UpdateMobileBundleDto } from './dto/mobile-bundle.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('admin/mobile-bundles')
export class MobileUpdatesAdminController {
  constructor(private readonly mobileUpdatesService: MobileUpdatesService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query() pagination: PaginationDto,
    @Query('platform') platform?: string,
    @Query('channel') channel?: string,
  ) {
    await this.requireAdmin(req);
    return this.mobileUpdatesService.listBundles({
      page: pagination.page,
      pageSize: pagination.pageSize,
      platform,
      channel,
    });
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.mobileUpdatesService.getBundle(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateMobileBundleDto) {
    await this.requireAdmin(req);
    return this.mobileUpdatesService.createBundle(dto);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateMobileBundleDto,
  ) {
    await this.requireAdmin(req);
    return this.mobileUpdatesService.updateBundle(id, dto);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.mobileUpdatesService.deleteBundle(id);
  }

  @Post(':id/toggle')
  async toggle(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.mobileUpdatesService.toggleBundle(id);
  }
}

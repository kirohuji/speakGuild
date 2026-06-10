import {
  Controller, Get, Put, Param, Body, Req, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SystemConfigService } from './system-config.service';
import { requireAuthSession } from '../../auth/session.util';

@Controller('admin/system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  /** Get all configs grouped. */
  @Get()
  async getAll(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.systemConfigService.getAllGrouped();
  }

  /** Get a single config value by key. */
  @Get(':key')
  async getByKey(@Req() req: Request, @Param('key') key: string) {
    await this.requireAdmin(req);
    const value = await this.systemConfigService.getValue(key);
    return { key, value };
  }

  /** Bulk update configs. */
  @Put('bulk')
  async bulkSet(@Req() req: Request, @Body() body: Record<string, string>) {
    await this.requireAdmin(req);
    const count = await this.systemConfigService.bulkSet(body);
    return { updated: count };
  }

  /** Update a single config. */
  @Put(':key')
  async setConfig(
    @Req() req: Request,
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    await this.requireAdmin(req);
    return this.systemConfigService.setConfig(key, value);
  }
}

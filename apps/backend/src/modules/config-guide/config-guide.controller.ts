import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigGuideService } from './config-guide.service';
import { BindConfigDto } from './dto/bind-config.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller()
export class ConfigGuideController {
  constructor(private readonly configGuideService: ConfigGuideService) {}

  @Get('config/options')
  getOptions() {
    return this.configGuideService.getOptions();
  }

  @Post('config/bind')
  async bindConfig(@Req() req: Request, @Body() dto: BindConfigDto) {
    const session = await requireAuthSession(req);
    return this.configGuideService.bindConfig(session.user.id, dto);
  }

  @Get('config/current')
  async getCurrentConfig(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.configGuideService.getCurrentConfig(session.user.id);
  }

  @Get('bootstrap')
  async getBootstrap(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.configGuideService.getBootstrap(session.user.id);
  }
}

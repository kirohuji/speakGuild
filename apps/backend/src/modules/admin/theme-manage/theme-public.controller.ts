import {
  Controller, Get, Put, Body, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ThemeManageService } from './theme-manage.service';
import { requireAuthSession } from '../../../modules/auth/session.util';

@Controller('themes')
export class ThemePublicController {
  constructor(private readonly themeManageService: ThemeManageService) {}

  /** 获取所有启用的主题 */
  @Get()
  async findActive(@Req() req: Request) {
    // 未登录也可以看主题列表
    return this.themeManageService.findActive();
  }

  /** 获取当前用户激活的主题 */
  @Get('active')
  async getActive(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.themeManageService.getUserTheme(session.user.id);
  }

  /** 获取默认主题（未登录时用） */
  @Get('default')
  async getDefault() {
    return this.themeManageService.findDefault();
  }

  /** 用户切换主题 */
  @Put('active')
  async setActive(
    @Req() req: Request,
    @Body('themePresetId') themePresetId: string | null,
  ) {
    const session = await requireAuthSession(req);
    return this.themeManageService.setUserTheme(session.user.id, themePresetId);
  }
}

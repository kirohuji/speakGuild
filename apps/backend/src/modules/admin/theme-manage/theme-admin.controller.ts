import {
  Controller, Get, Post, Put, Delete, Body, Param, Req,
  ForbiddenException, Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { ThemeManageService } from './theme-manage.service';
import { CreateThemePresetDto, UpdateThemePresetDto } from './dto/theme-preset.dto';
import { requireAuthSession } from '../../../modules/auth/session.util';

@Controller('admin/themes')
export class ThemeAdminController {
  constructor(private readonly themeManageService: ThemeManageService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  /** 获取所有主题（管理端） */
  @Get()
  async findAll(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.themeManageService.findAll();
  }

  /** 获取单个主题 */
  @Get(':id')
  async findById(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.themeManageService.findById(id);
  }

  /** 创建主题 */
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateThemePresetDto) {
    await this.requireAdmin(req);
    return this.themeManageService.create(dto);
  }

  /** 更新主题 */
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateThemePresetDto,
  ) {
    await this.requireAdmin(req);
    return this.themeManageService.update(id, dto);
  }

  /** 删除主题 */
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.themeManageService.remove(id);
  }
}

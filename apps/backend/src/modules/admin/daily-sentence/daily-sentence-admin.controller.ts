import {
  Controller, Get, Post, Put, Delete, Body, Param, Req, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DailySentenceService } from './daily-sentence.service';
import { CreateDailySentenceDto, UpdateDailySentenceDto } from './dto/daily-sentence.dto';
import { requireAuthSession } from '../../auth/session.util';

@Controller('admin/daily-sentences')
export class DailySentenceAdminController {
  constructor(private readonly dailySentenceService: DailySentenceService) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  /** 获取所有每日句子 */
  @Get()
  async findAll(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.dailySentenceService.findAll();
  }

  /** 获取单个句子 */
  @Get(':id')
  async findById(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.dailySentenceService.findById(id);
  }

  /** 创建句子 */
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateDailySentenceDto) {
    await this.requireAdmin(req);
    return this.dailySentenceService.create(dto);
  }

  /** 更新句子 */
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateDailySentenceDto,
  ) {
    await this.requireAdmin(req);
    return this.dailySentenceService.update(id, dto);
  }

  /** 删除句子 */
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.dailySentenceService.remove(id);
  }
}

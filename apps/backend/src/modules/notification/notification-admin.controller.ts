import {
  Controller, Post, Get, Patch, Delete,
  Body, Query, Req, Param, ForbiddenException,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('admin/notifications')
export class NotificationAdminController {
  constructor(private readonly notificationService: NotificationService) {}

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
    @Query('keyword') keyword?: string,
  ) {
    await this.requireAdmin(req);
    return this.notificationService.listAllNotifications(pagination, keyword || undefined);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateNotificationDto) {
    const session = await this.requireAdmin(req);
    return this.notificationService.createNotification(session.user.id, dto);
  }

  @Get('search-users')
  async searchUsers(@Req() req: Request, @Query('keyword') keyword: string) {
    await this.requireAdmin(req);
    return this.notificationService.searchUsers(keyword || '');
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.requireAdmin(req);
    if (!file) throw new ForbiddenException('请选择图片文件');
    return this.notificationService.uploadNotificationImage(file);
  }

  @Get('stats')
  async stats(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.notificationService.getNotificationStats();
  }

  @Get('images')
  async listImages(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    return this.notificationService.listNotificationImages(
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Get(':id')
  async detail(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.notificationService.getNotificationById(id);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    await this.requireAdmin(req);
    return this.notificationService.updateNotification(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.notificationService.deleteNotification(id);
  }
}

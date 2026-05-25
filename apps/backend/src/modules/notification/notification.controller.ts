import { Controller, Post, Get, Query, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import { requireAuthSession } from '../auth/session.util';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(@Req() req: Request, @Query() query: QueryNotificationDto) {
    const session = await requireAuthSession(req);
    return this.notificationService.getUserNotifications(session.user.id, query);
  }

  @Get('unread-count')
  async unreadCount(@Req() req: Request) {
    const session = await requireAuthSession(req);
    const count = await this.notificationService.getUnreadCount(session.user.id);
    return { count };
  }

  @Post(':id/read')
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const session = await requireAuthSession(req);
    await this.notificationService.markAsRead(session.user.id, id);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@Req() req: Request) {
    const session = await requireAuthSession(req);
    await this.notificationService.markAllAsRead(session.user.id);
    return { success: true };
  }
}

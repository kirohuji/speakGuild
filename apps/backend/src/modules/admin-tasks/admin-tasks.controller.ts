import { Controller, Get, Param, Post, Query, Req, ForbiddenException } from '@nestjs/common';
import { AdminTaskStatus } from '@prisma/client';
import type { Request } from 'express';
import { requireAuthSession } from '../auth/session.util';
import { AdminTasksService } from './admin-tasks.service';

@Controller('admin/tasks')
export class AdminTasksController {
  constructor(private readonly adminTasksService: AdminTasksService) {}

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
    @Query('type') type?: string,
    @Query('status') status?: AdminTaskStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);
    return this.adminTasksService.list({
      type,
      status,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.adminTasksService.get(id);
  }

  @Post(':id/retry')
  async retry(@Req() req: Request, @Param('id') id: string) {
    const session = await this.requireAdmin(req);
    return this.adminTasksService.retry(id, session.user.id);
  }
}

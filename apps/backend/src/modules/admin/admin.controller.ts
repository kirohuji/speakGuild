import {
  Controller, Get, Patch, Post, Param, Body, Query, Req, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { AdminStatsService } from './admin-stats.service';
import { PayService } from '../pay/pay.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { requireAuthSession } from '../auth/session.util';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminStatsService: AdminStatsService,
    private readonly payService: PayService,
  ) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);

    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }

    return session;
  }

  // ─── 用户管理 ──────────────────────────────────────────────

  @Get('users')
  async listUsers(@Req() req: Request, @Query() pagination: PaginationDto) {
    await this.requireAdmin(req);
    return this.adminService.listUsers(pagination);
  }

  @Get('users/:id')
  async getUserDetail(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const session = await this.requireAdmin(req);
    return this.adminService.updateUserRole(id, dto, session.user.id);
  }

  // ─── 会员管理 ──────────────────────────────────────────────

  @Get('members')
  async listMembers(@Req() req: Request, @Query() pagination: PaginationDto) {
    await this.requireAdmin(req);
    return this.adminService.listMembers(pagination);
  }

  @Get('members/:userId')
  async getMemberDetail(@Req() req: Request, @Param('userId') userId: string) {
    await this.requireAdmin(req);
    return this.adminService.getMemberDetail(userId);
  }

  @Post('members/:userId/cancel')
  async cancelMembership(@Req() req: Request, @Param('userId') userId: string) {
    await this.requireAdmin(req);
    return this.adminService.cancelMembership(userId);
  }

  // ─── 订单/账单管理 ──────────────────────────────────────────

  @Get('orders')
  async listOrders(
    @Req() req: Request,
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
  ) {
    await this.requireAdmin(req);
    return this.adminService.listOrders({ ...pagination, status });
  }

  @Get('orders/stats')
  async getOrderStats(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminService.getOrderStats();
  }

  // ─── 数据看板 ──────────────────────────────────────────────

  @Get('stats/dashboard')
  async getDashboardStats(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminStatsService.getDashboardStats();
  }

  @Get('stats/ai-usage')
  async getAiUsageStats(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.adminService.getAiUsageStats();
  }

  // ─── 用户 AI 用量 ──────────────────────────────────────────

  @Get('users/:id/ai-usage')
  async getUserAiUsage(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);
    return this.adminService.getUserAiUsage(id);
  }

  // ─── 测试支付 ──────────────────────────────────────────────

  /** 测试支付：自动创建 1 元订单并模拟支付成功 */
  @Post('test-payment')
  async testPayment(@Req() req: Request) {
    const session = await this.requireAdmin(req);
    return this.payService.createTestOrder(session.user.id);
  }
}

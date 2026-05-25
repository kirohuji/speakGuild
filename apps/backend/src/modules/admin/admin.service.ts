import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationDto, toPageResult } from '../../common/dto/pagination.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 用户管理 ──────────────────────────────────────────────

  async listUsers(pagination: PaginationDto) {
    const { page = 1, pageSize = 20, keyword } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (keyword) {
      where.OR = [
        { email: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
        { username: keyword ? { contains: keyword, mode: 'insensitive' } : undefined },
      ].filter(Boolean);
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          image: true,
          role: true,
          emailVerified: true,
          phoneNumber: true,
          phoneNumberVerified: true,
          createdAt: true,
          updatedAt: true,
          membership: {
            select: {
              status: true,
              expiredAt: true,
              plan: { select: { name: true, level: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return toPageResult(list, total, pagination);
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        image: true,
        role: true,
        emailVerified: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        createdAt: true,
        updatedAt: true,
        membership: {
          select: {
            status: true,
            startedAt: true,
            expiredAt: true,
            plan: { select: { id: true, name: true, level: true } },
          },
        },
        _count: {
          select: {
            practiceRecords: true,
            mockExamRecords: true,
            vocabularyWords: true,
            orders: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  async updateUserRole(userId: string, dto: UpdateUserRoleDto, currentUserId: string) {
    if (userId === currentUserId) {
      throw new ForbiddenException('不能修改自己的角色');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  // ─── 会员管理 ──────────────────────────────────────────────

  async listMembers(pagination: PaginationDto) {
    const { page = 1, pageSize = 20, keyword } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (keyword) {
      where.user = {
        OR: [
          { email: { contains: keyword, mode: 'insensitive' } },
          { name: { contains: keyword, mode: 'insensitive' } },
        ],
      };
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.userMembership.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true, username: true },
          },
          plan: { select: { id: true, name: true, level: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.userMembership.count({ where }),
    ]);

    return toPageResult(list, total, pagination);
  }

  async getMemberDetail(userId: string) {
    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, name: true, username: true },
        },
        plan: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('该用户暂无会员记录');
    }

    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return { ...membership, orders };
  }

  async cancelMembership(userId: string) {
    const membership = await this.prisma.userMembership.findUnique({
      where: { userId },
    });

    if (!membership) {
      throw new NotFoundException('该用户暂无会员记录');
    }

    return this.prisma.userMembership.update({
      where: { userId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });
  }

  // ─── 订单/账单管理 ──────────────────────────────────────────

  async listOrders(pagination: PaginationDto & { status?: string }) {
    const { page = 1, pageSize = 20, keyword, status } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { user: { email: { contains: keyword, mode: 'insensitive' } } },
      ];
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          plan: { select: { id: true, name: true, level: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return toPageResult(list, total, pagination);
  }

  async getOrderStats() {
    const [total, totalAmount, paidOrders] = await this.prisma.$transaction([
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: { amount: true },
        where: { status: 'paid' },
      }),
      this.prisma.order.count({ where: { status: 'paid' } }),
    ]);

    const recentOrders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        plan: { select: { name: true } },
      },
    });

    return {
      totalOrders: total,
      paidOrders,
      totalRevenue: totalAmount._sum.amount || 0,
      recentOrders,
    };
  }
}

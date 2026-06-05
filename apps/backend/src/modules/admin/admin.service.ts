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
        outputLevel: true,
        totalXp: true,
        points: true,
        userLevel: true,
        learningGoals: true,
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

            orders: true,
            practiceSessions: true,
            scriptRecords: true,
            expressionItems: true,
            sceneProgresses: true,
            chunkProgresses: true,
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

  // ─── AI 用量查询 ──────────────────────────────────────────

  /** 获取单个用户的 AI 用量明细 */
  async getUserAiUsage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException('用户不存在');

    // 近 30 天每日用量
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyUsages = await this.prisma.aiUsageDaily.findMany({
      where: { userId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'desc' },
    });

    // 总计
    const totals = dailyUsages.reduce(
      (acc, d) => ({
        dialogue: acc.dialogue + d.dialogue,
        summary: acc.summary + d.summary,
        tokens: acc.tokens + d.tokens,
      }),
      { dialogue: 0, summary: 0, tokens: 0 },
    );

    // Word enrichment 缓存命中数（来自 word_enrichment 表）
    const wordEnrichmentCount = await this.prisma.wordEnrichment.count();

    return {
      user,
      totals,
      dailyUsages: dailyUsages.map((d) => ({
        date: d.date.toISOString().slice(0, 10),
        dialogue: d.dialogue,
        summary: d.summary,
        tokens: d.tokens,
      })),
      cachedWordCount: wordEnrichmentCount,
    };
  }

  /** 获取全局 AI 用量统计 */
  async getAiUsageStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      dailyUsages30d,
      wordEnrichmentCount,
      totalUsers,
    ] = await Promise.all([
      this.prisma.aiUsageDaily.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.wordEnrichment.count(),
      this.prisma.user.count(),
    ]);

    // 按天聚合
    const dailyMap = new Map<string, { dialogue: number; summary: number; tokens: number }>();
    for (const d of dailyUsages30d) {
      const key = d.date.toISOString().slice(0, 10);
      const entry = dailyMap.get(key) || { dialogue: 0, summary: 0, tokens: 0 };
      entry.dialogue += d.dialogue;
      entry.summary += d.summary;
      entry.tokens += d.tokens;
      dailyMap.set(key, entry);
    }

    // 近 7 天 / 近 30 天 合计
    let weekDialogue = 0, weekSummary = 0, weekTokens = 0;
    let monthDialogue = 0, monthSummary = 0, monthTokens = 0;

    for (const d of dailyUsages30d) {
      monthDialogue += d.dialogue;
      monthSummary += d.summary;
      monthTokens += d.tokens;
      if (d.date >= sevenDaysAgo) {
        weekDialogue += d.dialogue;
        weekSummary += d.summary;
        weekTokens += d.tokens;
      }
    }

    // 今日用量
    const todayUsages = dailyUsages30d.filter(
      (d) => d.date.getTime() >= todayStart.getTime(),
    );
    const todayDialogue = todayUsages.reduce((s, d) => s + d.dialogue, 0);
    const todaySummary = todayUsages.reduce((s, d) => s + d.summary, 0);
    const todayTokens = todayUsages.reduce((s, d) => s + d.tokens, 0);

    // Top 用户（近 30 天）
    const topUsers = await this.prisma.aiUsageDaily.groupBy({
      by: ['userId'],
      where: { date: { gte: thirtyDaysAgo } },
      _sum: { dialogue: true, summary: true, tokens: true },
      orderBy: { _sum: { tokens: 'desc' } },
      take: 20,
    });

    // 查 top 用户的名称
    const topUserIds = topUsers.map((u) => u.userId);
    const topUserProfiles = await this.prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, email: true },
    });
    const profileMap = new Map(topUserProfiles.map((p) => [p.id, p]));

    const topUserList = topUsers.map((u) => {
      const p = profileMap.get(u.userId);
      return {
        userId: u.userId,
        name: p?.name || 'Unknown',
        email: p?.email || '',
        dialogue: u._sum.dialogue || 0,
        summary: u._sum.summary || 0,
        tokens: u._sum.tokens || 0,
      };
    });

    // 每日趋势（近 30 天）
    const trend: Array<{ date: string; dialogue: number; summary: number; tokens: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const entry = dailyMap.get(key) || { dialogue: 0, summary: 0, tokens: 0 };
      trend.push({ date: key, ...entry });
    }

    return {
      overview: {
        todayDialogue,
        todaySummary,
        todayTokens,
        weekDialogue,
        weekSummary,
        weekTokens,
        monthDialogue,
        monthSummary,
        monthTokens,
        totalCachedWords: wordEnrichmentCount,
        totalUsers,
      },
      trend,
      topUsers: topUserList,
    };
  }
}

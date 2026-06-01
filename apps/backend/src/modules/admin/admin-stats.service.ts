import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface DashboardStats {
  userCount: number;
  todayActiveUsers: number;
  newUsersThisWeek: number;
  paidUserCount: number;
  conversionRate: number;
  totalRevenue: number;
  monthRevenue: number;
  todayRevenue: number;
  totalSessionCount: number;
  todaySessionCount: number;
  totalScriptCount: number;
  sceneCount: number;
  chunkCount: number;
  revenueTrend: { date: string; amount: number }[];
  sessionTrend: { date: string; count: number }[];
  topScenes: { id: string; name: string; sessionCount: number }[];
}

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      todayActiveUsers,
      newUsersThisWeek,
      paidUserCount,
      totalRevenueResult,
      monthRevenueResult,
      todayRevenueResult,
      totalSessionCount,
      todaySessionCount,
      totalScriptCount,
      sceneCount,
      chunkCount,
      revenueTrendRaw,
      sessionTrendRaw,
      topScenesRaw,
    ] = await Promise.all([
      // 总注册用户数
      this.prisma.user.count(),

      // 今日 DAU
      this.prisma.dailyActivity.count({
        where: { date: todayStart },
      }),

      // 本周新增用户
      this.prisma.user.count({
        where: { createdAt: { gte: weekAgo } },
      }),

      // 付费用户数（有 paid 订单的独立用户）
      this.paidUserCountQuery(),

      // 总收入
      this.prisma.order.aggregate({
        _sum: { amount: true },
        where: { status: 'paid' },
      }),

      // 本月收入
      this.prisma.order.aggregate({
        _sum: { amount: true },
        where: { status: 'paid', paidAt: { gte: monthStart } },
      }),

      // 今日收入
      this.prisma.order.aggregate({
        _sum: { amount: true },
        where: { status: 'paid', paidAt: { gte: todayStart } },
      }),

      // 总练习会话数
      this.prisma.practiceSession.count(),

      // 今日练习会话数
      this.prisma.practiceSession.count({
        where: { startedAt: { gte: todayStart } },
      }),

      // 总剧本通关数
      this.prisma.scriptRecord.count({ where: { passed: true } }),

      // 场景总数
      this.prisma.scene.count(),

      // Chunk 总数
      this.prisma.chunk.count(),

      // 近 30 天每日收入趋势
      this.revenueTrendQuery(thirtyDaysAgo),

      // 近 30 天每日练习会话趋势
      this.sessionTrendQuery(thirtyDaysAgo),

      // 热门场景 Top 10
      this.topScenesQuery(),
    ]);

    const conversionRate =
      userCount > 0 ? Math.round((paidUserCount / userCount) * 10000) / 100 : 0;

    return {
      userCount,
      todayActiveUsers,
      newUsersThisWeek,
      paidUserCount,
      conversionRate,
      totalRevenue: totalRevenueResult._sum.amount ?? 0,
      monthRevenue: monthRevenueResult._sum.amount ?? 0,
      todayRevenue: todayRevenueResult._sum.amount ?? 0,
      totalSessionCount,
      todaySessionCount,
      totalScriptCount,
      sceneCount,
      chunkCount,
      revenueTrend: revenueTrendRaw.map((r) => ({
        date: r.date,
        amount: Number(r.amount),
      })),
      sessionTrend: sessionTrendRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      topScenes: topScenesRaw.map((s) => ({
        id: s.sceneId,
        name: s.name ?? '未知场景',
        sessionCount: Number(s.count),
      })),
    };
  }

  // ─── Private query helpers ($queryRaw avoids Prisma groupBy circular-type bug) ───

  /** Count distinct userIds with paid orders. */
  private async paidUserCountQuery(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(DISTINCT "userId")::int AS cnt FROM "order" WHERE status = 'paid'
    `;
    return Number(rows[0]?.cnt ?? 0);
  }

  /** Daily revenue for last 30 days. */
  private async revenueTrendQuery(since: Date) {
    return this.prisma.$queryRaw<
      { date: string; amount: bigint }[]
    >`
      SELECT DATE("paidAt") AS date, COALESCE(SUM(amount), 0) AS amount
      FROM "order"
      WHERE status = 'paid' AND "paidAt" >= ${since}
      GROUP BY DATE("paidAt")
      ORDER BY date ASC
    `;
  }

  /** Daily practice session count for last 30 days. */
  private async sessionTrendQuery(since: Date) {
    return this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE("startedAt") AS date, COUNT(*)::int AS count
      FROM "practice_session"
      WHERE "startedAt" >= ${since}
      GROUP BY DATE("startedAt")
      ORDER BY date ASC
    `;
  }

  /** Top 10 scenes by practice session count. */
  private async topScenesQuery() {
    return this.prisma.$queryRaw<
      { sceneId: string; name: string; count: bigint }[]
    >`
      SELECT ps."sceneId", s.title AS name, COUNT(*)::int AS count
      FROM "practice_session" ps
      JOIN "scene" s ON s.id = ps."sceneId"
      GROUP BY ps."sceneId", s.title
      ORDER BY count DESC
      LIMIT 10
    `;
  }
}

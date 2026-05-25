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
  totalPracticeCount: number;
  todayPracticeCount: number;
  totalMockCount: number;
  questionBankCount: number;
  questionItemCount: number;
  revenueTrend: { date: string; amount: number }[];
  practiceTrend: { date: string; count: number }[];
  topBanks: { id: string; name: string; province: string; practiceCount: number }[];
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
      totalPracticeCount,
      todayPracticeCount,
      totalMockCount,
      questionBankCount,
      questionItemCount,
      revenueTrendRaw,
      practiceTrendRaw,
      topBanksRaw,
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

      // 总练习记录数
      this.prisma.practiceRecord.count(),

      // 今日练习记录数
      this.prisma.practiceRecord.count({
        where: { createdAt: { gte: todayStart } },
      }),

      // 总模考次数
      this.prisma.mockExamRecord.count(),

      // 题库总数
      this.prisma.questionBank.count(),

      // 题目总数
      this.prisma.questionItem.count(),

      // 近 30 天每日收入趋势
      this.revenueTrendQuery(thirtyDaysAgo),

      // 近 30 天每日练习量趋势
      this.practiceTrendQuery(thirtyDaysAgo),

      // 热门题库 Top 10（按练习记录数）
      this.topBanksQuery(),
    ]);

    // Resolve question bank names for topBanks
    const bankIds = topBanksRaw.map((b) => b.bankId);
    const banks = await this.prisma.questionBank.findMany({
      where: { id: { in: bankIds } },
      select: { id: true, name: true, province: true },
    });
    const bankMap = new Map(banks.map((b) => [b.id, b]));

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
      totalPracticeCount,
      todayPracticeCount,
      totalMockCount,
      questionBankCount,
      questionItemCount,
      revenueTrend: revenueTrendRaw.map((r) => ({
        date: r.date,
        amount: Number(r.amount),
      })),
      practiceTrend: practiceTrendRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      topBanks: topBanksRaw.map((b) => {
        const bank = bankMap.get(b.bankId);
        return {
          id: b.bankId,
          name: bank?.name ?? '未知题库',
          province: bank?.province ?? '',
          practiceCount: Number(b.count),
        };
      }),
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

  /** Daily practice count for last 30 days. */
  private async practiceTrendQuery(since: Date) {
    return this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE("createdAt") AS date, COUNT(*)::int AS count
      FROM "practice_record"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
  }

  /** Top 10 question banks by practice record count. */
  private async topBanksQuery() {
    return this.prisma.$queryRaw<
      { bankId: string; count: bigint }[]
    >`
      SELECT qt."bankId", COUNT(*)::int AS count
      FROM "practice_record" pr
      JOIN "question_item" qi ON qi.id = pr."questionId"
      JOIN "question_topic" qt ON qt.id = qi."topicId"
      GROUP BY qt."bankId"
      ORDER BY count DESC
      LIMIT 10
    `;
  }
}

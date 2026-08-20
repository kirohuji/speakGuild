import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  addDateKeyDays,
  dateKeyInTimeZone,
  formatDateKey,
  parseDateKey,
  todayDateKey,
} from '../../common/calendar-date';

const CHECK_IN_BASE_POINTS = 10;
const STREAK_BONUS_CAP = 5; // max bonus per day from streak
const MAX_CALENDAR_RANGE_DAYS = 62;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseCalendarDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new BadRequestException('日期格式应为 YYYY-MM-DD');
  }

  const date = parseDateKey(value);
  if (!date) {
    throw new BadRequestException('日期无效');
  }

  return date;
}

function formatCalendarDate(date: Date) {
  return formatDateKey(date);
}

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get user's current points balance */
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    return { points: user?.points ?? 0 };
  }

  /** Get today's check-in status */
  private async findCheckInByUserDate(userId: string, dateKey: string, timeZone: string) {
    const date = parseCalendarDate(dateKey);
    const candidates = await this.prisma.userCheckIn.findMany({
      where: {
        userId,
        date: { gte: addDateKeyDays(date, -1), lte: addDateKeyDays(date, 1) },
      },
      orderBy: { createdAt: 'desc' },
    });

    // createdAt is authoritative for legacy rows that were saved one day early.
    return candidates.find((item) => dateKeyInTimeZone(item.createdAt, timeZone) === dateKey)
      ?? candidates.find((item) => formatCalendarDate(item.date) === dateKey)
      ?? null;
  }

  async getCheckInStatus(userId: string, timeZone: string) {
    const todayKey = todayDateKey(timeZone);
    const today = parseCalendarDate(todayKey);
    const existing = await this.findCheckInByUserDate(userId, todayKey, timeZone);

    // Get yesterday's check-in for streak info
    const yesterdayKey = formatCalendarDate(addDateKeyDays(today, -1));
    const yesterdayCheckIn = await this.findCheckInByUserDate(userId, yesterdayKey, timeZone);

    return {
      checkedIn: !!existing,
      todayPoints: existing?.points ?? 0,
      currentStreak: existing?.streak ?? yesterdayCheckIn?.streak ?? 0,
    };
  }

  /** Get check-in dates for the calendar */
  async getCheckInCalendar(userId: string, startDate?: string, endDate?: string, timeZone = 'Asia/Shanghai') {
    if (!startDate || !endDate) {
      throw new BadRequestException('请提供日历查询范围');
    }

    const rangeStart = parseCalendarDate(startDate);
    const rangeEnd = parseCalendarDate(endDate);
    if (rangeStart > rangeEnd) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }
    const rangeDays = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1;
    if (rangeDays > MAX_CALENDAR_RANGE_DAYS) {
      throw new BadRequestException(`日历查询范围不能超过 ${MAX_CALENDAR_RANGE_DAYS} 天`);
    }

    const [checkIns, totalCheckIns, status, runs] = await Promise.all([
      this.prisma.userCheckIn.findMany({
        where: {
          userId,
          // Include a one-day buffer for legacy rows written from local midnight.
          date: { gte: addDateKeyDays(rangeStart, -1), lte: addDateKeyDays(rangeEnd, 1) },
        },
        orderBy: { date: 'asc' },
        select: { date: true, createdAt: true },
      }),
      this.prisma.userCheckIn.count({ where: { userId } }),
      this.getCheckInStatus(userId, timeZone),
      (this.prisma as any).userDailyPracticeRun.findMany({
        where: { userId, date: { gte: rangeStart, lte: rangeEnd } },
        select: { date: true, completedItemIds: true, stats: true },
      }),
    ]);

    const dailyStats = runs.map((run: any) => {
      const stats = run.stats && typeof run.stats === 'object' && !Array.isArray(run.stats) ? run.stats : {};
      const activity = stats.activity && typeof stats.activity === 'object' && !Array.isArray(stats.activity) ? Object.values(stats.activity) as any[] : [];
      const activeSeconds = activity.reduce((total, item) => total + Math.max(0, Math.min(1800, Number(item?.activeSeconds) || 0)), 0);
      const dialogueQuestions = activity
        .filter((item) => item?.scope === 'dialogue')
        .reduce((total, item) => total + Math.max(0, Number(item?.questionCount) || 0), 0);
      return {
        date: formatCalendarDate(run.date),
        questionCount: (run.completedItemIds?.length ?? 0) + dialogueQuestions,
        activeSeconds,
      };
    });

    return {
      dates: [...new Set(checkIns
        .map((item) => dateKeyInTimeZone(item.createdAt, timeZone))
        .filter((date) => date >= startDate && date <= endDate))].sort(),
      totalCheckIns,
      currentStreak: status.currentStreak,
      dailyStats,
    };
  }

  /** Perform daily check-in */
  async checkIn(userId: string, timeZone: string) {
    const todayKey = todayDateKey(timeZone);
    const today = parseCalendarDate(todayKey);

    // Check if already checked in today
    const existing = await this.findCheckInByUserDate(userId, todayKey, timeZone);

    if (existing) {
      throw new BadRequestException('今天已经签到过了');
    }

    // Calculate streak
    const yesterdayKey = formatCalendarDate(addDateKeyDays(today, -1));
    const yesterdayCheckIn = await this.findCheckInByUserDate(userId, yesterdayKey, timeZone);

    const streak = (yesterdayCheckIn?.streak ?? 0) + 1;
    const streakBonus = Math.min(streak - 1, STREAK_BONUS_CAP);
    const points = CHECK_IN_BASE_POINTS + streakBonus;

    // Create check-in record and update points in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const checkIn = await tx.userCheckIn.create({
        data: {
          userId,
          date: today,
          points,
          streak,
        },
      });

      const updated = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: points } },
        select: { points: true },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'check_in',
          amount: points,
          balance: updated.points,
          description: `每日签到 +${points}积分（连续${streak}天）`,
          referenceId: checkIn.id,
        },
      });

      return { points: updated.points, checkIn };
    });

    return {
      points: result.points,
      earned: points,
      streak,
      message: streak > 1
        ? `签到成功！连续${streak}天，获得${points}积分`
        : `签到成功！获得${points}积分`,
    };
  }

  /** Get point transaction history */
  async getTransactions(userId: string, page = 1, pageSize = 20) {
    const [list, total] = await Promise.all([
      this.prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pointTransaction.count({ where: { userId } }),
    ]);

    return { list, total, page, pageSize };
  }

  /** Redeem points — deduct and record */
  async redeemPoints(userId: string, amount: number, orderNo: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user || user.points < amount) {
      throw new BadRequestException('积分不足');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { points: { decrement: amount } },
        select: { points: true },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'redemption',
          amount: -amount,
          balance: updated.points,
          description: `积分抵扣 -${amount}积分`,
          referenceId: orderNo,
        },
      });

      return updated;
    });

    return result;
  }
}

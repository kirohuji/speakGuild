import { Prisma } from '@prisma/client';
import { LearningStatisticsService } from '../../common/learning-statistics/learning-statistics.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  addDateKeyDays,
  formatDateKey,
  parseDateKey,
  todayDateKey,
} from '../../common/calendar-date';

export const MAKEUP_COST = 200;
const CHECK_IN_BASE_POINTS = 10;
const STREAK_BONUS_CAP = 5; // max bonus per day from streak
const MAX_CALENDAR_RANGE_DAYS = 371;
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
  constructor(private readonly prisma: PrismaService, private readonly learningStatistics: LearningStatisticsService) {}

  /** Get user's current points balance */
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    return { points: user?.points ?? 0 };
  }

  private async streakAt(userId: string, date: string, db: Pick<PrismaService, '$queryRaw'> = this.prisma): Promise<number> {
    const rows = await db.$queryRaw<Array<{ count: number }>>`WITH RECURSIVE streak(day,n) AS (
      SELECT ${date}::date,0 UNION ALL SELECT day-1,n+1 FROM streak WHERE EXISTS(
        SELECT 1 FROM user_check_in WHERE "userId"=${userId} AND date=streak.day)
    ) SELECT MAX(n) AS count FROM streak`;
    return rows[0]?.count ?? 0;
  }

  async getCheckInStatus(userId: string, timeZone: string, db: Prisma.TransactionClient = this.prisma) {
    const todayKey = todayDateKey(timeZone);
    const existing = await db.userCheckIn.findUnique({ where: { userId_date: { userId, date: parseCalendarDate(todayKey) } } });
    const anchor = existing ? todayKey : formatDateKey(addDateKeyDays(parseCalendarDate(todayKey), -1));
    return { checkedIn: !!existing, todayPoints: existing?.points ?? 0, currentStreak: await this.streakAt(userId, anchor, db), today: todayKey };
  }

  async getMakeupInfo(userId: string, timeZone: string) {
    const today = todayDateKey(timeZone);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
    return { cost: MAKEUP_COST, pointsBalance: user?.points ?? 0, today,
      latestDate: formatDateKey(addDateKeyDays(parseCalendarDate(today), -1)) };
  }

  async makeupCheckIn(userId: string, dateKey: string, timeZone: string) {
    const date = parseCalendarDate(dateKey);
    return this.prisma.$transaction(async tx => {
      // Serialize duplicate checks and every debit for this account; never trust client balances.
      await tx.$queryRaw`SELECT id FROM "user" WHERE id=${userId} FOR UPDATE`;
      const existing = await tx.userCheckIn.findUnique({ where: { userId_date: { userId, date } } });
      if (existing) {
        if (!existing.isMakeup) throw new BadRequestException({ code: 'MAKEUP_ALREADY_CHECKED_IN', message: '该日期已经签到' });
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
        return { points: user.points, date: dateKey, cost: existing.makeupCost, alreadyApplied: true, status: await this.getCheckInStatus(userId, timeZone, tx) };
      }
      const today = parseCalendarDate(todayDateKey(timeZone));
      if (date >= today) {
        throw new BadRequestException({ code: 'MAKEUP_OUT_OF_RANGE', message: '只能补签过去的日期，不含今天' });
      }
      const debit = await tx.user.updateMany({ where: { id: userId, points: { gte: MAKEUP_COST } }, data: { points: { decrement: MAKEUP_COST } } });
      if (debit.count !== 1) throw new BadRequestException({ code: 'MAKEUP_INSUFFICIENT_POINTS', message: '积分不足，需要200积分' });
      const previousDay = formatDateKey(addDateKeyDays(date,-1));
      const checkIn = await tx.userCheckIn.create({ data: { userId, date, points: 0,
        streak: (await this.streakAt(userId, previousDay, tx))+1, isMakeup: true, makeupCost: MAKEUP_COST } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
      await tx.pointTransaction.create({ data: { userId, type: 'makeup_check_in', amount: -MAKEUP_COST,
        balance: user.points, description: `补签 ${dateKey} -${MAKEUP_COST}积分`, referenceId: checkIn.id } });
      return { points: user.points, date: dateKey, cost: MAKEUP_COST, alreadyApplied: false, status: await this.getCheckInStatus(userId, timeZone, tx) };
    });
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

    const [checkIns, totalCheckIns, status, statistics, makeup] = await Promise.all([
      this.prisma.userCheckIn.findMany({
        where: {
          userId,
          date: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { date: 'asc' },
        select: { date: true, isMakeup: true },
      }),
      this.prisma.userCheckIn.count({ where: { userId } }),
      this.getCheckInStatus(userId, timeZone),
      this.learningStatistics.get(userId, startDate, endDate, timeZone),
      this.getMakeupInfo(userId, timeZone),
    ]);
    const dailyStats = statistics.dailyStats.filter(day => day.date >= startDate && day.date <= endDate);

    return {
      startDate, endDate, today: status.today,
      dates: checkIns.map(item => formatDateKey(item.date)),
      makeupDates: checkIns.filter(item => item.isMakeup).map(item => formatDateKey(item.date)),
      makeup,
      totalCheckIns,
      currentStreak: status.currentStreak,
      dailyStats,
    };
  }

  /** Perform daily check-in */
  async checkIn(userId: string, timeZone: string) {
    const todayKey = todayDateKey(timeZone);
    const today = parseCalendarDate(todayKey);

    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "user" WHERE id=${userId} FOR UPDATE`;
      const existing = await tx.userCheckIn.findUnique({ where: { userId_date: { userId, date: today } } });
      if (existing) throw new BadRequestException('今天已经签到过了');
      const yesterdayKey = formatDateKey(addDateKeyDays(today,-1));
      const streak = (await this.streakAt(userId,yesterdayKey,tx))+1;
      const points = CHECK_IN_BASE_POINTS + Math.min(streak-1,STREAK_BONUS_CAP);
      const checkIn = await tx.userCheckIn.create({ data: { userId, date: today, points, streak } });
      const updated = await tx.user.update({ where: { id:userId },data: { points: { increment:points } }, select:{ points:true } });
      await tx.pointTransaction.create({ data: { userId,type:'check_in',amount:points,balance:updated.points,
        description:`每日签到 +${points}积分（连续${streak}天）`,referenceId:checkIn.id } });
      return { points:updated.points,earned:points,streak };
    });
    const { earned: points, streak } = result;

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
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('积分金额无效');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user || user.points < amount) {
      throw new BadRequestException('积分不足');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({ where: { id: userId, points: { gte: amount } }, data: { points: { decrement: amount } } });
      if (debit.count !== 1) throw new BadRequestException('积分不足');
      const updated = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });

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

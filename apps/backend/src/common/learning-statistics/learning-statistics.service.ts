import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { todayDateKey, DEFAULT_CLIENT_TIME_ZONE } from '../calendar-date';

/** Server implementation: indexed PostgreSQL projections, independent of mobile aggregation. */
@Injectable()
export class LearningStatisticsService {
  constructor(private readonly prisma: PrismaService) {}
  async get(userId: string, start?: string, end?: string, timeZone = DEFAULT_CLIENT_TIME_ZONE) {
    const today = todayDateKey(timeZone);
    const [totals, days, streak, hours] = await Promise.all([
      this.prisma.$queryRaw<any[]>`SELECT * FROM learning_stat_totals WHERE user_id=${userId}`,
      start && end ? this.prisma.$queryRaw<any[]>`SELECT date::text,question_count AS "questionCount",active_seconds AS "activeSeconds",true AS active
        FROM learning_stat_days WHERE user_id=${userId} AND date>=${start}::date AND date<=${end}::date
          AND (question_count>0 OR active_seconds>0) ORDER BY date` : Promise.resolve([]),
      this.prisma.$queryRaw<any[]>`WITH RECURSIVE streak(day,n) AS (
        SELECT CASE WHEN EXISTS(SELECT 1 FROM learning_stat_days WHERE user_id=${userId} AND date=${today}::date
          AND (question_count>0 OR active_seconds>0)) THEN ${today}::date ELSE ${today}::date-1 END,0
        UNION ALL SELECT day-1,n+1 FROM streak WHERE EXISTS(SELECT 1 FROM learning_stat_days
          WHERE user_id=${userId} AND date=streak.day AND (question_count>0 OR active_seconds>0))
      ) SELECT MAX(n) AS count FROM streak`,
      start && start===end ? this.prisma.$queryRaw<any[]>`SELECT hour,question_count AS "questionCount",active_seconds AS "activeSeconds"
        FROM learning_stat_hours WHERE user_id=${userId} AND date=${start}::date AND (question_count>0 OR active_seconds>0) ORDER BY hour` : Promise.resolve([]),
    ]);
    const total = totals[0] ?? {};
    return { hourlyStats:hours, hourlyComplete:start===end && hours.reduce((n,h)=>n+h.questionCount,0)===(days[0]?.questionCount??0) && hours.reduce((n,h)=>n+h.activeSeconds,0)===(days[0]?.activeSeconds??0), dailyStats: days, activeDays: total.active_days ?? 0, uniqueQuestionsAnswered: total.unique_questions ?? 0,
      activeSeconds: total.active_seconds ?? 0, currentStreakDays: streak[0]?.count ?? 0,
      avgDailyQuestions: total.active_days ? Math.round(total.question_days / total.active_days) : 0 };
  }
}

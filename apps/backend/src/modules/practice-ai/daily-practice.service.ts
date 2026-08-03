import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scheduleReview, warmupScoreToReviewRating } from '../../common/spaced-repetition';

type WarmupScore = 'strong' | 'ok' | 'weak' | 'miss';

interface DailyPracticeAttemptInput {
  clientAttemptId: string;
  itemId: string;
  packId: string;
  topicId: string;
  type: string;
  score: WarmupScore;
  passed?: boolean;
  payload?: any;
  practicedAt?: string;
}

interface DailyPracticeRunInput {
  id?: string;
  date: string;
  scope: string;
  packIds: string[];
  scheduledItemIds: string[];
  completedItemIds: string[];
  stats?: any;
}

type ActivityStats = Record<string, { scope: 'daily' | 'dialogue'; activeSeconds: number; questionCount: number }>;

function toActivityStats(value: unknown): ActivityStats {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = (value as any).activity;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([key, item]) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const scope = (item as any).scope === 'dialogue' ? 'dialogue' : 'daily';
    return [[key, {
      scope,
      activeSeconds: Math.max(0, Math.min(1800, Number((item as any).activeSeconds) || 0)),
      questionCount: Math.max(0, Number((item as any).questionCount) || 0),
    }]];
  }));
}

export function warmupScoreRank(score?: string | null) {
  if (score === 'strong') return 3;
  if (score === 'ok') return 2;
  if (score === 'weak') return 1;
  return 0;
}

function startOfDate(value: string | Date) {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

@Injectable()
export class DailyPracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProgress(userId: string, itemIds?: string[]) {
    const where: any = { userId };
    if (itemIds?.length) where.itemId = { in: itemIds };
    const items = await (this.prisma as any).userWarmupItemProgress.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return { items };
  }

  async recordActivity(userId: string, body: {
    date?: string;
    sourceId?: string;
    scope?: 'daily' | 'dialogue';
    activeSeconds?: number;
    questionCount?: number;
  }) {
    const date = typeof body.date === 'string' ? startOfDate(body.date) : new Date();
    const sourceId = String(body.sourceId ?? '').trim();
    const scope = body.scope === 'dialogue' ? 'dialogue' : 'daily';
    const activeSeconds = Math.max(0, Math.min(1800, Math.floor(Number(body.activeSeconds) || 0)));
    if (!/^[-:_a-zA-Z0-9]{3,180}$/.test(sourceId) || activeSeconds === 0) {
      return { accepted: false };
    }

    const existing = await (this.prisma as any).userDailyPracticeRun.findUnique({
      where: { userId_date: { userId, date } },
      select: { stats: true },
    });
    const activity = toActivityStats(existing?.stats);
    const previous = activity[sourceId];
    activity[sourceId] = {
      scope,
      activeSeconds: Math.max(previous?.activeSeconds ?? 0, activeSeconds),
      questionCount: Math.max(previous?.questionCount ?? 0, Math.floor(Number(body.questionCount) || 0)),
    };
    const currentStats = existing?.stats && typeof existing.stats === 'object' && !Array.isArray(existing.stats)
      ? existing.stats as Record<string, unknown>
      : {};

    await (this.prisma as any).userDailyPracticeRun.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, scope, packIds: [], scheduledItemIds: [], completedItemIds: [], stats: { ...currentStats, activity } },
      update: { stats: { ...currentStats, activity } },
    });
    return { accepted: true };
  }

  async complete(userId: string, body: {
    run: DailyPracticeRunInput;
    attempts: DailyPracticeAttemptInput[];
    warmupRecord?: { topicId: string; topicTitle?: string; items: any[]; score?: number | null; feedback?: string | null };
  }) {
    const requestedPackIds = [...new Set(body.run.packIds ?? [])];
    if (requestedPackIds.length > 0) {
      const nonPracticePack = await this.prisma.scene.findFirst({
        where: { id: { in: requestedPackIds }, contentMode: { not: 'practice' } },
        select: { id: true, title: true },
      });
      if (nonPracticePack) {
        throw new BadRequestException(`“${nonPracticePack.title}”不参与今日任务`);
      }
    }
    const syncedAttempts: string[] = [];

    const existingRun = await (this.prisma as any).userDailyPracticeRun.findUnique({
      where: { userId_date: { userId, date: startOfDate(body.run.date) } },
      select: { stats: true },
    });
    const mergedStats = {
      ...(existingRun?.stats && typeof existingRun.stats === 'object' && !Array.isArray(existingRun.stats) ? existingRun.stats : {}),
      ...(body.run.stats ?? {}),
    };
    const run = await (this.prisma as any).userDailyPracticeRun.upsert({
      where: { userId_date: { userId, date: startOfDate(body.run.date) } },
      create: {
        userId,
        date: startOfDate(body.run.date),
        scope: body.run.scope,
        packIds: body.run.packIds ?? [],
        scheduledItemIds: body.run.scheduledItemIds ?? [],
        completedItemIds: body.run.completedItemIds ?? [],
        stats: mergedStats,
      },
      update: {
        scope: body.run.scope,
        packIds: body.run.packIds ?? [],
        scheduledItemIds: body.run.scheduledItemIds ?? [],
        completedItemIds: body.run.completedItemIds ?? [],
        stats: mergedStats,
      },
    });

    const attempts = [...(body.attempts ?? [])].sort((a, b) =>
      (toDate(a.practicedAt)?.getTime() ?? 0) - (toDate(b.practicedAt)?.getTime() ?? 0),
    );
    const affectedItemIds = new Set<string>();
    for (const attempt of attempts) {
      const practicedAt = toDate(attempt.practicedAt) ?? new Date();
      const rank = warmupScoreRank(attempt.score);
      affectedItemIds.add(attempt.itemId);
      try {
        await (this.prisma as any).userDailyPracticeAttempt.create({
          data: {
            clientAttemptId: attempt.clientAttemptId,
            userId,
            itemId: attempt.itemId,
            packId: attempt.packId,
            topicId: attempt.topicId,
            runId: run.id,
            score: attempt.score,
            scoreRank: rank,
            passed: attempt.passed ?? rank >= 2,
            payload: attempt.payload ?? {},
            practicedAt,
          },
        });
      } catch (error) {
        // clientAttemptId is idempotency key; duplicate means already synced.
        if ((error as any)?.code !== 'P2002') throw error;
      }
      syncedAttempts.push(attempt.clientAttemptId);
    }

    for (const itemId of affectedItemIds) {
      await this.rebuildItemProgress(userId, itemId);
    }
    await this.syncSceneProgressFromWarmup(userId, body.run.packIds ?? []);

    const itemProgresses = affectedItemIds.size > 0
      ? await (this.prisma as any).userWarmupItemProgress.findMany({
          where: { userId, itemId: { in: [...affectedItemIds] } },
        })
      : [];

    let warmupRecord: any = null;
    if (body.warmupRecord?.topicId && body.warmupRecord.items?.length) {
      warmupRecord = await (this.prisma as any).practiceWarmupRecord.create({
        data: {
          userId,
          topicId: body.warmupRecord.topicId,
          score: body.warmupRecord.score ?? null,
          feedback: body.warmupRecord.feedback ?? null,
          items: body.warmupRecord.items,
        },
      });
    }

    return {
      runId: run.id,
      syncedAttempts,
      itemProgresses,
      warmupRecordId: warmupRecord?.id ?? null,
    };
  }

  private async rebuildItemProgress(userId: string, itemId: string) {
    const attempts = await (this.prisma as any).userDailyPracticeAttempt.findMany({
      where: { userId, itemId },
      orderBy: [{ practicedAt: 'asc' }, { createdAt: 'asc' }],
    });
    if (attempts.length === 0) return null;

    let schedule = scheduleReview(
      { reviewCount: 0, intervalDays: 0, easeFactor: 2.5, lapseCount: 0 },
      warmupScoreToReviewRating(attempts[0].score),
      attempts[0].practicedAt,
    );
    let best = attempts[0];
    for (const attempt of attempts.slice(1)) {
      schedule = scheduleReview(
        schedule,
        warmupScoreToReviewRating(attempt.score),
        attempt.practicedAt,
      );
      if (attempt.scoreRank >= best.scoreRank) best = attempt;
    }

    const latest = attempts[attempts.length - 1];
    const data = {
      packId: latest.packId,
      topicId: latest.topicId,
      type: latest.type,
      status: schedule.status,
      dueDate: startOfDate(schedule.dueAt),
      lastPracticedAt: latest.practicedAt,
      bestScore: best.score,
      bestScoreRank: best.scoreRank,
      lastScore: latest.score,
      lastScoreRank: latest.scoreRank,
      attempts: attempts.length,
      correctCount: attempts.filter((attempt: any) => attempt.scoreRank >= 2).length,
      reviewCount: schedule.reviewCount,
      lapseCount: schedule.lapseCount,
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
    };

    return (this.prisma as any).userWarmupItemProgress.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, ...data },
      update: data,
    });
  }

  private async syncSceneProgressFromWarmup(userId: string, packIds: string[]) {
    const uniquePackIds = [...new Set((packIds ?? []).filter(Boolean))];
    if (uniquePackIds.length === 0) return;

    await Promise.all(uniquePackIds.map(async (sceneId) => {
      const [completedPracticeCount, scene] = await Promise.all([
        (this.prisma as any).userWarmupItemProgress.count({
          where: {
            userId,
            packId: sceneId,
            bestScoreRank: { gte: 2 },
          },
        }),
        this.prisma.scene.findUnique({
          where: { id: sceneId },
          include: {
            trainingTopics: {
              select: {
                _count: { select: { topicVocabs: true, activeChunks: true } },
              },
            },
          },
        }),
      ]);
      if (!scene) return;

      let vocabTotal = 0;
      let chunkTotal = 0;
      for (const topic of scene.trainingTopics) {
        vocabTotal += (topic as any)._count?.topicVocabs ?? 0;
        chunkTotal += (topic as any)._count?.activeChunks ?? 0;
      }

      await this.prisma.userSceneProgress.upsert({
        where: { userId_sceneId: { userId, sceneId } },
        create: {
          userId,
          sceneId,
          vocabTotal,
          chunkTotal,
          completedPracticeCount,
        },
        update: {
          vocabTotal,
          chunkTotal,
          completedPracticeCount,
        },
      });
    }));
  }
}

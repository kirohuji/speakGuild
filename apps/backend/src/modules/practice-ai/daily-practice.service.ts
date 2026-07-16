import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

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

interface DailyPracticeProgressInput {
  itemId: string;
  packId: string;
  topicId: string;
  type: string;
  status: string;
  dueDate: string;
  lastPracticedAt?: string | null;
  bestScore?: WarmupScore | null;
  bestScoreRank?: number;
  lastScore?: WarmupScore | null;
  lastScoreRank?: number;
  attempts?: number;
  correctCount?: number;
  streak?: number;
  lapseCount?: number;
  intervalDays?: number;
  easeFactor?: number;
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

function latestDate(a?: Date | null, b?: Date | null) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
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
    itemProgresses: DailyPracticeProgressInput[];
    warmupRecord?: { topicId: string; topicTitle?: string; items: any[]; score?: number | null; feedback?: string | null };
  }) {
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

    for (const attempt of body.attempts ?? []) {
      const practicedAt = toDate(attempt.practicedAt) ?? new Date();
      const rank = warmupScoreRank(attempt.score);
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
      } catch {
        // clientAttemptId is idempotency key; duplicate means already synced.
      }
      syncedAttempts.push(attempt.clientAttemptId);
    }

    for (const progress of body.itemProgresses ?? []) {
      await this.mergeItemProgress(userId, progress);
    }
    await this.syncSceneProgressFromWarmup(userId, body.run.packIds ?? []);

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
      warmupRecordId: warmupRecord?.id ?? null,
    };
  }

  private async mergeItemProgress(userId: string, progress: DailyPracticeProgressInput) {
    const incomingLastAt = toDate(progress.lastPracticedAt);
    const incomingBestRank = progress.bestScoreRank ?? warmupScoreRank(progress.bestScore);
    const incomingLastRank = progress.lastScoreRank ?? warmupScoreRank(progress.lastScore);
    const existing = await (this.prisma as any).userWarmupItemProgress.findUnique({
      where: { userId_itemId: { userId, itemId: progress.itemId } },
    });

    if (!existing) {
      return (this.prisma as any).userWarmupItemProgress.create({
        data: {
          userId,
          itemId: progress.itemId,
          packId: progress.packId,
          topicId: progress.topicId,
          type: progress.type,
          status: progress.status,
          dueDate: startOfDate(progress.dueDate),
          lastPracticedAt: incomingLastAt,
          bestScore: progress.bestScore ?? progress.lastScore ?? null,
          bestScoreRank: incomingBestRank,
          lastScore: progress.lastScore ?? null,
          lastScoreRank: incomingLastRank,
          attempts: progress.attempts ?? 0,
          correctCount: progress.correctCount ?? 0,
          streak: progress.streak ?? 0,
          lapseCount: progress.lapseCount ?? 0,
          intervalDays: progress.intervalDays ?? 0,
          easeFactor: progress.easeFactor ?? 2.5,
        },
      });
    }

    const latest = latestDate(existing.lastPracticedAt, incomingLastAt);
    const incomingIsLatest = !!incomingLastAt && (!existing.lastPracticedAt || incomingLastAt >= existing.lastPracticedAt);
    const bestScoreRank = Math.max(existing.bestScoreRank ?? 0, incomingBestRank);
    const bestScore =
      incomingBestRank >= (existing.bestScoreRank ?? 0)
        ? (progress.bestScore ?? progress.lastScore ?? existing.bestScore)
        : existing.bestScore;

    return (this.prisma as any).userWarmupItemProgress.update({
      where: { userId_itemId: { userId, itemId: progress.itemId } },
      data: {
        packId: progress.packId,
        topicId: progress.topicId,
        type: progress.type,
        status: incomingIsLatest ? progress.status : existing.status,
        dueDate: incomingIsLatest ? startOfDate(progress.dueDate) : existing.dueDate,
        lastPracticedAt: latest,
        bestScore,
        bestScoreRank,
        lastScore: incomingIsLatest ? (progress.lastScore ?? existing.lastScore) : existing.lastScore,
        lastScoreRank: incomingIsLatest ? incomingLastRank : existing.lastScoreRank,
        attempts: Math.max(existing.attempts ?? 0, progress.attempts ?? 0),
        correctCount: Math.max(existing.correctCount ?? 0, progress.correctCount ?? 0),
        streak: incomingIsLatest ? (progress.streak ?? existing.streak) : existing.streak,
        lapseCount: Math.max(existing.lapseCount ?? 0, progress.lapseCount ?? 0),
        intervalDays: incomingIsLatest ? (progress.intervalDays ?? existing.intervalDays) : existing.intervalDays,
        easeFactor: incomingIsLatest ? (progress.easeFactor ?? existing.easeFactor) : existing.easeFactor,
      },
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

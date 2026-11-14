import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { scheduleReview, warmupScoreToReviewRating } from '../../common/spaced-repetition';
import { formatDateKey, parseDateKey } from '../../common/calendar-date';

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
  clientRunId?: string;
  date: string;
  mode?: 'practice' | 'review';
  scope: string;
  packIds: string[];
  scheduledItemIds: string[];
  completedItemIds: string[];
  attemptedItemIds?: string[];
  unresolvedItemIds?: string[];
  srsAppliedItemIds?: string[];
  initialRecallResults?: any;
  continuationResults?: any;
  remediationResults?: any;
  attemptHistory?: any[];
  submissionStatus?: string;
  stats?: any;
}

type ActivityStats = Record<string, { scope: 'daily' | 'dialogue' | 'learning'; activeSeconds: number; questionCount: number }>;
const MAX_ACTIVE_SECONDS_PER_SOURCE = 4 * 60 * 60;

function toActivityStats(value: unknown): ActivityStats {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = (value as any).activity;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([key, item]) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const scope = (item as any).scope === 'dialogue' ? 'dialogue' : (item as any).scope === 'learning' ? 'learning' : 'daily';
    return [[key, {
      scope,
      activeSeconds: Math.max(0, Math.min(MAX_ACTIVE_SECONDS_PER_SOURCE, Number((item as any).activeSeconds) || 0)),
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
  // Daily task dates are calendar keys supplied by the client (YYYY-MM-DD),
  // not instants. Parsing them in the server timezone can shift the stored
  // @db.Date backwards by one day, making a restored run disagree with its
  // attempts and item progress. Keep date-only values in UTC end-to-end.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = parseDateKey(value);
    if (!date) throw new BadRequestException('Invalid calendar date');
    return date;
  }
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

/**
 * A run is a projection of individual attempts, not a last-writer-wins
 * document.  Different devices can legitimately advance different questions
 * in the same daily run, so snapshot fields are merged monotonically here.
 */
function uniqueStrings(...values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []))];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).sort().join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as any)[key])}`).join(',')}}`;
}

/**
 * Merge a result for one item, rather than treating its enclosing JSON map as
 * the conflict unit.  The rules are commutative/idempotent: a retry that
 * succeeded always wins; continuation counters never move backwards; ties
 * have a stable representative so arrival order cannot change the result.
 */
function mergeOneResult(previous: any, next: any, kind: 'initial' | 'continuation' | 'remediation') {
  if (!previous) return next;
  if (!next) return previous;
  if (kind === 'remediation') {
    if (Boolean(previous.resolved) !== Boolean(next.resolved)) return previous.resolved ? previous : next;
    const previousRank = warmupScoreRank(previous.score);
    const nextRank = warmupScoreRank(next.score);
    if (previousRank !== nextRank) return previousRank > nextRank ? previous : next;
    if ((previous.cycle ?? 0) !== (next.cycle ?? 0)) return (previous.cycle ?? 0) > (next.cycle ?? 0) ? previous : next;
  }
  if (kind === 'continuation') {
    if ((previous.attemptCount ?? 0) !== (next.attemptCount ?? 0)) return (previous.attemptCount ?? 0) > (next.attemptCount ?? 0) ? previous : next;
    if (previous.latestScore !== next.latestScore) return previous.latestScore === 'weak' ? previous : next;
  }
  if (kind === 'initial') {
    const previousRank = warmupScoreRank(previous.score);
    const nextRank = warmupScoreRank(next.score);
    if (previousRank !== nextRank) return previousRank > nextRank ? previous : next;
  }
  return stableJson(previous) <= stableJson(next) ? previous : next;
}

function mergeResultMap(existing: unknown, incoming: unknown, kind: 'initial' | 'continuation' | 'remediation'): Record<string, unknown> {
  const previous = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing as Record<string, unknown> : {};
  const next = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming as Record<string, unknown> : {};
  return Object.fromEntries([...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .map((itemId) => [itemId, mergeOneResult(previous[itemId], next[itemId], kind)]));
}

function mergeHistory(existing: unknown, incoming: unknown): any[] {
  const entries = [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
    .filter((entry) => entry && typeof entry === 'object');
  // New clients create UUID ids.  The content fallback preserves legacy events
  // whose old ordinal ids collide across devices instead of silently dropping one.
  const unique = new Map<string, any>();
  for (const entry of entries) {
    const key = typeof entry.id === 'string' && entry.id ? `${entry.id}:${stableJson(entry)}` : stableJson(entry);
    unique.set(key, entry);
  }
  return [...unique.values()].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || stableJson(a).localeCompare(stableJson(b)));
}

function mergeStats(existing: unknown, incoming: unknown): Record<string, unknown> {
  const oldValue = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing as Record<string, unknown> : {};
  const newValue = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming as Record<string, unknown> : {};
  const merge = (left: any, right: any): any => {
    if (left === undefined) return right;
    if (right === undefined) return left;
    if (Array.isArray(left) && Array.isArray(right)) return [...new Map([...left, ...right].map((v) => [stableJson(v), v])).values()];
    if (left && right && typeof left === 'object' && typeof right === 'object') return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map((key) => [key, merge(left[key], right[key])]));
    if (typeof left === 'number' && typeof right === 'number') return Math.max(left, right);
    return stableJson(left) <= stableJson(right) ? left : right;
  };
  return merge(oldValue, newValue);
}

function mergeWarmupItems(existing: unknown, incoming: unknown): any[] {
  const byStep = new Map<string, any>();
  for (const entry of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (!entry || typeof entry !== 'object') continue;
    const key = String((entry as any).stepId ?? stableJson(entry));
    const previous = byStep.get(key);
    if (!previous) { byStep.set(key, entry); continue; }
    // Preserve fields supplied by either device.  For two real answers to the
    // same card choose a stable non-empty representation instead of arrival
    // order; the complete event history remains in the run above.
    const merged: Record<string, any> = { ...previous, ...entry };
    for (const field of new Set([...Object.keys(previous), ...Object.keys(entry)])) {
      const left = previous[field]; const right = entry[field];
      if (Array.isArray(left) && Array.isArray(right)) merged[field] = [...new Map([...left, ...right].map((v) => [stableJson(v), v])).values()];
      else if (typeof left === 'string' && typeof right === 'string') merged[field] = left && right ? (stableJson(left) <= stableJson(right) ? left : right) : (left || right);
      else if (left && right && typeof left === 'object' && typeof right === 'object') merged[field] = { ...left, ...right };
    }
    // A card has one display slot, but two devices may contain different real
    // learner answers for that slot.  Keep every variant in the record rather
    // than pretending one of them never happened; the UI may continue to use
    // the canonical top-level representation.
    if (stableJson(previous) !== stableJson(entry)) {
      const withoutVariants = (value: any) => {
        const { _syncVariants: _ignored, ...plain } = value;
        return plain;
      };
      const variants = [...(Array.isArray(previous._syncVariants) ? previous._syncVariants : [withoutVariants(previous)]), ...(Array.isArray(entry._syncVariants) ? entry._syncVariants : [withoutVariants(entry)])];
      merged._syncVariants = [...new Map(variants.map((value) => [stableJson(value), value])).values()];
    }
    byStep.set(key, merged);
  }
  return [...byStep.values()];
}

function mergedSubmissionStatus(existing?: string | null, incoming?: string | null): string {
  const rank: Record<string, number> = { idle: 0, dirty: 1, failed: 1, submitting: 2, synced: 3 };
  return (rank[incoming ?? 'idle'] ?? 0) >= (rank[existing ?? 'idle'] ?? 0)
    ? (incoming ?? 'idle')
    : (existing ?? 'idle');
}

@Injectable()
export class DailyPracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentRun(userId: string, params: {
    date: string;
    mode?: 'practice' | 'review';
    scope?: 'single' | 'mixed';
    packId?: string;
  }) {
    const packId = String(params.packId ?? '').trim();
    const run = await (this.prisma as any).userDailyPracticeRun.findFirst({
      where: {
        userId,
        date: startOfDate(params.date),
        mode: params.mode === 'review' ? 'review' : 'practice',
        scope: params.scope === 'mixed' ? 'mixed' : 'single',
        ...(packId ? { packIds: { has: packId } } : {}),
        clientRunId: { not: { startsWith: 'activity:' } },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        clientRunId: true,
        date: true,
        mode: true,
        scope: true,
        packIds: true,
        scheduledItemIds: true,
        completedItemIds: true,
        attemptedItemIds: true,
        unresolvedItemIds: true,
        srsAppliedItemIds: true,
        initialRecallResults: true,
        continuationResults: true,
        remediationResults: true,
        attemptHistory: true,
        submissionStatus: true,
        stats: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { run };
  }

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
    scope?: 'daily' | 'dialogue' | 'learning';
    activeSeconds?: number;
    questionCount?: number;
  }) {
    const date = typeof body.date === 'string' ? startOfDate(body.date) : new Date();
    const sourceId = String(body.sourceId ?? '').trim();
    const scope = body.scope === 'dialogue' ? 'dialogue' : body.scope === 'learning' ? 'learning' : 'daily';
    const activeSeconds = Math.max(0, Math.min(MAX_ACTIVE_SECONDS_PER_SOURCE, Math.floor(Number(body.activeSeconds) || 0)));
    if (!/^[-:_a-zA-Z0-9]{3,180}$/.test(sourceId) || activeSeconds === 0) {
      return { accepted: false };
    }

    // Serialize updates for the same source across devices/retries. Independent
    // sources get independent rows; old daily activity rows remain readable.
    await this.prisma.$transaction(async (tx) => {
      const lockKey = `${userId}:${formatDateKey(date)}:${sourceId}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;
      // Keep activity separate from practice/review snapshots. The prior
      // find-first/update path could attach a timer update to an arbitrary run.
      const clientRunId = `activity:${formatDateKey(date)}:${sourceId}`;
      const existing = await tx.userDailyPracticeRun.findUnique({
        where: { userId_clientRunId: { userId, clientRunId } },
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

      await tx.userDailyPracticeRun.upsert({
        where: { userId_clientRunId: { userId, clientRunId } },
        create: { userId, date, clientRunId, mode: 'practice', scope, packIds: [], scheduledItemIds: [], completedItemIds: [], stats: { ...currentStats, activity } },
        update: { stats: { ...currentStats, activity } },
      });
    });
    return { accepted: true };
  }

  async complete(userId: string, body: {
    run: DailyPracticeRunInput;
    attempts: DailyPracticeAttemptInput[];
    warmupRecord?: { topicId: string; topicTitle?: string; items: any[]; score?: number | null; feedback?: string | null; packId?: string | null };
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

    const clientRunId = String(body.run.clientRunId ?? body.run.id ?? '').trim();
    if (!clientRunId) throw new BadRequestException('clientRunId is required');
    const run = await this.mergeRunSnapshot(userId, clientRunId, body.run);

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
            type: attempt.type ?? '',
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

    await Promise.all([...affectedItemIds].map((itemId) => this.rebuildItemProgress(userId, itemId)));
    await this.syncSceneProgressFromWarmup(userId, body.run.packIds ?? []);

    const itemProgresses = affectedItemIds.size > 0
      ? await (this.prisma as any).userWarmupItemProgress.findMany({
          where: { userId, itemId: { in: [...affectedItemIds] } },
        })
      : [];

    let warmupRecord: any = null;
    if (body.warmupRecord?.topicId && body.warmupRecord.items?.length) {
      warmupRecord = await this.mergeWarmupRecord(userId, clientRunId, body.warmupRecord);
    }

    return {
      runId: run.id,
      // The caller applies this canonical projection immediately.  It must not
      // wait for the cursor pull, which can legitimately have advanced past
      // this update in the same sync pass.
      run,
      syncedAttempts,
      itemProgresses,
      warmupRecordId: warmupRecord?.id ?? null,
    };
  }

  private async mergeRunSnapshot(userId: string, clientRunId: string, input: DailyPracticeRunInput) {
    const select = {
      stats: true, packIds: true, scheduledItemIds: true, completedItemIds: true,
      attemptedItemIds: true, unresolvedItemIds: true, srsAppliedItemIds: true,
      initialRecallResults: true, continuationResults: true, remediationResults: true,
      attemptHistory: true, submissionStatus: true,
    };
    // Serializable read/merge/write is required here.  `upsert` only makes
    // row creation atomic; it does not make two independently computed JSON
    // merges atomic.  Retrying serialization/unique conflicts recomputes the
    // second merge against the first committed projection.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await (this.prisma as any).$transaction(async (tx: any) => {
          const existing = await tx.userDailyPracticeRun.findUnique({
            where: { userId_clientRunId: { userId, clientRunId } }, select,
          });
          const incoming = {
            date: startOfDate(input.date), mode: input.mode ?? 'practice', scope: input.scope,
            packIds: input.packIds ?? [], scheduledItemIds: input.scheduledItemIds ?? [],
            completedItemIds: input.completedItemIds ?? [], attemptedItemIds: input.attemptedItemIds ?? [],
            unresolvedItemIds: input.unresolvedItemIds ?? [], srsAppliedItemIds: input.srsAppliedItemIds ?? [],
            initialRecallResults: input.initialRecallResults ?? {}, continuationResults: input.continuationResults ?? {},
            remediationResults: input.remediationResults ?? {}, attemptHistory: Array.isArray(input.attemptHistory) ? input.attemptHistory : [],
            submissionStatus: input.submissionStatus ?? 'synced', stats: mergeStats(existing?.stats, input.stats),
          };
          if (!existing) return tx.userDailyPracticeRun.create({ data: { userId, clientRunId, ...incoming } });
          const initialRecallResults = mergeResultMap(existing.initialRecallResults, incoming.initialRecallResults, 'initial');
          const continuationResults = mergeResultMap(existing.continuationResults, incoming.continuationResults, 'continuation');
          const remediationResults = mergeResultMap(existing.remediationResults, incoming.remediationResults, 'remediation');
          const attemptedItemIds = uniqueStrings(existing.attemptedItemIds, incoming.attemptedItemIds, Object.keys(initialRecallResults));
          const previousUnresolved = new Set(uniqueStrings(existing.unresolvedItemIds, incoming.unresolvedItemIds));
          // This is a projection, not another mutable conflict register.  A
          // winning strong/ok initial answer must remove a losing miss flag.
          const unresolvedItemIds = attemptedItemIds.filter((id) => {
            if (Boolean((remediationResults as any)[id]?.resolved)) return false;
            const initial = (initialRecallResults as any)[id];
            return initial ? initial.score === 'miss' : previousUnresolved.has(id);
          });
          const completedItemIds = uniqueStrings(existing.completedItemIds, incoming.completedItemIds, attemptedItemIds.filter((id) => !unresolvedItemIds.includes(id)))
            .filter((id) => !unresolvedItemIds.includes(id));
          return tx.userDailyPracticeRun.update({
            where: { userId_clientRunId: { userId, clientRunId } },
            data: {
              ...incoming,
              packIds: uniqueStrings(existing.packIds, incoming.packIds),
              scheduledItemIds: uniqueStrings(existing.scheduledItemIds, incoming.scheduledItemIds),
              attemptedItemIds, unresolvedItemIds, completedItemIds,
              srsAppliedItemIds: uniqueStrings(existing.srsAppliedItemIds, incoming.srsAppliedItemIds),
              initialRecallResults,
              continuationResults,
              remediationResults,
              attemptHistory: mergeHistory(existing.attemptHistory, incoming.attemptHistory),
              submissionStatus: mergedSubmissionStatus(existing.submissionStatus, incoming.submissionStatus),
            },
          });
        }, { isolationLevel: 'Serializable' });
      } catch (error: any) {
        if (attempt === 3 || (error?.code !== 'P2034' && error?.code !== 'P2002')) throw error;
      }
    }
    throw new Error('Unable to merge daily practice run');
  }

  private async mergeWarmupRecord(userId: string, clientRunId: string, input: NonNullable<Parameters<DailyPracticeService['complete']>[1]['warmupRecord']>) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await (this.prisma as any).$transaction(async (tx: any) => {
          const previous = await tx.practiceWarmupRecord.findUnique({
            where: { clientRunId }, select: { id: true, items: true, score: true, feedback: true },
          });
          const data = {
            userId, clientRunId, topicId: input.topicId, packId: input.packId ?? null,
            score: Math.max(previous?.score ?? 0, input.score ?? 0) || null,
            feedback: input.feedback || previous?.feedback || null,
            items: mergeWarmupItems(previous?.items, input.items),
          };
          return previous
            ? tx.practiceWarmupRecord.update({ where: { id: previous.id }, data })
            : tx.practiceWarmupRecord.create({ data });
        }, { isolationLevel: 'Serializable' });
      } catch (error: any) {
        if (attempt === 3 || (error?.code !== 'P2034' && error?.code !== 'P2002')) throw error;
      }
    }
    throw new Error('Unable to merge warmup record');
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
    // 旧 attempt 可能没有 type，从 itemId 推导（packId:topicId:itemKey:type:p-...:i-...）
    const typeFromItemId = (itemId: string) => itemId.split(':')[3] ?? '';
    const data = {
      packId: latest.packId,
      topicId: latest.topicId,
      type: latest.type || typeFromItemId(itemId),
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

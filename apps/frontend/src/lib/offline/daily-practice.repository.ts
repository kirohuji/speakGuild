import type { UnitDetail } from '@/features/learning/api/learning-api'
import { dailyPracticeApi } from '@/features/practice/api/english-practice-api'
import type { WarmupRecordEntry, WarmupScore } from '@/stores/warmup-session.store'
import { usePreferencesStore } from '@/stores/preferences.store'
import { setLearningBadgeCount } from '@/lib/native/learning-reminder'
import { learningPackService } from './learning-pack.service'
import { learningRepository } from './learning.repository'
import { ensurePackProjection, readPracticeSource, readUnitSummary } from './learning-pack-read-model'
import { practiceRepository } from './practice.repository'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'
import { createId, toIsoString } from './utils'
import { localDateKey, normalizeCalendarDate, utcDateKey } from '@/lib/date/calendar-date'
import { scheduleReview, warmupScoreToReviewRating } from '@/lib/spaced-repetition'
import type {
  AttemptHistoryEntry,
  ContinuationResult,
  InitialRecallResult,
  RemediationResult,
  SrsRating,
  StoredTodayRunFacts,
  SubmissionStatus,
} from '@/stores/today-practice.store'
import { compareReviewDebt, deriveTodayScheduledPracticeIds, selectPracticeBatch, selectReviewBatch } from './daily-practice.planner'
import { createWarmupPracticeItemId, stableHash } from './warmup-practice-item-id'
export { createWarmupPracticeItemId } from './warmup-practice-item-id'
export { compareReviewDebt, deriveTodayScheduledPracticeIds, selectPracticeBatch, selectReviewBatch } from './daily-practice.planner'

export type DailyPracticeStatus = 'new' | 'review' | 'overdue' | 'done' | 'mastered'
export type DailyPracticeScope = 'single' | 'mixed'
export type DailyPracticePlanMode = 'review' | 'practice'

export interface DailyPracticeProgress {
  id: string
  itemId: string
  packId: string
  topicId: string
  type: string
  status: 'new' | 'learning' | 'review' | 'mastered'
  dueDate: string
  lastPracticedAt?: string | null
  bestScore?: WarmupScore | null
  bestScoreRank: number
  lastScore?: WarmupScore | null
  lastScoreRank: number
  attempts: number
  correctCount: number
  reviewCount: number
  lapseCount: number
  intervalDays: number
  easeFactor: number
  updatedAt: string
}

export interface DailyPracticeCandidate {
  itemId: string
  packId: string
  packTitle: string
  topicId: string
  topicTitle: string
  type: string
  item: any
  prompt: any
  promptIndex: number
  patternIndex?: number
  label: string
  displayLabel: string
  headerContent: string
}

export interface ScheduledDailyPracticeItem extends DailyPracticeCandidate {
  scheduleStatus: DailyPracticeStatus
  progress: DailyPracticeProgress
}

export interface TopicDailyPracticeStats {
  topicId: string
  topicTitle: string
  packId: string
  packTitle: string
  activeChunksCount: number
  vocabCount: number
  chunkCount: number
  patternCount: number
  suggestedDurationSec: number
  difficulty: string
  totalCount: number
  todayNewCount: number
  todayReviewCount: number
  overdueCount: number
  doneTodayCount: number
  scheduledTodayCount: number
  masteredCount: number
  /** 累计已练：曾通过（bestScoreRank >= 2）的题数，与学习计划同口径 */
  practicedCount: number
  topicWarmupProgress: number
  status: DailyPracticeStatus
}

export interface DailyPracticePlan {
  runId: string
  date: string
  scope: DailyPracticeScope
  mode: DailyPracticePlanMode
  dailyGoal: number
  reviewBatchSize: number
  configFingerprint: string
  availableReviewCount: number
  practicePoolCount: number
  units: UnitDetail[]
  steps: ScheduledDailyPracticeItem[]
  topicStats: TopicDailyPracticeStats[]
  scheduledItemIds: string[]
}

export interface DailyPracticeAttempt {
  id: string
  clientAttemptId: string
  itemId: string
  packId: string
  topicId: string
  type: string
  score: WarmupScore
  passed: boolean
  payload?: any
  practicedAt: string
  syncStatus: 'pending' | 'synced'
  runId?: string
  rating?: SrsRating
  applyStatus?: 'applying' | 'applied'
  progressAfter?: DailyPracticeProgress
}

export type StoredDailyPracticeRun = {
  id: string
  date: string
  scope: DailyPracticeScope
  mode: DailyPracticePlanMode
  dailyPracticeGoal: number
  reviewBatchSize: number
  configFingerprint: string
  packIds: string[]
  packIdsKey: string
  scheduledItemIds: string[]
  attemptedItemIds: string[]
  unresolvedItemIds: string[]
  srsAppliedItemIds: string[]
  initialRecallResults: Record<string, InitialRecallResult>
  continuationResults: Record<string, ContinuationResult | undefined>
  remediationResults: Record<string, RemediationResult | undefined>
  attemptHistory: AttemptHistoryEntry[]
  /** Local-only delivery cursor.  It is never sent to the server. */
  syncedHistoryEventIds?: string[]
  incrementalSyncReady?: boolean
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced'
  submissionStatus: SubmissionStatus
  roundKind?: 'main' | 'mistakeRetry'
  sessionStepIds?: string[]
  currentStepId?: string | null
  activityMarked: boolean
  // Legacy-only migration input. Never used as the V2.5.1 truth source.
  completedItemIds?: string[]
  stats?: Record<string, unknown>
}

export type DailyPracticeRunSummary = {
  attemptedCount: number
  totalCount: number
}

type StoredActiveRunPointer = {
  id: string
  runId: string
  updatedAt: string
}

type StoredActiveDailyPracticePack = {
  id: 'daily:active-pack'
  packId: string
  updatedAt: string
}

const ACTIVE_DAILY_PRACTICE_PACK_ID = 'daily:active-pack'

async function getActivePracticePackId() {
  const activePack = await localDb
    .get<StoredActiveDailyPracticePack>('daily_practice_runs', ACTIVE_DAILY_PRACTICE_PACK_ID)
    .catch(() => null)
  return activePack?.packId ?? null
}

async function setActivePracticePackId(packId: string) {
  await localDb.put('daily_practice_runs', {
    id: ACTIVE_DAILY_PRACTICE_PACK_ID,
    packId,
    updatedAt: new Date().toISOString(),
  } satisfies StoredActiveDailyPracticePack)
}

function todayKey() {
  return localDateKey()
}

function normalizePlanDate(date?: string | null) {
  return normalizeCalendarDate(date, todayKey())
}

function practicedAtForDate(date: string) {
  return `${date}T12:00:00.000Z`
}

function packKey(packIds: string[]) {
  return [...packIds].sort().join(',') || 'none'
}

/** Keep client reconciliation byte-for-byte deterministic with the server. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).sort().join(',')}]`
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
}

/** Stamp pack attribution while the live plan steps are still in memory. */
function attributeWarmupRecords(steps: ScheduledDailyPracticeItem[], records: WarmupRecordEntry[]): WarmupRecordEntry[] {
  const stepsById = new Map(steps.map((step) => [step.itemId, step]))
  return records.map((record) => {
    const step = stepsById.get(record.stepId)
    if (!step) return record
    return {
      ...record,
      packId: record.packId || step.packId,
      packTitle: record.packTitle || step.packTitle,
      displayLabel: record.displayLabel || step.displayLabel,
      topicTitle: record.topicTitle || step.topicTitle,
    }
  })
}

function scoreRankForMerge(score?: string | null) {
  if (score === 'strong') return 3
  if (score === 'ok') return 2
  if (score === 'weak') return 1
  return 0
}

function mergeOneResult(previous: any, next: any, kind: 'initial' | 'continuation' | 'remediation') {
  if (!previous) return next
  if (!next) return previous
  if (kind === 'remediation') {
    if (Boolean(previous.resolved) !== Boolean(next.resolved)) return previous.resolved ? previous : next
    const [left, right] = [scoreRankForMerge(previous.score), scoreRankForMerge(next.score)]
    if (left !== right) return left > right ? previous : next
    if ((previous.cycle ?? 0) !== (next.cycle ?? 0)) return (previous.cycle ?? 0) > (next.cycle ?? 0) ? previous : next
  }
  if (kind === 'continuation') {
    if ((previous.attemptCount ?? 0) !== (next.attemptCount ?? 0)) return (previous.attemptCount ?? 0) > (next.attemptCount ?? 0) ? previous : next
    if (previous.latestScore !== next.latestScore) return previous.latestScore === 'weak' ? previous : next
  }
  if (kind === 'initial') {
    const [left, right] = [scoreRankForMerge(previous.score), scoreRankForMerge(next.score)]
    if (left !== right) return left > right ? previous : next
  }
  return stableJson(previous) <= stableJson(next) ? previous : next
}

function mergeResultMap(localValue: unknown, remoteValue: unknown, kind: 'initial' | 'continuation' | 'remediation') {
  const local = localValue && typeof localValue === 'object' && !Array.isArray(localValue) ? localValue as Record<string, unknown> : {}
  const remote = remoteValue && typeof remoteValue === 'object' && !Array.isArray(remoteValue) ? remoteValue as Record<string, unknown> : {}
  return Object.fromEntries([...new Set([...Object.keys(local), ...Object.keys(remote)])]
    .map((itemId) => [itemId, mergeOneResult(local[itemId], remote[itemId], kind)]))
}

function mergeStats(localValue: unknown, remoteValue: unknown): Record<string, unknown> {
  const merge = (left: any, right: any): any => {
    if (left === undefined) return right
    if (right === undefined) return left
    if (Array.isArray(left) && Array.isArray(right)) return [...new Map([...left, ...right].map((item) => [stableJson(item), item])).values()]
    if (left && right && typeof left === 'object' && typeof right === 'object') {
      return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map((key) => [key, merge(left[key], right[key])]))
    }
    if (typeof left === 'number' && typeof right === 'number') return Math.max(left, right)
    return stableJson(left) <= stableJson(right) ? left : right
  }
  return merge(
    localValue && typeof localValue === 'object' && !Array.isArray(localValue) ? localValue : {},
    remoteValue && typeof remoteValue === 'object' && !Array.isArray(remoteValue) ? remoteValue : {},
  )
}

function activeRunPointerId(date: string, mode: DailyPracticePlanMode, scope: DailyPracticeScope, ids: string[]) {
  return `daily-active:${date}:${mode}:${scope}:${packKey(ids)}`
}

function runMatchesScope(run: StoredDailyPracticeRun, scope: DailyPracticeScope, ids: string[]) {
  return run.scope === scope && run.packIdsKey === packKey(ids)
}

async function appliedReviewItemIds(runs: StoredDailyPracticeRun[]): Promise<Set<string>> {
  const runIds = new Set(runs.map((run) => run.id))
  const applied = new Set(runs.flatMap((run) => run.srsAppliedItemIds ?? []))
  if (runIds.size === 0) return applied

  // The journal is the durable SRS fact. A run snapshot can lag behind it
  // briefly while an answer is being persisted, so both projections must use
  // this union rather than disagreeing about what was already reviewed.
  const attempts = await localDb.list<DailyPracticeAttempt>('daily_practice_attempts')
  for (const attempt of attempts) {
    if (attempt.runId && runIds.has(attempt.runId) && attempt.applyStatus === 'applied') {
      applied.add(attempt.itemId)
    }
  }
  return applied
}

/** Write one server run into the local shape used by the Today state machine. */
export async function restoreRemoteDailyPracticeRun(item: any, acknowledgedHistoryIds: string[] = []): Promise<void> {
  const runId = typeof item?.clientRunId === 'string' ? item.clientRunId : ''
  if (!runId || runId.startsWith('activity:')) return
  const remoteUpdatedAt = toIsoString(item.updatedAt) ?? new Date().toISOString()
  const local = await localDb.get<Partial<StoredDailyPracticeRun>>('daily_practice_runs', runId)
  // Never use wall-clock ordering to reject a pull.  The response to this
  // device's own upload is necessarily older than its local acknowledgement,
  // yet may contain another device's merge.  Merge the two projections; the
  // pending outbox remains the durability boundary for any local delta.
  const union = (...values: unknown[]) => [...new Set(values.flatMap((value) => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []))]
  const history = [...(Array.isArray(local?.attemptHistory) ? local.attemptHistory : []), ...(Array.isArray(item.attemptHistory) ? item.attemptHistory : [])]
  const uniqueHistory = [...new Map(history.map((entry: any) => {
    const content = stableJson(entry)
    return [entry?.id ? `${entry.id}:${content}` : content, entry]
  })).values()].sort((left: any, right: any) =>
    String(left?.createdAt ?? '').localeCompare(String(right?.createdAt ?? '')) || stableJson(left).localeCompare(stableJson(right)))

  const scheduledItemIds = Array.isArray(item.scheduledItemIds) ? item.scheduledItemIds : []
  const packIds = Array.isArray(item.packIds) ? item.packIds : []
  const mergedPackIds = union(local?.packIds, packIds)
  const mergedScheduledItemIds = union(local?.scheduledItemIds, scheduledItemIds)
  const initialRecallResults = mergeResultMap(local?.initialRecallResults, item.initialRecallResults, 'initial')
  const continuationResults = mergeResultMap(local?.continuationResults, item.continuationResults, 'continuation')
  const remediationResults = mergeResultMap(local?.remediationResults, item.remediationResults, 'remediation')
  const attemptedItemIds = union(local?.attemptedItemIds, item.attemptedItemIds)
  const unresolvedInput = new Set(union(local?.unresolvedItemIds, item.unresolvedItemIds))
  const unresolvedItemIds = attemptedItemIds.filter((id) => {
    if ((remediationResults as any)[id]?.resolved) return false
    const initial = (initialRecallResults as any)[id]
    // Old runs can lack the result map. Preserve their explicit unresolved
    // state until the first modern snapshot arrives, but never retain a loser.
    return initial ? initial.score === 'miss' : unresolvedInput.has(id)
  })
  const completedItemIds = union(
    local?.completedItemIds,
    item.completedItemIds,
    attemptedItemIds.filter((id) => !unresolvedItemIds.includes(id)),
  ).filter((id) => !unresolvedItemIds.includes(id))
  const date = toIsoString(item.date)?.slice(0, 10) ?? local?.date
  if (!date) return
  const mode: DailyPracticePlanMode = item.mode === 'review' ? 'review' : 'practice'
  const scope: DailyPracticeScope = item.scope === 'mixed' ? 'mixed' : 'single'
  const packIdsKey = packKey(mergedPackIds)
  await localDb.put('daily_practice_runs', {
    ...local,
    id: runId,
    date,
    mode,
    scope,
    packIds: mergedPackIds,
    packIdsKey,
    scheduledItemIds: mergedScheduledItemIds,
    completedItemIds,
    attemptedItemIds,
    unresolvedItemIds,
    srsAppliedItemIds: union(local?.srsAppliedItemIds, item.srsAppliedItemIds),
    initialRecallResults,
    continuationResults,
    remediationResults,
    attemptHistory: uniqueHistory,
    syncedHistoryEventIds: [...new Set([...(local?.syncedHistoryEventIds ?? []), ...(Array.isArray(item.attemptHistory) ? item.attemptHistory : []).map((entry: any) => entry?.id).filter(Boolean), ...acknowledgedHistoryIds])],
    incrementalSyncReady: true,
    dailyPracticeGoal: local?.dailyPracticeGoal ?? mergedScheduledItemIds.length,
    reviewBatchSize: local?.reviewBatchSize ?? mergedScheduledItemIds.length,
    configFingerprint: local?.configFingerprint ?? `remote:${runId}`,
    createdAt: toIsoString(item.createdAt) ?? remoteUpdatedAt,
    updatedAt: remoteUpdatedAt,
    syncStatus: local?.syncStatus === 'pending' ? 'pending' : 'synced',
    submissionStatus: local?.submissionStatus === 'dirty' || local?.submissionStatus === 'submitting'
      ? local.submissionStatus : (item.submissionStatus ?? 'synced'),
    activityMarked: local?.activityMarked ?? false,
    stats: mergeStats(local?.stats, item.stats),
  } satisfies StoredDailyPracticeRun)

  if (date && mergedPackIds.length > 0) {
    if (scope === 'single' && mergedPackIds.length === 1) {
      await localDb.put('daily_practice_runs', {
        id: ACTIVE_DAILY_PRACTICE_PACK_ID,
        packId: mergedPackIds[0],
        updatedAt: remoteUpdatedAt,
      } satisfies StoredActiveDailyPracticePack)
    }
    await localDb.put('daily_practice_runs', {
      id: activeRunPointerId(date, mode, scope, mergedPackIds),
      runId,
      updatedAt: remoteUpdatedAt,
    } satisfies StoredActiveRunPointer)
  }
}


function scoreRank(score?: string | null) {
  if (score === 'strong') return 3
  if (score === 'ok') return 2
  if (score === 'weak') return 1
  return 0
}

function typeLabel(type: string, item: any) {
  if (type === 'chunk_substitution') return (item.kind ?? 'chunk') === 'word' ? '词汇替换' : '句块替换'
  if (type === 'vocab_drill') return '词汇输出'
  if (type === 'vocab_sentence_building') return '一词多句'
  if (type === 'pattern_drill') return '句型操练'
  if (type === 'sentence_decomposition') return '句子拆解'
  return '知识点练习'
}

function emptyProgress(candidate: DailyPracticeCandidate, date: string): DailyPracticeProgress {
  return {
    id: candidate.itemId,
    itemId: candidate.itemId,
    packId: candidate.packId,
    topicId: candidate.topicId,
    type: candidate.type,
    status: 'new',
    dueDate: date,
    bestScore: null,
    bestScoreRank: 0,
    lastScore: null,
    lastScoreRank: 0,
    attempts: 0,
    correctCount: 0,
    reviewCount: 0,
    lapseCount: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    updatedAt: new Date().toISOString(),
  }
}

function scheduleStatus(progress: DailyPracticeProgress, date: string): DailyPracticeStatus {
  if (progress.lastPracticedAt?.slice(0, 10) === date) return 'done'
  if (progress.status === 'mastered' && progress.dueDate > date) return 'mastered'
  if (progress.dueDate < date) return 'overdue'
  if (progress.attempts > 0 && progress.dueDate <= date) return 'review'
  return 'new'
}

function nextProgressForRating(progress: DailyPracticeProgress, rating: SrsRating, date: string): DailyPracticeProgress {
  const score: WarmupScore = rating === 'easy' ? 'strong' : rating === 'good' ? 'ok' : 'miss'
  const rank = scoreRank(score)
  const passed = rank >= 2
  const schedule = scheduleReview(
    {
      reviewCount: progress.reviewCount,
      intervalDays: progress.intervalDays,
      easeFactor: progress.easeFactor,
      lapseCount: progress.lapseCount,
    },
    rating,
    new Date(practicedAtForDate(date)),
  )
  const bestRank = Math.max(progress.bestScoreRank, rank)
  return {
    ...progress,
    status: schedule.status,
    dueDate: utcDateKey(schedule.dueAt),
    lastPracticedAt: practicedAtForDate(date),
    bestScore: rank >= progress.bestScoreRank ? score : progress.bestScore,
    bestScoreRank: bestRank,
    lastScore: score,
    lastScoreRank: rank,
    attempts: progress.attempts + 1,
    correctCount: progress.correctCount + (passed ? 1 : 0),
    reviewCount: schedule.reviewCount,
    lapseCount: schedule.lapseCount,
    intervalDays: schedule.intervalDays,
    easeFactor: schedule.easeFactor,
    updatedAt: new Date().toISOString(),
  }
}

function nextProgress(progress: DailyPracticeProgress, score: WarmupScore, date: string): DailyPracticeProgress {
  return nextProgressForRating(progress, warmupScoreToReviewRating(score) as SrsRating, date)
}

function averageWarmupScore(records: WarmupRecordEntry[]): number | null {
  const values = records.map((record) => scoreRank(record.score)).filter((rank) => rank > 0)
  return values.length > 0
    ? Math.round(values.reduce((sum, rank) => sum + rank, 0) / values.length / 3 * 100)
    : null
}

function createTodayRunSyncPayload(params: {
  run: StoredDailyPracticeRun
  attempts: DailyPracticeAttempt[]
  records: WarmupRecordEntry[]
  topic: { topicId: string; topicTitle: string } | null
  localWarmupRecordId?: string | null
  submissionStatus: SubmissionStatus
  stats: Record<string, unknown>
}) {
  const bootstrap = !params.run.incrementalSyncReady
  const delivered = new Set(params.run.syncedHistoryEventIds ?? [])
  const historyDelta = bootstrap
    ? params.run.attemptHistory
    : params.run.attemptHistory.filter((entry) => !delivered.has(entry.id))
  const changedStepIds = new Set(historyDelta.map((entry) => entry.stepId))
  const deltaMap = <T,>(map: Record<string, T | undefined>) => bootstrap
    ? map
    : Object.fromEntries(Object.entries(map).filter(([stepId]) => changedStepIds.has(stepId)))
  // 作答原文只来自已经落盘的热身记录，顺序沿用「最新在前」。
  const recordsByStepId = new Map<string, WarmupRecordEntry>()
  for (const record of params.records) {
    if (!recordsByStepId.has(record.stepId)) recordsByStepId.set(record.stepId, record)
  }
  const records = [...recordsByStepId.values()]
  const recordDelta = bootstrap ? records : records.filter((record) => changedStepIds.has(record.stepId))
  const score = averageWarmupScore(records)
  return {
    run: {
      id: params.run.id,
      clientRunId: params.run.id,
      date: params.run.date,
      mode: params.run.mode,
      scope: params.run.scope,
      packIds: params.run.packIds,
      scheduledItemIds: params.run.scheduledItemIds,
      // Static plan metadata remains idempotent; mutable facts below are
      // event-derived deltas, never the full daily snapshot after bootstrap.
      completedItemIds: [],
      attemptedItemIds: [...changedStepIds],
      unresolvedItemIds: [],
      srsAppliedItemIds: bootstrap ? params.run.srsAppliedItemIds : params.run.srsAppliedItemIds.filter((id) => changedStepIds.has(id)),
      initialRecallResults: deltaMap(params.run.initialRecallResults),
      continuationResults: deltaMap(params.run.continuationResults),
      remediationResults: deltaMap(params.run.remediationResults),
      attemptHistory: historyDelta,
      submissionStatus: params.submissionStatus,
      // Outbox coalescing uses this local revision to reject a slower stale
      // snapshot for the same run (for example the original all-wrong submit).
      clientUpdatedAt: params.run.updatedAt,
      stats: params.stats,
    },
    attempts: params.attempts,
    warmupRecord: recordDelta.length > 0 && params.topic ? {
      topicId: params.topic.topicId,
      topicTitle: params.topic.topicTitle,
      // 归属学习包：每条 item 已带 packId，取首条即可（同一记录通常同包）。
      packId: recordDelta[0]?.packId ?? null,
      items: recordDelta,
      score: averageWarmupScore(recordDelta) ?? score,
      feedback: null,
    } : undefined,
    localWarmupRecordId: params.localWarmupRecordId ?? null,
  }
}

function buildCandidates(unit: UnitDetail): DailyPracticeCandidate[] {
  const candidates: DailyPracticeCandidate[] = []
  for (const topic of unit.trainingTopics ?? []) {
    const outputTraining = topic.metadata?.outputTraining
    const pipeline = outputTraining?.enabled === false
      ? []
      : (outputTraining?.pipeline ?? [])
    for (const item of pipeline) {
      const type = item.type
      const push = (prompt: any, promptIndex: number, extra: Partial<DailyPracticeCandidate> & { pattern?: any } = {}) => {
        const itemId = createWarmupPracticeItemId({
          packId: unit.id,
          topicId: topic.id,
          type,
          item,
          prompt,
          pattern: (extra as any).pattern,
        })
        candidates.push({
          itemId,
          packId: unit.id,
          packTitle: unit.title,
          topicId: topic.id,
          topicTitle: topic.title,
          type,
          item,
          prompt,
          promptIndex,
          label: item.title || item.chunk || item.pattern || prompt?.zh || '知识点练习',
          displayLabel: typeLabel(type, item),
          headerContent: item.chunk || item.pattern || item.vocabWord || prompt?.targetWords?.join(', ') || prompt?.promptZh || item.levels?.[0]?.en || item.fullSentence || item.title || '',
          ...extra,
        })
      }

      if (type === 'chunk_substitution') {
        for (const [idx, prompt] of (item.items ?? []).entries()) push(prompt, idx)
      } else if (type === 'vocab_drill') {
        for (const [idx, prompt] of (item.vocabs ?? []).entries()) push(prompt, idx)
      } else if (type === 'vocab_sentence_building') {
        for (const [patternIndex, pattern] of (item.patterns ?? []).entries()) {
          for (const [idx, prompt] of (pattern.items ?? []).entries()) push({ ...prompt, pattern }, idx, {
            pattern,
            patternIndex,
            label: `${item.vocabWord || '词汇'} + ${pattern.chunk || item.vocabWord || ''}`,
            headerContent: item.vocabWord || pattern.chunk || prompt.zh || '',
          })
        }
      } else if (type === 'pattern_drill') {
        for (const [idx, prompt] of (item.items ?? []).entries()) push(prompt, idx)
      } else if (type === 'sentence_decomposition') {
        push({ levels: item.levels, fullSentence: item.fullSentence }, 0)
      }
    }
  }
  return candidates
}

async function loadPracticeUnit(unitId: string): Promise<UnitDetail | null> {
  let summary = await readUnitSummary(unitId)
  if (!summary) {
    const ready = await ensurePackProjection(unitId)
    if (!ready) return null
    summary = await readUnitSummary(unitId)
  }
  if (!summary || summary.contentMode === 'story' || summary.contentMode === 'nqtr' || (summary.practiceItemCount ?? 0) === 0) return null
  return readPracticeSource(unitId) as Promise<UnitDetail | null>
}

async function loadCandidateUnits(scope: DailyPracticeScope, targetPackId?: string | null): Promise<UnitDetail[]> {
  // Today 的候选题、计划和角标都必须来自同一份本地包快照；这里绝不为了
  // 显示/构建计划临时请求后端，避免服务端旧进度或网络时序改变本地口径。
  const myUnits = await learningRepository.getCachedMyUnits().catch(() => [])
  const packs = await learningPackService.listInstalled().catch(() => [])
  const installedIds = new Set(
    packs.filter((pack) => pack.status === 'installed').map((pack) => pack.packId),
  )
  const enrolledIds = new Set(myUnits.map((u) => u.id))

  if (targetPackId) {
    if (!enrolledIds.has(targetPackId) || !installedIds.has(targetPackId)) return []
    const detail = await loadPracticeUnit(targetPackId)
    return detail ? [detail] : []
  }

  const eligibleIds = myUnits.map((unit) => unit.id).filter((id) => installedIds.has(id))
  if (eligibleIds.length === 0) return []

  const summaries = await Promise.all(eligibleIds.map(async (id) => ({ id, summary: await readUnitSummary(id) })))
  const readyIds = summaries
    .filter((item) => item.summary && item.summary.contentMode !== 'story' && item.summary.contentMode !== 'nqtr' && (item.summary.practiceItemCount ?? 0) > 0)
    .map((item) => item.id)
  for (const item of summaries) {
    if (!item.summary) void ensurePackProjection(item.id).catch(() => {})
  }

  const activePackId = await getActivePracticePackId()
  const selectedPackIds = readyIds.length === 0
    ? [eligibleIds.includes(activePackId ?? '') ? activePackId! : eligibleIds[0]]
    : scope === 'mixed'
      ? readyIds
      : [readyIds.includes(activePackId ?? '') ? activePackId! : readyIds[0]].filter(Boolean)

  if (scope === 'single' && selectedPackIds[0] && selectedPackIds[0] !== activePackId) {
    await setActivePracticePackId(selectedPackIds[0])
  }

  const details = (await Promise.all(selectedPackIds.map((id) => loadPracticeUnit(id)))).filter(Boolean) as UnitDetail[]
  return details
}

type PracticeCandidateContext = {
  scope: DailyPracticeScope
  units: UnitDetail[]
  candidates: DailyPracticeCandidate[]
  packIds: string[]
  itemIds: Set<string>
}

/** The sole eligibility gate for Today plans, review counts, and review runs. */
async function resolvePracticeCandidateContext(
  scope: DailyPracticeScope,
  targetPackId?: string | null,
): Promise<PracticeCandidateContext> {
  const units = await loadCandidateUnits(scope, targetPackId)
  const candidates = units.flatMap(buildCandidates)
  return {
    scope,
    units,
    candidates,
    packIds: units.map((unit) => unit.id),
    itemIds: new Set(candidates.map((candidate) => candidate.itemId)),
  }
}

function buildTopicStats(
  units: UnitDetail[],
  candidates: DailyPracticeCandidate[],
  progressMap: Map<string, DailyPracticeProgress>,
  scheduled: ScheduledDailyPracticeItem[],
  date: string,
): TopicDailyPracticeStats[] {
  const scheduledByTopic = new Map<string, ScheduledDailyPracticeItem[]>()
  for (const step of scheduled) {
    scheduledByTopic.set(step.topicId, [...(scheduledByTopic.get(step.topicId) ?? []), step])
  }
  return units.flatMap((unit) => (unit.trainingTopics ?? []).map((topic) => {
    const topicCandidates = candidates.filter((candidate) => candidate.topicId === topic.id)
    const total = topicCandidates.length
    const progresses = topicCandidates.map((candidate) => progressMap.get(candidate.itemId) ?? emptyProgress(candidate, date))
    const doneTodayCount = progresses.filter((p) => p.lastPracticedAt?.slice(0, 10) === date).length
    const masteredCount = progresses.filter((p) => p.status === 'mastered').length
    const practicedCount = progresses.filter((p) => (p.bestScoreRank ?? 0) >= 2).length
    const scheduledSteps = scheduledByTopic.get(topic.id) ?? []
    const overdueCount = scheduledSteps.filter((s) => s.scheduleStatus === 'overdue').length
    const todayReviewCount = scheduledSteps.filter((s) => s.scheduleStatus === 'review').length
    const todayNewCount = scheduledSteps.filter((s) => s.scheduleStatus === 'new').length
    const status: DailyPracticeStatus = overdueCount > 0
      ? 'overdue'
      : scheduledSteps.length > 0 && scheduledSteps.every((s) => s.scheduleStatus === 'done')
        ? 'done'
        : todayReviewCount > 0
          ? 'review'
          : todayNewCount > 0
            ? 'new'
            : masteredCount > 0 && masteredCount === total
              ? 'mastered'
              : 'new'
    return {
      topicId: topic.id,
      topicTitle: topic.title,
      packId: unit.id,
      packTitle: unit.title,
      activeChunksCount: topic.activeChunks?.length ?? 0,
      vocabCount: topic.vocabularies?.length ?? 0,
      chunkCount: topic.activeChunks?.length ?? 0,
      patternCount: topic.sentencePatterns?.length ?? 0,
      suggestedDurationSec: topic.suggestedDurationSec,
      difficulty: topic.difficulty,
      totalCount: total,
      todayNewCount,
      todayReviewCount,
      overdueCount,
      doneTodayCount,
      scheduledTodayCount: scheduledSteps.length,
      masteredCount,
      practicedCount,
      topicWarmupProgress: total > 0 ? Math.min(100, Math.round((practicedCount / total) * 100)) : 0,
      status,
    }
  }))
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function shuffleWithinTrainingStages<T>(items: T[], getType: (item: T) => string) {
  const stageOrder: string[] = []
  const stageItems = new Map<string, T[]>()

  for (const item of items) {
    const type = getType(item)
    if (!stageItems.has(type)) {
      stageOrder.push(type)
      stageItems.set(type, [])
    }
    stageItems.get(type)!.push(item)
  }

  return stageOrder.flatMap((type) => shuffleItems(stageItems.get(type) ?? []))
}

/**
 * 从服务端拉取今日任务 item 的权威进度并写回本地。
 *
 * 规则：不覆盖本地存在未同步 attempt 的 item（pending 优先），避免离线更新的进度被远端旧值覆盖。
 * 此函数同时被 buildTodayPlan（旁路快速刷新）和 offlineSyncService.sync()（完整同步）调用，
 * 确保服务端进度最终收敛到本地。
 */
export async function pullRemoteDailyProgress(itemIds?: string[]): Promise<void> {
  try {
    const remote = await dailyPracticeApi.progress(itemIds)
    const pendingAttempts = await localDb.list<DailyPracticeAttempt>('daily_practice_attempts')
    const pendingItemIds = new Set(
      pendingAttempts.filter((attempt) => attempt.syncStatus !== 'synced').map((attempt) => attempt.itemId),
    )
    const safeItems = remote.items
      .filter((item) => !pendingItemIds.has(item.itemId))
      .map((item) => ({ ...item, id: item.itemId }))
    if (safeItems.length > 0) await localDb.putMany('daily_practice_items', safeItems)
  } catch {
    // 离线或网络错误：保留本地进度，等待下次同步
  }
}

export const dailyPracticeRepository = {
  async getActivePracticePackId() {
    return getActivePracticePackId()
  },

  /**
   * 复习模式全局待办数量（逾期 + 今天到期），与当前 Tab/plan 无关。
   * 只统计当前仍“已加入 + 已安装 + 有可执行知识点练习”的学习包。SRS
   * 进度会为重装保留在本地，因而绝不能仅按 daily_practice_items 计数。
   * 此方法不请求每日练习后端接口；只读取本地的包、学习关系和 SRS 数据。
   */
  async getReviewDebtCount(
    targetDate?: string | null,
    requestedScope?: DailyPracticeScope,
  ): Promise<number> {
    const date = normalizePlanDate(targetDate)
    const preferences = usePreferencesStore.getState()
    const scope = requestedScope ?? (preferences.dailyPracticeMixedPacks ? 'mixed' : 'single')
    const context = await resolvePracticeCandidateContext(scope)
    if (context.itemIds.size === 0) return 0
    const [progresses, runs] = await Promise.all([
      localDb.findByIndexIn<DailyPracticeProgress>('daily_practice_items', 'item_id', [...context.itemIds]),
      localDb.findByIndex<StoredDailyPracticeRun>('daily_practice_runs', 'date', date),
    ])
    const reviewRuns = runs.filter((run) =>
      run.id !== ACTIVE_DAILY_PRACTICE_PACK_ID
      && run.mode === 'review'
      && run.date === date
      && runMatchesScope(run, scope, context.packIds),
    )
    const appliedToday = await appliedReviewItemIds(reviewRuns)
    return progresses.filter((p) =>
      context.itemIds.has(p.itemId)
      && (p.attempts ?? 0) > 0
      && (p.dueDate ?? '') <= date
      && !appliedToday.has(p.itemId)
    ).length
  },

  /**
   * Recompute every display field of an existing plan from the local SRS source
   * of truth. This never creates a run or changes its queue; it only keeps UI
   * projections (steps, topic cards, review debt) current after an answer.
   */
  async refreshPlanProgress(plan: DailyPracticePlan): Promise<DailyPracticePlan> {
    const candidates = plan.units.flatMap(buildCandidates)
    const [progresses, reviewDebt] = await Promise.all([
      localDb.findByIndexIn<DailyPracticeProgress>('daily_practice_items', 'item_id', candidates.map((item) => item.itemId)),
      this.getReviewDebtCount(plan.date, plan.scope),
    ])
    const candidateById = new Map(candidates.map((candidate) => [candidate.itemId, candidate]))
    const progressById = new Map(progresses.map((progress) => [progress.itemId, progress]))
    const steps = plan.steps.map((previous) => {
      const candidate = candidateById.get(previous.itemId) ?? previous
      const progress = progressById.get(previous.itemId) ?? previous.progress
      return { ...candidate, progress, scheduleStatus: scheduleStatus(progress, plan.date) }
    })
    const topicStats = buildTopicStats(plan.units, candidates, progressById, steps, plan.date)
    return { ...plan, steps, topicStats, availableReviewCount: reviewDebt }
  },

  /**
   * Read a mode-specific tab summary without rebuilding or switching the
   * active plan. The Today page keeps one active plan at a time, so its tabs
   * must never borrow counts from that active plan for the other mode.
   */
  async getRunSummary(
    date: string,
    mode: DailyPracticePlanMode,
    scope: DailyPracticeScope = mode === 'review' && usePreferencesStore.getState().dailyPracticeMixedPacks ? 'mixed' : 'single',
  ): Promise<DailyPracticeRunSummary | null> {
    const context = await resolvePracticeCandidateContext(scope)
    if (context.itemIds.size === 0) return null
    const run = (await localDb.findByIndex<StoredDailyPracticeRun>('daily_practice_runs', 'date', date))
      .filter((item) => item.id !== ACTIVE_DAILY_PRACTICE_PACK_ID
        && item.date === date
        && item.mode === mode
        && runMatchesScope(item, scope, context.packIds)
        && Array.isArray(item.scheduledItemIds))
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))[0]
    if (!run) return null
    return {
      attemptedCount: new Set(run.attemptedItemIds ?? []).size,
      totalCount: run.scheduledItemIds.length,
    }
  },

  async setActivePracticePackId(packId: string) {
    const detail = await loadPracticeUnit(packId)
    if (!detail || buildCandidates(detail).length === 0) {
      throw new Error('当前学习包没有可执行的知识点练习')
    }
    await setActivePracticePackId(packId)
  },

  async buildTodayPlan(
    targetPackId?: string | null,
    targetDate?: string | null,
    mode: DailyPracticePlanMode = 'practice',
    options: { forceNew?: boolean } = {},
  ): Promise<DailyPracticePlan> {
    const date = normalizePlanDate(targetDate)
    const preferences = usePreferencesStore.getState()
    const dailyGoal = preferences.dailyPracticeGoal
    const reviewBatchSize = preferences.reviewBatchSize
    // 新学始终沿当前学习包推进；跨学习包设置只扩大复习候选范围。
    const packScope: DailyPracticeScope =
      mode === 'review' && preferences.dailyPracticeMixedPacks ? 'mixed' : 'single'
    // 离线优先：构建计划只读本地。服务端 run / item 进度的恢复统一由
    // offlineSyncService.sync（登录、自动、手动同步）的 pull 承担
    // （dailyPracticeRuns → restoreRemoteDailyPracticeRun，progress →
    // pullRemoteDailyProgress），不再在每次构建时请求网络。
    const storedRuns = (await localDb.findByIndex<StoredDailyPracticeRun>('daily_practice_runs', 'date', date))
      .filter((run) => run.id !== ACTIVE_DAILY_PRACTICE_PACK_ID && Array.isArray(run.scheduledItemIds))
    const resumableStoredRun = !options.forceNew && !targetPackId
      ? storedRuns
        .filter((run) => run.date === date
          && run.mode === mode
          && run.scope === packScope
          && run.scheduledItemIds.length > 0
          && (run.submissionStatus !== 'synced'
            || run.attemptedItemIds.length < run.scheduledItemIds.length
            || run.unresolvedItemIds.length > 0))
        .sort((a, b) => (b.updatedAt ?? b.createdAt ?? b.date).localeCompare(a.updatedAt ?? a.createdAt ?? a.date))[0] ?? null
      : null
    const recoveredRun = resumableStoredRun
    // 选包优先级：显式 targetPackId > 当前激活学习包（用户主动切换的包必须
    // 生效）> 进行中的 run 恢复（仅当 active 指针为空，例如 logout 清库）。
    // 之前只从 run 恢复，导致切换学习包后仍构建旧包的今日计划。
    const activePackId = packScope === 'single' ? await getActivePracticePackId() : null
    const recoveredPackId = activePackId
      ?? (packScope === 'single' && recoveredRun?.packIds.length === 1
        ? recoveredRun.packIds[0]
        : null)
    let context = await resolvePracticeCandidateContext(packScope, targetPackId ?? recoveredPackId)
    // 旧 run 可能属于已经卸载/退出的包。它不能阻塞 Today 自动回退到
    // 当前仍有效的练习包；显式 URL 指定的包则保持严格失败，不做回退。
    if (!targetPackId && recoveredPackId && context.itemIds.size === 0) {
      context = await resolvePracticeCandidateContext(packScope)
    }
    const { units, candidates, packIds } = context
    const packIdsKey = packKey(packIds)
    const allRuns = (await localDb.findByIndex<StoredDailyPracticeRun>('daily_practice_runs', 'pack_ids', packIdsKey))
      .filter((run) => run.id !== ACTIVE_DAILY_PRACTICE_PACK_ID && Array.isArray(run.scheduledItemIds))
    const configFingerprint = stableHash({
      mode,
      scope: packScope,
      packIds: [...packIds].sort(),
      dailyPracticeGoal: dailyGoal,
      reviewBatchSize,
      random: preferences.dailyPracticeRandomOrder,
      mixed: preferences.dailyPracticeMixedPacks,
    })
    if (units.length === 0 || candidates.length === 0) {
      if (date === todayKey()) setLearningBadgeCount(0).catch(() => {})
      return {
        runId: createId('today_run'),
        date,
        scope: packScope,
        mode,
        dailyGoal,
        reviewBatchSize,
        configFingerprint,
        availableReviewCount: 0,
        practicePoolCount: 0,
        units,
        steps: [],
        topicStats: [],
        scheduledItemIds: [],
      }
    }

    const localProgress = await localDb.findByIndexIn<DailyPracticeProgress>(
      'daily_practice_items',
      'item_id',
      candidates.map((candidate) => candidate.itemId),
    )
    const progressMap = new Map(localProgress.map((item) => [item.itemId, item]))
    const withStatus = candidates.map((candidate) => {
      const progress = progressMap.get(candidate.itemId) ?? emptyProgress(candidate, date)
      progressMap.set(candidate.itemId, progress)
      return { candidate, progress, status: scheduleStatus(progress, date) }
    })

    const reviewAppliedToday = await appliedReviewItemIds(allRuns
      .filter((run) => run.mode === 'review' && run.date === date && runMatchesScope(run, packScope, packIds)))
    const reviewBacklog = withStatus
      .filter((x) => x.progress.attempts > 0 && x.progress.dueDate <= date && !reviewAppliedToday.has(x.candidate.itemId))
      .sort(compareReviewDebt)

    const previousPracticeRuns = allRuns
      .filter((run) => run.mode === 'practice' && run.date < date && runMatchesScope(run, packScope, packIds))
      .sort((a, b) => (a.updatedAt ?? a.createdAt ?? a.date).localeCompare(b.updatedAt ?? b.createdAt ?? b.date))
    const latestHistoricalState = new Map<string, { attempted: boolean; unresolved: boolean }>()
    for (const run of previousPracticeRuns) {
      const attempted = new Set(run.attemptedItemIds ?? [])
      const unresolved = new Set(run.unresolvedItemIds ?? [])
      for (const id of run.scheduledItemIds) latestHistoricalState.set(id, { attempted: attempted.has(id), unresolved: unresolved.has(id) })
    }
    const candidateById = new Map(withStatus.map((item) => [item.candidate.itemId, item]))
    const carryoverUnresolved = [...latestHistoricalState]
      .filter(([, value]) => value.attempted && value.unresolved)
      .map(([id]) => candidateById.get(id))
      .filter(Boolean) as typeof withStatus
    const carryoverUnattempted = [...latestHistoricalState]
      .filter(([, value]) => !value.attempted)
      .map(([id]) => candidateById.get(id))
      .filter(Boolean) as typeof withStatus
    const todayScheduledPracticeIds = deriveTodayScheduledPracticeIds(allRuns, date, packScope, packIds)
    const practicePool = withStatus.filter((x) => x.progress.status === 'new' && !latestHistoricalState.has(x.candidate.itemId))
    // 新学只推进当前包中的一个话题，避免教学上下文在多个话题之间跳转。
    const currentTopicId = practicePool[0]?.candidate.topicId
    const currentTopicPool = currentTopicId
      ? practicePool.filter((x) => x.candidate.topicId === currentTopicId)
      : []
    // 随机仅发生在同一话题的同一训练阶段内，不改变阶段的教学顺序。
    const orderedPracticePool = preferences.dailyPracticeRandomOrder
      ? shuffleWithinTrainingStages(
          currentTopicPool,
          (item: (typeof currentTopicPool)[number]) => item.candidate.type,
        )
      : currentTopicPool
    const pointerId = activeRunPointerId(date, mode, packScope, packIds)
    const pointer = !options.forceNew
      ? await localDb.get<StoredActiveRunPointer>('daily_practice_runs', pointerId).catch(() => null)
      : null
    const pointedRun = pointer?.runId
      ? await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', pointer.runId).catch(() => null)
      : null
    // Older pack-switch behavior could force-create an empty run and overwrite the
    // active pointer. Recover the most recent valid run for this exact context so
    // affected users do not need to clear local storage.
    const fallbackRun = !options.forceNew && (!pointedRun || pointedRun.scheduledItemIds.length === 0)
      ? allRuns
        .filter((run) => run.date === date
          && run.mode === mode
          && runMatchesScope(run, packScope, packIds)
          && run.scheduledItemIds.length > 0
          && (run.submissionStatus !== 'synced'
            || run.attemptedItemIds.length < run.scheduledItemIds.length
            || run.unresolvedItemIds.length > 0)
          && run.scheduledItemIds.every((itemId) => candidateById.has(itemId)))
        .sort((a, b) => (b.updatedAt ?? b.createdAt ?? b.date).localeCompare(a.updatedAt ?? a.createdAt ?? a.date))[0] ?? null
      : null
    const cachedRun = pointedRun?.scheduledItemIds.length
      ? pointedRun
      : fallbackRun
    // Active configuration is frozen. A settings change never invalidates the active run.
    const canReuseCachedRun = Boolean(cachedRun
      && cachedRun.date === date
      && cachedRun.mode === mode
      && runMatchesScope(cachedRun, packScope, packIds)
      && cachedRun.scheduledItemIds.every((itemId) => candidateById.has(itemId)))
    const scheduledSource = canReuseCachedRun
      ? cachedRun!.scheduledItemIds.map((itemId) => candidateById.get(itemId)!)
      : mode === 'review'
        ? selectReviewBatch(reviewBacklog, reviewBatchSize)
        : selectPracticeBatch<(typeof withStatus)[number]>({
          carryoverUnresolved,
          carryoverUnattempted,
          fresh: orderedPracticePool,
          todayScheduledIds: todayScheduledPracticeIds,
          goal: dailyGoal,
          getId: (item) => item.candidate.itemId,
        })
    const scheduled = scheduledSource.map(({ candidate, progress, status }) => ({
      ...candidate,
      progress,
      scheduleStatus: status,
    }))

    const now = new Date().toISOString()
    const run: StoredDailyPracticeRun = canReuseCachedRun ? cachedRun! : {
      id: createId('today_run'), date, scope: packScope, mode,
      dailyPracticeGoal: dailyGoal, reviewBatchSize, configFingerprint,
      packIds, packIdsKey, scheduledItemIds: scheduled.map((step) => step.itemId),
      attemptedItemIds: [], unresolvedItemIds: [], srsAppliedItemIds: [],
      initialRecallResults: {}, continuationResults: {}, remediationResults: {}, attemptHistory: [],
      createdAt: now, updatedAt: now, syncStatus: 'pending', submissionStatus: 'idle', activityMarked: false,
      stats: { reviewDebt: reviewBacklog.length, carryover: carryoverUnresolved.length + carryoverUnattempted.length },
    }
    if (!canReuseCachedRun) {
      await localDb.put('daily_practice_runs', run)
      await localDb.put('daily_practice_runs', { id: pointerId, runId: run.id, updatedAt: now } satisfies StoredActiveRunPointer)
    } else if (pointer?.runId !== run.id) {
      await localDb.put('daily_practice_runs', { id: pointerId, runId: run.id, updatedAt: now } satisfies StoredActiveRunPointer)
    }
    if (date === todayKey()) {
      setLearningBadgeCount(Math.max(0, run.scheduledItemIds.length - run.attemptedItemIds.length)).catch(() => {})
    }

    return {
      runId: run.id,
      date,
      scope: packScope,
      mode,
      dailyGoal: run.dailyPracticeGoal,
      reviewBatchSize: run.reviewBatchSize,
      configFingerprint: run.configFingerprint,
      availableReviewCount: reviewBacklog.length,
      practicePoolCount: practicePool.length,
      units,
      steps: scheduled,
      topicStats: buildTopicStats(units, candidates, progressMap, scheduled, date),
      scheduledItemIds: run.scheduledItemIds,
    }
  },

  async getRunFacts(runId: string): Promise<StoredTodayRunFacts | null> {
    const run = await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', runId)
    if (!run) return null
    const applied = new Set(run.srsAppliedItemIds ?? [])
    for (const stepId of run.scheduledItemIds ?? []) {
      const journal = await localDb.get<DailyPracticeAttempt>('daily_practice_attempts', `today-srs:${runId}:${stepId}`)
      if (journal?.applyStatus === 'applied') applied.add(stepId)
    }
    return {
      id: run.id,
      mode: run.mode,
      scheduledItemIds: [...run.scheduledItemIds],
      attemptedItemIds: [...(run.attemptedItemIds ?? [])],
      unresolvedItemIds: [...(run.unresolvedItemIds ?? [])],
      srsAppliedItemIds: [...applied],
      initialRecallResults: { ...(run.initialRecallResults ?? {}) },
      continuationResults: { ...(run.continuationResults ?? {}) },
      remediationResults: { ...(run.remediationResults ?? {}) },
      attemptHistory: [...(run.attemptHistory ?? [])],
      submissionStatus: run.submissionStatus ?? 'idle',
      roundKind: run.roundKind ?? 'main',
      sessionStepIds: [...(run.sessionStepIds ?? [])],
      currentStepId: run.currentStepId ?? null,
    }
  },

  async persistRunFacts(facts: StoredTodayRunFacts): Promise<void> {
    const run = await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', facts.id)
    if (!run) throw new Error(`Today run not found: ${facts.id}`)
    await localDb.put('daily_practice_runs', {
      ...run,
      attemptedItemIds: [...facts.attemptedItemIds],
      unresolvedItemIds: facts.unresolvedItemIds.filter((id) => facts.attemptedItemIds.includes(id)),
      srsAppliedItemIds: [...facts.srsAppliedItemIds],
      initialRecallResults: { ...facts.initialRecallResults },
      continuationResults: { ...facts.continuationResults },
      remediationResults: { ...facts.remediationResults },
      attemptHistory: [...(facts.attemptHistory ?? [])],
      submissionStatus: facts.submissionStatus,
      roundKind: facts.roundKind,
      sessionStepIds: [...(facts.sessionStepIds ?? [])],
      currentStepId: facts.currentStepId ?? null,
      // Completion and transport are independent: an offline-completed run
      // remains pending until replayItem receives the server acknowledgement.
      syncStatus: run.syncStatus,
      updatedAt: new Date().toISOString(),
    })
  },

  async applySrsRatingOnce(params: {
    runId: string
    step: ScheduledDailyPracticeItem
    rating: SrsRating
    targetDate?: string | null
  }): Promise<{ applied: boolean; progress: DailyPracticeProgress }> {
    const run = await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', params.runId)
    if (!run) throw new Error(`Today run not found: ${params.runId}`)
    const journalId = `today-srs:${params.runId}:${params.step.itemId}`
    const existingJournal = await localDb.get<DailyPracticeAttempt>('daily_practice_attempts', journalId)
    if (run.srsAppliedItemIds.includes(params.step.itemId) || existingJournal?.applyStatus === 'applied') {
      const progress = existingJournal?.progressAfter
        ?? await localDb.get<DailyPracticeProgress>('daily_practice_items', params.step.itemId)
        ?? params.step.progress
      if (!run.srsAppliedItemIds.includes(params.step.itemId)) {
        await localDb.put('daily_practice_runs', {
          ...run,
          srsAppliedItemIds: [...run.srsAppliedItemIds, params.step.itemId],
          updatedAt: new Date().toISOString(),
        })
      }
      return { applied: false, progress }
    }

    const date = normalizePlanDate(params.targetDate)
    const current = await localDb.get<DailyPracticeProgress>('daily_practice_items', params.step.itemId) ?? params.step.progress
    const progressAfter = existingJournal?.progressAfter ?? nextProgressForRating(current, params.rating, date)
    const score: WarmupScore = params.rating === 'easy' ? 'strong' : params.rating === 'good' ? 'ok' : 'miss'
    const journal: DailyPracticeAttempt = existingJournal ?? {
      id: journalId,
      clientAttemptId: journalId,
      itemId: params.step.itemId,
      packId: params.step.packId,
      topicId: params.step.topicId,
      type: params.step.type,
      score,
      passed: params.rating !== 'again',
      payload: { label: params.step.label, displayLabel: params.step.displayLabel },
      practicedAt: practicedAtForDate(date),
      syncStatus: 'pending',
      runId: params.runId,
      rating: params.rating,
      applyStatus: 'applying',
      progressAfter,
    }
    // Recoverable journal: replaying an interrupted write installs the same exact progress snapshot.
    await localDb.put('daily_practice_attempts', { ...journal, applyStatus: 'applying', progressAfter })
    await localDb.put('daily_practice_items', progressAfter)
    await localDb.put('daily_practice_attempts', { ...journal, applyStatus: 'applied', progressAfter })
    await localDb.put('daily_practice_runs', {
      ...run,
      srsAppliedItemIds: [...run.srsAppliedItemIds, params.step.itemId],
      updatedAt: new Date().toISOString(),
    })
    return { applied: true, progress: progressAfter }
  },

  async completeAdHocItem(candidate: DailyPracticeCandidate, score: WarmupScore, targetDate?: string | null): Promise<DailyPracticeProgress> {
    const date = normalizePlanDate(targetDate)
    const practicedAt = practicedAtForDate(date)
    const existing = await localDb.get<DailyPracticeProgress>('daily_practice_items', candidate.itemId)
    const updated = nextProgress(existing ?? emptyProgress(candidate, date), score, date)
    await localDb.put('daily_practice_items', updated)

    const attempt: DailyPracticeAttempt = {
      id: createId('attempt'),
      clientAttemptId: createId('client_attempt'),
      itemId: candidate.itemId,
      packId: candidate.packId,
      topicId: candidate.topicId,
      type: candidate.type,
      score,
      passed: scoreRank(score) >= 2,
      payload: { label: candidate.label, displayLabel: candidate.displayLabel },
      practicedAt,
      syncStatus: 'pending',
    }
    await localDb.put('daily_practice_attempts', attempt)

    return updated
  },

  async syncAdHocRun(params: {
    packId: string
    topicId: string
    topicTitle: string
    itemIds: string[]
    records: WarmupRecordEntry[]
    date?: string | null
    localWarmupRecordId?: string | null
  }) {
    const date = normalizePlanDate(params.date)
    const itemIdSet = new Set(params.itemIds)
    const attempts = await localDb.findByIndexIn<DailyPracticeAttempt>('daily_practice_attempts', 'item_id', params.itemIds)
    const pending = attempts.filter((attempt) => attempt.syncStatus !== 'synced' && itemIdSet.has(attempt.itemId))
    const progresses = await localDb.findByIndexIn<DailyPracticeProgress>('daily_practice_items', 'item_id', params.itemIds)
    const itemProgresses = progresses.filter((progress) => itemIdSet.has(progress.itemId))
    const completedIds = itemProgresses
      .filter((progress) => progress.lastPracticedAt?.slice(0, 10) === date || progress.bestScoreRank >= 2)
      .map((progress) => progress.itemId)
    const scoreValues = params.records.map((record) => scoreRank(record.score)).filter((rank) => rank > 0)
    const score = scoreValues.length > 0 ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length / 3 * 100) : null
    const clientRunId = `guided:${params.topicId}:${date}`
    const payload = {
      run: {
        id: clientRunId,
        clientRunId,
        date,
        mode: 'practice',
        scope: 'single',
        packIds: [params.packId],
        scheduledItemIds: params.itemIds,
        completedItemIds: completedIds,
        stats: {
          records: params.records.length,
          completed: completedIds.length,
          source: 'guided_warmup',
        },
      },
      attempts: pending,
      // 统一 warmup 记录创建：与 completeRun 对齐，由后端 complete 同时创建 practiceWarmupRecord
      warmupRecord: params.records.length > 0 ? {
        topicId: params.topicId,
        topicTitle: params.topicTitle,
        items: params.records,
        score,
        feedback: null,
        // 归属学习包：与 completeRun 一致，记录这条记录所属的学习包。
        packId: params.packId,
      } : undefined,
      // 供离线重放时回写本地 warmup 记录（markWarmupRecordSynced）
      localWarmupRecordId: params.localWarmupRecordId ?? null,
    }

    await practiceRepository.markTodayActivity(completedIds.length || params.records.length || 1, date)
    if (params.localWarmupRecordId && params.records.length > 0) {
      await practiceRepository.upsertLocalWarmupRecord({
        id: params.localWarmupRecordId,
        topicId: params.topicId,
        topicTitle: params.topicTitle,
        items: params.records,
        syncStatus: 'pending',
      })
    }

    try {
      const result = await dailyPracticeApi.complete(payload)
      await localDb.putMany('daily_practice_items', result.itemProgresses.map((item) => ({ ...item, id: item.itemId })))
      if (params.localWarmupRecordId && params.records.length > 0) {
        await practiceRepository.markWarmupRecordSynced(params.localWarmupRecordId, result.warmupRecordId)
      }
      await Promise.all(result.syncedAttempts.map(async (clientAttemptId) => {
        const attempt = pending.find((item) => item.clientAttemptId === clientAttemptId)
        if (attempt) await localDb.put('daily_practice_attempts', { ...attempt, syncStatus: 'synced' as const })
      }))
      return result
    } catch (error) {
      await syncOutbox.enqueue({
        entityType: 'daily_practice',
        entityId: `guided:${params.topicId}:${date}`,
        operation: 'create',
        payload,
      })
      throw error
    }
  },

  /**
   * Write the answer text before anything tries to enqueue it. Attribution
   * uses the live plan; after this returns, sync can rebuild the payload
   * from disk alone.
   */
  async persistTodayWarmup(plan: DailyPracticePlan, records: WarmupRecordEntry[], localWarmupRecordId?: string | null) {
    if (!localWarmupRecordId || records.length === 0) return null
    const topic = plan.topicStats.find((item) => item.scheduledTodayCount > 0) ?? plan.topicStats[0]
    if (!topic) return null
    const attributed = attributeWarmupRecords(plan.steps, records)
    const existing = await practiceRepository.getLocalWarmupRecord(localWarmupRecordId).catch(() => null) as { items?: WarmupRecordEntry[] } | null
    const existingItems = Array.isArray(existing?.items) ? existing.items : []
    const incomingIds = new Set(attributed.map((item) => item.stepId))
    const items = [...attributed, ...existingItems.filter((item) => !incomingIds.has(item.stepId))]
    await practiceRepository.upsertLocalWarmupRecord({
      id: localWarmupRecordId,
      topicId: topic.topicId,
      topicTitle: topic.topicTitle,
      items,
      syncStatus: 'pending',
    })
    return { topicId: topic.topicId, topicTitle: topic.topicTitle, items }
  },

  /**
   * Put any local run with undelivered history back into the outbox.
   * The answer text is already in the warmup row; this only rebuilds the queue.
   */
  async requeueUnsyncedSnapshots(): Promise<void> {
    const [runs, attempts] = await Promise.all([
      localDb.list<StoredDailyPracticeRun>('daily_practice_runs'),
      localDb.list<DailyPracticeAttempt>('daily_practice_attempts'),
    ])
    for (const run of runs) {
      if (!run?.id || run.id === ACTIVE_DAILY_PRACTICE_PACK_ID || !Array.isArray(run.attemptHistory)) continue
      const delivered = new Set(run.incrementalSyncReady ? (run.syncedHistoryEventIds ?? []) : [])
      const undelivered = run.attemptHistory.some((entry) => entry?.id && !delivered.has(entry.id))
      const pendingAttempts = attempts.some((attempt) =>
        attempt.runId === run.id && attempt.syncStatus !== 'synced' && attempt.applyStatus === 'applied')
      if (!undelivered && !pendingAttempts) continue
      await this.syncRunSnapshot(run.id)
    }
  },

  /**
   * Enqueue one in-progress Today run from the stored run and its warmup row.
   */
  async syncRunSnapshot(runId: string) {
    const run = await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', runId)
    if (!run) return
    const localWarmupRecordId = `today-warmup:${runId}`
    const warmup = await practiceRepository.getLocalWarmupRecord(localWarmupRecordId).catch(() => null) as {
      topicId?: string
      topicTitle?: string
      items?: WarmupRecordEntry[]
    } | null
    const records = Array.isArray(warmup?.items) ? warmup.items : []
    if (records.length === 0) {
      // 没有作答原文时，不要用空记录替换队列里已经带着答案的快照。
      const pending = await syncOutbox.listPending()
      const hasPendingSnapshot = pending.some((entry) =>
        entry.entityType === 'daily_practice' && entry.entityId === runId)
      if (hasPendingSnapshot) return
    }
    const attempts = await localDb.list<DailyPracticeAttempt>('daily_practice_attempts')
    const pendingAttempts = attempts.filter((attempt) =>
      attempt.runId === runId
      && attempt.syncStatus !== 'synced'
      && attempt.applyStatus === 'applied',
    )
    const payload = createTodayRunSyncPayload({
      run,
      attempts: pendingAttempts,
      records,
      topic: warmup?.topicId ? { topicId: warmup.topicId, topicTitle: warmup.topicTitle ?? '' } : null,
      localWarmupRecordId,
      submissionStatus: run.submissionStatus,
      stats: run.stats ?? {},
    })
    const historyDelta = payload.run.attemptHistory ?? []
    // 入队只看历史游标。首次上传时 incrementalSyncReady 为 false，historyDelta 就是完整历史。
    if (pendingAttempts.length === 0 && historyDelta.length === 0) return
    // 今日任务每个 run 只有一条队列记录。enqueue 会把同一条更新成最新快照。
    await syncOutbox.enqueue({
      entityType: 'daily_practice',
      entityId: runId,
      operation: 'update',
      payload,
    })
  },

  async completeRun(plan: DailyPracticePlan, records: WarmupRecordEntry[], localWarmupRecordId?: string | null) {
    let run = await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', plan.runId)
    if (!run) throw new Error(`Today run not found: ${plan.runId}`)
    const attempts = await localDb.list<DailyPracticeAttempt>('daily_practice_attempts')
    const pending = attempts.filter((attempt) => attempt.syncStatus !== 'synced' && attempt.runId === plan.runId && attempt.applyStatus === 'applied')
    const completedIds = run.attemptedItemIds.filter((id) => !run.unresolvedItemIds.includes(id))
    const savedWarmup = await this.persistTodayWarmup(plan, records, localWarmupRecordId)
    const liveTopic = plan.topicStats.find((item) => item.scheduledTodayCount > 0) ?? plan.topicStats[0]
    const topic = savedWarmup
      ? { topicId: savedWarmup.topicId, topicTitle: savedWarmup.topicTitle }
      : (liveTopic ? { topicId: liveTopic.topicId, topicTitle: liveTopic.topicTitle } : null)
    const payload = createTodayRunSyncPayload({
      run,
      attempts: pending,
      records: savedWarmup?.items ?? attributeWarmupRecords(plan.steps, records),
      topic,
      localWarmupRecordId,
      submissionStatus: 'synced',
      stats: {
        records: records.length,
        completed: completedIds.length,
      },
    })

    if (!run.activityMarked) {
      await practiceRepository.markTodayActivity(completedIds.length || records.length || 1, plan.date, plan.runId)
      run = { ...run, activityMarked: true, updatedAt: new Date().toISOString() }
      await localDb.put('daily_practice_runs', run)
    }

    // Completion is an optimistic local state transition.  It shares the same
    // coalesced entry as in-progress snapshots, so the server always receives
    // one newest version of the run and sign-out can wait for that one entry.
    await syncOutbox.enqueue({
      entityType: 'daily_practice',
      entityId: plan.runId,
      operation: 'update',
      payload,
    })
    await localDb.put('daily_practice_runs', {
      ...run,
      syncStatus: 'pending' as const,
      submissionStatus: 'synced' as const,
      updatedAt: new Date().toISOString(),
    })
  },
}

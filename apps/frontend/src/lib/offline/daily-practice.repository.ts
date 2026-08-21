import type { UnitDetail } from '@/features/learning/api/learning-api'
import { dailyPracticeApi } from '@/features/practice/api/english-practice-api'
import type { WarmupRecordEntry, WarmupScore } from '@/stores/warmup-session.store'
import { usePreferencesStore } from '@/stores/preferences.store'
import { setLearningBadgeCount } from '@/lib/native/learning-reminder'
import { learningPackService } from './learning-pack.service'
import { learningRepository } from './learning.repository'
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

function activeRunPointerId(date: string, mode: DailyPracticePlanMode, scope: DailyPracticeScope, ids: string[]) {
  return `daily-active:${date}:${mode}:${scope}:${packKey(ids)}`
}

function runMatchesScope(run: StoredDailyPracticeRun, scope: DailyPracticeScope, ids: string[]) {
  return run.scope === scope && run.packIdsKey === packKey(ids)
}

/** Write one server run into the local shape used by the Today state machine. */
export async function restoreRemoteDailyPracticeRun(item: any): Promise<void> {
  const runId = typeof item?.clientRunId === 'string' ? item.clientRunId : ''
  if (!runId || runId.startsWith('activity:')) return
  const remoteUpdatedAt = toIsoString(item.updatedAt) ?? new Date().toISOString()
  const local = await localDb.get<Partial<StoredDailyPracticeRun>>('daily_practice_runs', runId)
  // A newer local run means this device made changes the outbox has not pushed
  // yet.  That includes retries answered after the run was already submitted:
  // such runs keep submissionStatus 'synced' locally while the retry answers
  // still sit in a pending outbox snapshot.  A stale remote copy (e.g. the
  // mode-switch currentRun fetch before the outbox flush) must never wipe the
  // newer local answer state — the outbox reconciles it on the next sync.
  if (local?.updatedAt && local.updatedAt > remoteUpdatedAt) return

  const scheduledItemIds = Array.isArray(item.scheduledItemIds) ? item.scheduledItemIds : []
  const packIds = Array.isArray(item.packIds) ? item.packIds : []
  const date = toIsoString(item.date)?.slice(0, 10) ?? local?.date
  if (!date) return
  const mode: DailyPracticePlanMode = item.mode === 'review' ? 'review' : 'practice'
  const scope: DailyPracticeScope = item.scope === 'mixed' ? 'mixed' : 'single'
  const packIdsKey = packKey(packIds)
  await localDb.put('daily_practice_runs', {
    ...local,
    id: runId,
    date,
    mode,
    scope,
    packIds,
    packIdsKey,
    scheduledItemIds,
    completedItemIds: Array.isArray(item.completedItemIds) ? item.completedItemIds : [],
    attemptedItemIds: Array.isArray(item.attemptedItemIds) ? item.attemptedItemIds : [],
    unresolvedItemIds: Array.isArray(item.unresolvedItemIds) ? item.unresolvedItemIds : [],
    srsAppliedItemIds: Array.isArray(item.srsAppliedItemIds) ? item.srsAppliedItemIds : [],
    initialRecallResults: item.initialRecallResults ?? {},
    continuationResults: item.continuationResults ?? {},
    remediationResults: item.remediationResults ?? {},
    attemptHistory: local?.attemptHistory ?? [],
    dailyPracticeGoal: local?.dailyPracticeGoal ?? scheduledItemIds.length,
    reviewBatchSize: local?.reviewBatchSize ?? scheduledItemIds.length,
    configFingerprint: local?.configFingerprint ?? `remote:${runId}`,
    createdAt: toIsoString(item.createdAt) ?? remoteUpdatedAt,
    updatedAt: remoteUpdatedAt,
    syncStatus: 'synced',
    submissionStatus: item.submissionStatus ?? 'synced',
    activityMarked: local?.activityMarked ?? false,
    stats: item.stats ?? local?.stats ?? {},
  } satisfies StoredDailyPracticeRun)

  if (date && packIds.length > 0) {
    if (scope === 'single' && packIds.length === 1) {
      await localDb.put('daily_practice_runs', {
        id: ACTIVE_DAILY_PRACTICE_PACK_ID,
        packId: packIds[0],
        updatedAt: remoteUpdatedAt,
      } satisfies StoredActiveDailyPracticePack)
    }
    await localDb.put('daily_practice_runs', {
      id: activeRunPointerId(date, mode, scope, packIds),
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

function stableStringify(value: any): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function stableHash(value: any): string {
  const input = stableStringify(value)
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

function compactKey(value: any, fallback: string) {
  if (value == null) return fallback
  return String(value).trim() || fallback
}

function warmupItemIdentity(item: any) {
  return {
    type: item?.type,
    title: item?.title,
    kind: item?.kind,
    direction: item?.direction,
    chunk: item?.chunk,
    chunkMeaning: item?.chunkMeaning,
    pattern: item?.pattern,
    patternMeaning: item?.patternMeaning,
    vocabWord: item?.vocabWord,
    vocabMeaning: item?.vocabMeaning,
    fullSentence: item?.fullSentence,
    levels: item?.levels,
  }
}

export function createWarmupPracticeItemId(params: {
  packId: string
  topicId: string
  type: string
  item: any
  prompt: any
  pattern?: any
}) {
  const itemKey = compactKey(params.item?.id, `item-${stableHash(warmupItemIdentity(params.item))}`)
  const patternPart = params.pattern
    ? `:p-${compactKey(params.pattern.id, stableHash({
      chunk: params.pattern.chunk,
      meaning: params.pattern.meaning,
      chunkMeaning: params.pattern.chunkMeaning,
      pattern: params.pattern.pattern,
    }))}`
    : ''
  const promptKey = compactKey(
    params.prompt?.id ?? params.prompt?.vocabId,
    `prompt-${stableHash({
      zh: params.prompt?.zh,
      answer: params.prompt?.answer,
      promptZh: params.prompt?.promptZh,
      suggestedAnswer: params.prompt?.suggestedAnswer,
      targetWords: params.prompt?.targetWords,
      fullSentence: params.prompt?.fullSentence,
      levels: params.prompt?.levels,
    })}`,
  )
  return `${params.packId}:${params.topicId}:${itemKey}:${params.type}${patternPart}:i-${promptKey}`
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

/**
 * The run is the source of truth for a submitted answer. UI cards also write
 * a richer warmup record, but that write happens after an attempt callback and
 * may lose a race with logout. Build a recoverable display record directly
 * from the run whenever the richer record has not arrived yet.
 */
function fallbackWarmupRecords(plan: DailyPracticePlan, run: StoredDailyPracticeRun): WarmupRecordEntry[] {
  const attempted = new Set(run.attemptedItemIds)
  const unresolved = new Set(run.unresolvedItemIds)
  return plan.steps.flatMap((step) => {
    if (!attempted.has(step.itemId)) return []
    const initial = run.initialRecallResults[step.itemId]
    const prompt = step.prompt ?? {}
    const item = step.item ?? {}
    const passed = !unresolved.has(step.itemId)
    return [{
      stepId: step.itemId,
      stepType: step.type,
      zh: prompt.zh ?? prompt.promptZh ?? prompt.en ?? step.headerContent ?? step.label,
      answer: prompt.answer ?? prompt.suggestedAnswer ?? item.fullSentence ?? '',
      userAnswer: '',
      passed,
      feedback: passed ? '' : '答错，待重练',
      groupTitle: step.label,
      displayLabel: step.displayLabel,
      packId: step.packId,
      packTitle: step.packTitle,
      topicTitle: step.topicTitle,
      score: initial?.score ?? (passed ? 'ok' : 'miss'),
    } satisfies WarmupRecordEntry]
  })
}

/** Build the one payload shape used for both partial snapshots and completion. */
function createTodayRunSyncPayload(params: {
  plan: DailyPracticePlan
  run: StoredDailyPracticeRun
  attempts: DailyPracticeAttempt[]
  records: WarmupRecordEntry[]
  localWarmupRecordId?: string | null
  submissionStatus: SubmissionStatus
  stats: Record<string, unknown>
}) {
  const unresolved = new Set(params.run.unresolvedItemIds)
  const completedItemIds = params.run.attemptedItemIds.filter((id) => !unresolved.has(id))
  // 真实作答优先：params.records 由 recordEntry 维护为「最新在前」，直接沿用
  // 该顺序；fallback（run 派生的空 userAnswer 占位）只补缺失项，避免覆盖
  // 真实作答顺序。这样后端 items 与前端展示顺序一致（最新在前）。
  const recordsByStepId = new Map<string, WarmupRecordEntry>()
  for (const record of params.records) recordsByStepId.set(record.stepId, record)
  for (const record of fallbackWarmupRecords(params.plan, params.run)) {
    if (!recordsByStepId.has(record.stepId)) recordsByStepId.set(record.stepId, record)
  }
  const records = [...recordsByStepId.values()]
  const firstTopic = params.plan.topicStats.find((topic) => topic.scheduledTodayCount > 0) ?? params.plan.topicStats[0]
  const score = averageWarmupScore(records)
  return {
    run: {
      id: params.plan.runId,
      clientRunId: params.plan.runId,
      date: params.plan.date,
      mode: params.plan.mode,
      scope: params.plan.scope,
      packIds: params.plan.units.map((unit) => unit.id),
      scheduledItemIds: params.plan.scheduledItemIds,
      completedItemIds,
      attemptedItemIds: params.run.attemptedItemIds,
      unresolvedItemIds: params.run.unresolvedItemIds,
      srsAppliedItemIds: params.run.srsAppliedItemIds,
      initialRecallResults: params.run.initialRecallResults,
      continuationResults: params.run.continuationResults,
      remediationResults: params.run.remediationResults,
      submissionStatus: params.submissionStatus,
      // Outbox coalescing uses this local revision to reject a slower stale
      // snapshot for the same run (for example the original all-wrong submit).
      clientUpdatedAt: params.run.updatedAt,
      stats: params.stats,
    },
    attempts: params.attempts,
    warmupRecord: records.length > 0 && firstTopic ? {
      topicId: firstTopic.topicId,
      topicTitle: firstTopic.topicTitle,
      // 归属学习包：每条 item 已带 packId，取首条即可（同一记录通常同包）。
      packId: records[0]?.packId ?? null,
      items: records,
      score,
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

async function loadCandidateUnits(scope: DailyPracticeScope, targetPackId?: string | null): Promise<UnitDetail[]> {
  // 获取当前用户已加入的学习包列表（my_learning_units 是用户级表，退出登录时会被清空）
  const cachedMyUnits = await learningRepository.getCachedMyUnits().catch(() => [])
  let myUnits = cachedMyUnits.length > 0
    ? cachedMyUnits
    : await learningRepository.getMyUnits().catch(() => [])
  const packs = await learningPackService.listInstalled().catch(() => [])
  const installedIds = new Set(
    packs.filter((pack) => pack.status === 'installed').map((pack) => pack.packId),
  )

  const hasInstalledEnrolledPack = () => myUnits.some((unit) => installedIds.has(unit.id))
  const shouldRefreshEnrollment = targetPackId
    ? installedIds.has(targetPackId) && !myUnits.some((unit) => unit.id === targetPackId)
    : installedIds.size > 0 && !hasInstalledEnrolledPack()

  if (shouldRefreshEnrollment) {
    myUnits = await learningRepository.refreshMyUnits().catch(() => myUnits)
  }

  const enrolledIds = new Set(myUnits.map((u) => u.id))

  const getContentMode = async (unitId: string, declaredMode?: string, declaredType?: string) => {
    if (declaredMode) return declaredMode
    const installed = packs.find((pack) => pack.packId === unitId)
    if (installed?.manifest?.contentMode) return installed.manifest.contentMode
    const localDetail = await localDb.get<{ packageType?: string; contentMode?: string }>('downloaded_unit_details', unitId).catch(() => null)
    const legacyType = declaredType ?? installed?.manifest?.packageType ?? localDetail?.packageType
    return localDetail?.contentMode ?? (legacyType === 'story' ? 'story' : 'practice')
  }

  if (targetPackId) {
    // 即使通过 URL 指定了 packId，也必须检查当前用户是否已加入并安装了该学习包。
    if (!enrolledIds.has(targetPackId) || !installedIds.has(targetPackId)) return []
    const unit = myUnits.find((item) => item.id === targetPackId)
    const contentMode = await getContentMode(targetPackId, unit?.contentMode, unit?.packageType)
    if (contentMode !== 'practice') {
      console.log('[daily-practice] non-practice package excluded from Today practice', { packId: targetPackId, contentMode })
      return []
    }
    const detail = await learningRepository.getCachedUnitDetail(targetPackId)
    return detail ? [detail] : []
  }

  if (enrolledIds.size === 0 || installedIds.size === 0) return []

  // Story packs contain episodes, not warm-up practice. They must never become
  // the implicit current pack for Today merely because they sort first.
  const candidateEntries = await Promise.all(myUnits
    .filter((unit) => installedIds.has(unit.id))
    .map(async (unit) => ({
      id: unit.id,
      contentMode: await getContentMode(unit.id, unit.contentMode, unit.packageType),
    })))
  const excludedNonPracticePackIds = candidateEntries
    .filter((entry) => entry.contentMode !== 'practice')
    .map((entry) => entry.id)
  const candidateIds = candidateEntries
    .filter((entry) => entry.contentMode === 'practice')
    .map((entry) => entry.id)
  const detailsById = new Map<string, UnitDetail>()
  await Promise.all(candidateIds.map(async (id) => {
    const detail = await learningRepository.getCachedUnitDetail(id)
    if (detail) detailsById.set(id, detail)
  }))

  // 当前练习包必须有实际可执行的知识点题目。没有 pipeline 的 practice 包
  // 仍可下载和学习，但不能抢占或清空 Today 的练习上下文。
  const practiceCandidateIds = candidateIds.filter((id) => {
    const detail = detailsById.get(id)
    return detail ? buildCandidates(detail).length > 0 : false
  })
  const activePackId = await getActivePracticePackId()
  const selectedPackIds = scope === 'mixed'
    ? practiceCandidateIds
    : [practiceCandidateIds.includes(activePackId ?? '') ? activePackId! : practiceCandidateIds[0]].filter(Boolean)

  if (scope === 'single' && selectedPackIds[0] && selectedPackIds[0] !== activePackId) {
    await setActivePracticePackId(selectedPackIds[0])
  }

  const resolved = selectedPackIds
    .map((id) => detailsById.get(id))
    .filter(Boolean) as UnitDetail[]
  console.log('[daily-practice] candidate units resolved', {
    scope,
    targetPackId: targetPackId ?? null,
    installedPackIds: [...installedIds],
    activePackId: activePackId ?? null,
    selectedPackIds,
    practiceCandidateIds,
    excludedNonPracticePackIds,
    units: resolved.map((unit) => ({ id: unit.id, title: unit.title, trainingTopicCount: unit.trainingTopics?.length ?? 0 })),
  })
  return resolved
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
  } catch (err) {
    // 离线或网络错误：保留本地进度，等待下次同步
    console.debug('[daily-practice] progress sync skipped (offline or error):', (err as Error)?.message ?? err)
  }
}

export const dailyPracticeRepository = {
  async getActivePracticePackId() {
    return getActivePracticePackId()
  },

  /**
   * 复习模式全局待办数量（逾期 + 今天到期），与当前 Tab/plan 无关。
   * 纯本地轻量计算：只读 daily_practice_items 与 review run，不加载学习包
   * 内容、不发起网络请求，避免挂载/切换卡顿。
   * 范围：开跨学习包复习 → 所有包；否则 → 当前激活学习包。
   */
  async getReviewDebtCount(targetDate?: string | null): Promise<number> {
    const date = normalizePlanDate(targetDate)
    const preferences = usePreferencesStore.getState()
    const mixed = preferences.dailyPracticeMixedPacks
    const activePackId = mixed ? null : await getActivePracticePackId()
    const progresses = await localDb.list<DailyPracticeProgress>('daily_practice_items')
    const storedRuns = (await localDb.list<StoredDailyPracticeRun>('daily_practice_runs'))
      .filter((run) => run.id !== ACTIVE_DAILY_PRACTICE_PACK_ID && run.mode === 'review' && run.date === date)
    const appliedToday = new Set(storedRuns.flatMap((run) => run.srsAppliedItemIds ?? []))
    return progresses.filter((p) =>
      (mixed || p.packId === activePackId)
      && (p.attempts ?? 0) > 0
      && (p.dueDate ?? '') <= date
      && !appliedToday.has(p.itemId)
    ).length
  },

  /**
   * Read a mode-specific tab summary without rebuilding or switching the
   * active plan. The Today page keeps one active plan at a time, so its tabs
   * must never borrow counts from that active plan for the other mode.
   */
  async getRunSummary(date: string, mode: DailyPracticePlanMode): Promise<DailyPracticeRunSummary | null> {
    const run = (await localDb.list<StoredDailyPracticeRun>('daily_practice_runs'))
      .filter((item) => item.id !== ACTIVE_DAILY_PRACTICE_PACK_ID
        && item.date === date
        && item.mode === mode
        && Array.isArray(item.scheduledItemIds)
        && item.scheduledItemIds.length > 0)
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))[0]
    if (!run) return null
    return {
      attemptedCount: new Set(run.attemptedItemIds ?? []).size,
      totalCount: run.scheduledItemIds.length,
    }
  },

  async setActivePracticePackId(packId: string) {
    const detail = await learningRepository.getCachedUnitDetail(packId)
    if (!detail || buildCandidates(detail).length === 0) {
      throw new Error('当前学习包没有可执行的知识点练习')
    }
    await setActivePracticePackId(packId)
  },

  async resolveCandidateUnits(scope: DailyPracticeScope, targetPackId?: string | null): Promise<UnitDetail[]> {
    return loadCandidateUnits(scope, targetPackId)
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
    const storedRuns = (await localDb.list<StoredDailyPracticeRun>('daily_practice_runs'))
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
    const units = await this.resolveCandidateUnits(packScope, targetPackId ?? recoveredPackId)
    const candidates = units.flatMap(buildCandidates)
    const packIds = units.map((unit) => unit.id)
    const packIdsKey = packKey(packIds)
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

    const localProgress = await localDb.list<DailyPracticeProgress>('daily_practice_items')
    const progressMap = new Map(localProgress.map((item) => [item.itemId, item]))
    const withStatus = candidates.map((candidate) => {
      const progress = progressMap.get(candidate.itemId) ?? emptyProgress(candidate, date)
      progressMap.set(candidate.itemId, progress)
      return { candidate, progress, status: scheduleStatus(progress, date) }
    })

    const allRuns = storedRuns
    const reviewAppliedToday = new Set(allRuns
      .filter((run) => run.mode === 'review' && run.date === date && runMatchesScope(run, packScope, packIds))
      .flatMap((run) => run.srsAppliedItemIds ?? []))
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
    if (applied.size !== (run.srsAppliedItemIds ?? []).length) {
      run.srsAppliedItemIds = [...applied]
      run.updatedAt = new Date().toISOString()
      await localDb.put('daily_practice_runs', run)
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
      syncStatus: facts.submissionStatus === 'synced' ? 'synced' : 'pending',
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
    const attempts = await localDb.list<DailyPracticeAttempt>('daily_practice_attempts')
    const pending = attempts.filter((attempt) => attempt.syncStatus !== 'synced' && itemIdSet.has(attempt.itemId))
    const progresses = await localDb.list<DailyPracticeProgress>('daily_practice_items')
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
   * Persist an in-progress Today run without marking it complete. This makes
   * logout, reinstall, and cache rebuild recoverable even before the final
   * practice record is generated.
   */
  async syncRunSnapshot(plan: DailyPracticePlan, records: WarmupRecordEntry[] = [], localWarmupRecordId?: string | null) {
    const run = await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', plan.runId)
    if (!run) return
    // A record must travel with the very same snapshot that preserves the
    // answer.  Waiting for the Today page's render effect leaves a window in
    // which sign-out can upload the run but clear the local display record.
    const resolvedLocalWarmupRecordId = localWarmupRecordId ?? `today-warmup:${plan.runId}`
    // Recovery re-enqueues (e.g. loadToday after a mode switch or the manual
    // sync reload) pass no in-memory records.  The persisted warmup record
    // holds the learner's real answers — including retry-round answers — and
    // must travel with the snapshot.  Without this, the payload falls back to
    // run-derived placeholders whose userAnswer is empty, and the next outbox
    // flush would overwrite the server record with blank answers.
    let resolvedRecords = records
    if (resolvedRecords.length === 0) {
      const persisted = await practiceRepository.getLocalWarmupRecord(resolvedLocalWarmupRecordId).catch(() => null)
      resolvedRecords = Array.isArray(persisted?.items) ? (persisted as any).items : []
    }
    if (resolvedRecords.length === 0) {
      // No real answers are available at all.  If a snapshot for this run is
      // already pending, it carries the learner's produced records — never let
      // an empty placeholder snapshot replace it (or clobber the local record
      // via the upsert below).
      const pending = await syncOutbox.listPending()
      const hasPendingSnapshot = pending.some((entry) =>
        entry.entityType === 'daily_practice' && entry.entityId === plan.runId)
      if (hasPendingSnapshot) return
    }
    const attempts = await localDb.list<DailyPracticeAttempt>('daily_practice_attempts')
    const pendingAttempts = attempts.filter((attempt) =>
      attempt.runId === plan.runId
      && attempt.syncStatus !== 'synced'
      && attempt.applyStatus === 'applied',
    )
    const payload = createTodayRunSyncPayload({
      plan, run, attempts: pendingAttempts, records: resolvedRecords, localWarmupRecordId: resolvedLocalWarmupRecordId,
      submissionStatus: run.submissionStatus, stats: run.stats ?? {},
    })
    if (payload.warmupRecord) {
      await practiceRepository.upsertLocalWarmupRecord({
        id: resolvedLocalWarmupRecordId,
        topicId: payload.warmupRecord.topicId,
        topicTitle: payload.warmupRecord.topicTitle,
        items: payload.warmupRecord.items,
        syncStatus: 'pending',
      })
    }
    // Today runs have exactly one transport: the per-run outbox entry.  Do not
    // also send a direct request here.  The former dual path could submit two
    // snapshots concurrently, and logout could race either request with local
    // cleanup.  `enqueue` coalesces every newer snapshot for this run.
    await syncOutbox.enqueue({
      entityType: 'daily_practice',
      entityId: plan.runId,
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
    const payload = createTodayRunSyncPayload({
      plan, run, attempts: pending, records, localWarmupRecordId,
      submissionStatus: 'synced',
      stats: {
        records: records.length,
        completed: completedIds.length,
        attemptedItemIds: run.attemptedItemIds,
        unresolvedItemIds: run.unresolvedItemIds,
        srsAppliedItemIds: run.srsAppliedItemIds,
        initialRecallResults: run.initialRecallResults,
        continuationResults: run.continuationResults,
        remediationResults: run.remediationResults,
      },
    })

    if (!run.activityMarked) {
      await practiceRepository.markTodayActivity(completedIds.length || records.length || 1, plan.date, plan.runId)
      run = { ...run, activityMarked: true, updatedAt: new Date().toISOString() }
      await localDb.put('daily_practice_runs', run)
    }
    const firstTopic = plan.topicStats.find((topic) => topic.scheduledTodayCount > 0) ?? plan.topicStats[0]
    if (localWarmupRecordId && records.length > 0 && firstTopic) {
      await practiceRepository.upsertLocalWarmupRecord({
        id: localWarmupRecordId,
        topicId: firstTopic.topicId,
        topicTitle: firstTopic.topicTitle,
        items: records,
        syncStatus: 'pending',
      })
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

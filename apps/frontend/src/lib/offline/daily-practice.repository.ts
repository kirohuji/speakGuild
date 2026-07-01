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
  streak: number
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
  suggestedDurationSec: number
  difficulty: string
  totalCount: number
  todayNewCount: number
  todayReviewCount: number
  overdueCount: number
  doneTodayCount: number
  scheduledTodayCount: number
  masteredCount: number
  topicWarmupProgress: number
  status: DailyPracticeStatus
}

export interface DailyPracticePlan {
  date: string
  scope: DailyPracticeScope
  mode: DailyPracticePlanMode
  dailyGoal: number
  availableReviewCount: number
  practicePoolCount: number
  units: UnitDetail[]
  steps: ScheduledDailyPracticeItem[]
  topicStats: TopicDailyPracticeStats[]
  scheduledItemIds: string[]
  completedItemIds: string[]
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
}

type StoredDailyPracticeRun = {
  id: string
  date: string
  scope: DailyPracticeScope
  mode: DailyPracticePlanMode
  packIds?: string[]
  packIdsKey?: string
  scheduledItemIds?: string[]
  completedItemIds?: string[]
  stats?: Record<string, unknown>
}

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizePlanDate(date?: string | null) {
  if (!date) return todayKey()
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKey()
}

function practicedAtForDate(date: string) {
  return `${date}T12:00:00.000Z`
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function scoreRank(score?: string | null) {
  if (score === 'strong') return 3
  if (score === 'ok') return 2
  if (score === 'weak') return 1
  return 0
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}:${crypto.randomUUID()}`
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
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
    streak: 0,
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

function nextProgress(progress: DailyPracticeProgress, score: WarmupScore, date: string): DailyPracticeProgress {
  const rank = scoreRank(score)
  const passed = rank >= 2
  const nextStreak = passed ? progress.streak + 1 : 0
  const nextLapse = passed ? progress.lapseCount : progress.lapseCount + 1
  const intervalDays = score === 'strong'
    ? Math.min(30, progress.intervalDays <= 0 ? 3 : Math.max(progress.intervalDays + 1, Math.round(progress.intervalDays * 2.2)))
    : score === 'ok'
      ? Math.min(14, progress.intervalDays <= 0 ? 1 : Math.max(progress.intervalDays, Math.round(progress.intervalDays * 1.4)))
      : 1
  const status = nextStreak >= 4 && score === 'strong' ? 'mastered' : passed ? 'review' : 'learning'
  const bestRank = Math.max(progress.bestScoreRank, rank)
  return {
    ...progress,
    status,
    dueDate: addDays(date, intervalDays),
    lastPracticedAt: practicedAtForDate(date),
    bestScore: rank >= progress.bestScoreRank ? score : progress.bestScore,
    bestScoreRank: bestRank,
    lastScore: score,
    lastScoreRank: rank,
    attempts: progress.attempts + 1,
    correctCount: progress.correctCount + (passed ? 1 : 0),
    streak: nextStreak,
    lapseCount: nextLapse,
    intervalDays,
    easeFactor: Math.max(1.3, Math.min(3.0, progress.easeFactor + (score === 'strong' ? 0.15 : score === 'ok' ? 0.02 : -0.2))),
    updatedAt: new Date().toISOString(),
  }
}

function buildCandidates(unit: UnitDetail): DailyPracticeCandidate[] {
  const candidates: DailyPracticeCandidate[] = []
  for (const topic of unit.trainingTopics ?? []) {
    const pipeline = topic.metadata?.outputTraining?.enabled
      ? (topic.metadata.outputTraining.pipeline ?? [])
      : []
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
        ;((item.items ?? []) as any[]).forEach((prompt, idx) => push(prompt, idx))
      } else if (type === 'vocab_drill') {
        ;((item.vocabs ?? []) as any[]).forEach((prompt, idx) => push(prompt, idx))
      } else if (type === 'vocab_sentence_building') {
        ;((item.patterns ?? []) as any[]).forEach((pattern, patternIndex) => {
          ;((pattern.items ?? []) as any[]).forEach((prompt, idx) => push({ ...prompt, pattern }, idx, {
            pattern,
            patternIndex,
            label: `${item.vocabWord || '词汇'} + ${pattern.chunk || item.vocabWord || ''}`,
            headerContent: item.vocabWord || pattern.chunk || prompt.zh || '',
          }))
        })
      } else if (type === 'pattern_drill') {
        ;((item.items ?? []) as any[]).forEach((prompt, idx) => push(prompt, idx))
      } else if (type === 'sentence_decomposition') {
        push({ levels: item.levels, fullSentence: item.fullSentence }, 0)
      }
    }
  }
  return candidates
}

async function loadCandidateUnits(scope: DailyPracticeScope, targetPackId?: string | null): Promise<UnitDetail[]> {
  // 获取当前用户已加入的学习包列表（my_learning_units 是用户级表，退出登录时会被清空）
  const myUnits = await learningRepository.getCachedMyUnits().catch(() => [])
  const enrolledIds = new Set(myUnits.map((u) => u.id))

  if (targetPackId) {
    // 即使通过 URL 指定了 packId，也必须检查当前用户是否已加入该学习包
    if (!enrolledIds.has(targetPackId)) return []
    const detail = await learningRepository.getCachedUnitDetail(targetPackId)
    return detail ? [detail] : []
  }

  if (enrolledIds.size === 0) return []

  const packs = await learningPackService.listInstalled().catch(() => [])
  const installedIds = new Set(
    packs.filter((pack) => pack.status === 'installed').map((pack) => pack.packId),
  )

  // 只选择同时满足"已安装"+"用户已加入"的学习包
  const candidateIds = [...enrolledIds].filter((id) => installedIds.has(id))
  const unitIds = scope === 'mixed'
    ? candidateIds
    : [candidateIds[0]].filter(Boolean) as string[]

  const details = await Promise.all(unitIds.map((id) => learningRepository.getCachedUnitDetail(id)))
  return details.filter(Boolean) as UnitDetail[]
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
      suggestedDurationSec: topic.suggestedDurationSec,
      difficulty: topic.difficulty,
      totalCount: total,
      todayNewCount,
      todayReviewCount,
      overdueCount,
      doneTodayCount,
      scheduledTodayCount: scheduledSteps.length,
      masteredCount,
      topicWarmupProgress: total > 0 ? Math.round(((doneTodayCount + masteredCount) / total) * 100) : 0,
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

export const dailyPracticeRepository = {
  async resolveCandidateUnits(scope: DailyPracticeScope, targetPackId?: string | null): Promise<UnitDetail[]> {
    return loadCandidateUnits(scope, targetPackId)
  },

  async buildTodayPlan(
    targetPackId?: string | null,
    targetDate?: string | null,
    mode: DailyPracticePlanMode = 'review',
    options: { forceNew?: boolean } = {},
  ): Promise<DailyPracticePlan> {
    const date = normalizePlanDate(targetDate)
    const preferences = usePreferencesStore.getState()
    const dailyGoal = preferences.dailyGoal
    const packScope: DailyPracticeScope = preferences.dailyPracticeMixedPacks ? 'mixed' : 'single'
    const practiceOrderPool = preferences.dailyPracticeRandomOrder ? shuffleItems : <T,>(items: T[]) => items
    const units = await this.resolveCandidateUnits(packScope, targetPackId)
    const candidates = units.flatMap(buildCandidates)
    const itemIds = candidates.map((candidate) => candidate.itemId)

    try {
      const remote = await dailyPracticeApi.progress(itemIds)
      await localDb.putMany('daily_practice_items', remote.items.map((item: any) => ({ ...item, id: item.itemId })))
    } catch { /* offline: local state is enough */ }

    const localProgress = await localDb.list<DailyPracticeProgress>('daily_practice_items')
    const progressMap = new Map(localProgress.map((item) => [item.itemId, item]))
    const withStatus = candidates.map((candidate) => {
      const progress = progressMap.get(candidate.itemId) ?? emptyProgress(candidate, date)
      progressMap.set(candidate.itemId, progress)
      return { candidate, progress, status: scheduleStatus(progress, date) }
    })

    const overdue = withStatus.filter((x) => x.status === 'overdue')
    const review = withStatus.filter((x) => x.status === 'review')
    const reviewBacklog = [...overdue, ...review]
    const practicePool = withStatus.filter((x) => x.status !== 'mastered' && x.status !== 'done')
    const cachedRun = await localDb.get<StoredDailyPracticeRun>('daily_practice_runs', `daily:${date}`).catch(() => null)
    const candidateById = new Map(withStatus.map((item) => [item.candidate.itemId, item]))
    const canReuseCachedRun = !options.forceNew
      && cachedRun?.date === date
      && cachedRun.mode === mode
      && cachedRun.scope === packScope
      && cachedRun.packIdsKey === units.map((unit) => unit.id).join(',')
      && (cachedRun.scheduledItemIds?.length ?? 0) > 0
      && cachedRun.scheduledItemIds?.every((itemId) => candidateById.has(itemId))
    const scheduledSource = canReuseCachedRun
      ? cachedRun.scheduledItemIds!.map((itemId) => candidateById.get(itemId)!)
      : mode === 'review'
      ? reviewBacklog
      : practiceOrderPool(practicePool).slice(0, dailyGoal)
    const scheduled = scheduledSource.map(({ candidate, progress, status }) => ({
      ...candidate,
      progress,
      scheduleStatus: status,
    }))

    const run = {
      id: `daily:${date}`,
      date,
      scope: packScope,
      mode,
      packIds: units.map((unit) => unit.id),
      packIdsKey: units.map((unit) => unit.id).join(','),
      scheduledItemIds: scheduled.map((step) => step.itemId),
      completedItemIds: scheduled.filter((step) => step.scheduleStatus === 'done').map((step) => step.itemId),
      stats: {
        overdue: overdue.length,
        review: review.length,
        new: scheduled.filter((step) => step.scheduleStatus === 'new').length,
      },
    }
    await localDb.put('daily_practice_runs', run)
    if (date === todayKey()) {
      void setLearningBadgeCount(Math.max(0, run.scheduledItemIds.length - run.completedItemIds.length))
    }

    return {
      date,
      scope: packScope,
      mode,
      dailyGoal,
      availableReviewCount: reviewBacklog.length,
      practicePoolCount: practicePool.length,
      units,
      steps: scheduled,
      topicStats: buildTopicStats(units, candidates, progressMap, scheduled, date),
      scheduledItemIds: run.scheduledItemIds,
      completedItemIds: run.completedItemIds,
    }
  },

  async completeItem(step: ScheduledDailyPracticeItem, score: WarmupScore, targetDate?: string | null): Promise<DailyPracticeProgress> {
    const date = normalizePlanDate(targetDate)
    const practicedAt = practicedAtForDate(date)
    const updated = nextProgress(step.progress, score, date)
    await localDb.put('daily_practice_items', updated)

    const attempt: DailyPracticeAttempt = {
      id: createId('attempt'),
      clientAttemptId: createId('client_attempt'),
      itemId: step.itemId,
      packId: step.packId,
      topicId: step.topicId,
      type: step.type,
      score,
      passed: scoreRank(score) >= 2,
      payload: { label: step.label, displayLabel: step.displayLabel },
      practicedAt,
      syncStatus: 'pending',
    }
    await localDb.put('daily_practice_attempts', attempt)
    if (date === todayKey()) {
      const run = await localDb.get<{ id: string; scheduledItemIds?: string[]; completedItemIds?: string[] }>('daily_practice_runs', `daily:${date}`)
      if (run) {
        const completedItemIds = Array.from(new Set([...(run.completedItemIds ?? []), step.itemId]))
        await localDb.put('daily_practice_runs', { ...run, completedItemIds })
        void setLearningBadgeCount(Math.max(0, (run.scheduledItemIds ?? []).length - completedItemIds.length))
      }
    }
    return updated
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

    if (date === todayKey()) {
      const run = await localDb.get<{ id: string; scheduledItemIds?: string[]; completedItemIds?: string[] }>('daily_practice_runs', `daily:${date}`)
      if (run?.scheduledItemIds?.includes(candidate.itemId)) {
        const completedItemIds = Array.from(new Set([...(run.completedItemIds ?? []), candidate.itemId]))
        await localDb.put('daily_practice_runs', { ...run, completedItemIds })
        void setLearningBadgeCount(Math.max(0, (run.scheduledItemIds ?? []).length - completedItemIds.length))
      }
    }

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
    const payload = {
      run: {
        date,
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
      itemProgresses,
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

  async completeRun(plan: DailyPracticePlan, records: WarmupRecordEntry[], localWarmupRecordId?: string | null) {
    const attempts = await localDb.list<DailyPracticeAttempt>('daily_practice_attempts')
    const pending = attempts.filter((attempt) => attempt.syncStatus !== 'synced' && plan.scheduledItemIds.includes(attempt.itemId))
    const progresses = await localDb.list<DailyPracticeProgress>('daily_practice_items')
    const itemProgresses = progresses.filter((progress) => plan.scheduledItemIds.includes(progress.itemId))
    const completedIds = itemProgresses
      .filter((progress) => progress.lastPracticedAt?.slice(0, 10) === plan.date)
      .map((progress) => progress.itemId)
    const firstTopic = plan.topicStats.find((topic) => topic.scheduledTodayCount > 0) ?? plan.topicStats[0]
    const scoreValues = records.map((record) => scoreRank(record.score)).filter((rank) => rank > 0)
    const score = scoreValues.length > 0 ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length / 3 * 100) : null
    const payload = {
      run: {
        date: plan.date,
        scope: plan.scope,
        packIds: plan.units.map((unit) => unit.id),
        scheduledItemIds: plan.scheduledItemIds,
        completedItemIds: completedIds,
        stats: {
          records: records.length,
          completed: completedIds.length,
        },
      },
      attempts: pending,
      itemProgresses,
      warmupRecord: records.length > 0 && firstTopic ? {
        topicId: firstTopic.topicId,
        topicTitle: firstTopic.topicTitle,
        items: records,
        score,
        feedback: null,
      } : undefined,
    }

    await practiceRepository.markTodayActivity(completedIds.length || records.length || 1, plan.date)
    if (localWarmupRecordId && records.length > 0 && firstTopic) {
      await practiceRepository.upsertLocalWarmupRecord({
        id: localWarmupRecordId,
        topicId: firstTopic.topicId,
        topicTitle: firstTopic.topicTitle,
        items: records,
        syncStatus: 'pending',
      })
    }

    try {
      const result = await dailyPracticeApi.complete(payload)
      if (localWarmupRecordId && records.length > 0) {
        await practiceRepository.markWarmupRecordSynced(localWarmupRecordId, result.warmupRecordId)
      }
      await Promise.all(result.syncedAttempts.map(async (clientAttemptId) => {
        const attempt = pending.find((item) => item.clientAttemptId === clientAttemptId)
        if (attempt) await localDb.put('daily_practice_attempts', { ...attempt, syncStatus: 'synced' as const })
      }))
      return result
    } catch (error) {
      await syncOutbox.enqueue({
        entityType: 'daily_practice',
        entityId: `daily:${plan.date}`,
        operation: 'create',
        payload,
      })
      throw error
    }
  },
}

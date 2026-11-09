import {
  isInProgressLearningUnit,
  isScriptLearningUnit,
  learningApi,
  MAX_CONCURRENT_LEARNING_UNITS,
  type LearningUnitSummary,
  type MyUnit,
  type StoryEpisodePlayerData,
  type UnitDetail,
} from '@/features/learning/api/learning-api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'
import { ApiRequestError } from '@/lib/request'
import { buildWarmupPracticeItemIds } from './warmup-practice-item-id'
import { ensurePackProjection, readUnitScene, readUnitShell, readUnitSummary } from './learning-pack-read-model'

type LocalDailyPracticeProgress = {
  itemId: string
  packId: string
  bestScoreRank?: number | null
}

type LocalNovelReadingProgress = {
  id: string
  type: 'novel'
  sceneId: string
  locator: Record<string, any>
  percentage: number
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'failed'
}

type LocalTeachingReadingProgress = {
  id: string
  type: 'teaching_reading'
  sceneId: string
  topicId: string
  percentage: number
  updatedAt: string
}

type TopicDetailRecord = {
  topicId: string
  detail: any
}

async function isPackInstalled(unitId: string) {
  const pack = await localDb.get<{ status?: string }>('downloaded_packs', unitId)
  return pack?.status === 'installed'
}

export function buildAggregatedUnitContent(unitDetail: any, topicDetails: TopicDetailRecord[]): any {
  const vocabMap = new Map<string, any>()
  const chunkMap = new Map<string, any>()
  const patternMap = new Map<string, any>()
  const trainingTopics: any[] = []

  // Novel packages deliberately have no TrainingTopic. Their only knowledge
  // source is the Scene-level list carried by the offline unit detail.
  if (unitDetail?.contentMode === 'novel') {
    for (const item of unitDetail.vocabularies ?? []) if (item?.id) vocabMap.set(item.id, item)
    for (const item of unitDetail.chunks ?? []) if (item?.id) chunkMap.set(item.id, item)
    for (const item of unitDetail.sentencePatterns ?? []) {
      const key = item?.id ?? item?.pattern
      if (key) patternMap.set(key, item)
    }
  }

  for (const { topicId: fallbackTopicId, detail } of topicDetails) {
    if (!detail) continue
    const topicId = detail.topic?.id ?? fallbackTopicId

    trainingTopics.push({
      ...detail.topic,
      id: topicId,
      title: detail.topic?.title,
      description: detail.topic?.description,
      promptEn: detail.topic?.promptEn,
      promptZh: detail.topic?.promptZh,
      difficulty: detail.topic?.difficulty,
      suggestedDurationSec: detail.topic?.suggestedDurationSec,
      metadata: detail.topic?.metadata,
      activityType: detail.topic?.activityType,
      contentConfig: detail.topic?.contentConfig,
      // 离线包 topic JSON 只携带稳定的 mediaAssetId；mediaUrl 需由客户端按
      // assetId 解析成本地可播放地址（见 use-topic-media）。这里同时透传
      // 线上缓存中可能存在的 mediaUrl，保证 Web 与在线场景可直接播放。
      mediaUrl: detail.topic?.mediaUrl ?? null,
      mediaAssetId: detail.topic?.mediaAssetId ?? null,
      transcript: detail.topic?.transcript,
      latestSubmission: detail.topic?.latestSubmission,
      vocabularies: detail.vocabularies ?? [],
      activeChunks: detail.activeChunks ?? [],
      sentencePatterns: (detail.sentencePatterns ?? []).map((p: any) => ({
        ...p,
        topicId,
        topicTitle: detail.topic?.title,
      })),
    })

    for (const v of detail.vocabularies ?? []) {
      if (!vocabMap.has(v.id)) vocabMap.set(v.id, v)
    }
    for (const c of detail.activeChunks ?? []) {
      if (!chunkMap.has(c.id)) chunkMap.set(c.id, c)
    }
    for (const p of detail.sentencePatterns ?? []) {
      const key = p.pattern ?? p.id ?? JSON.stringify(p)
      if (!patternMap.has(key)) {
        patternMap.set(key, { ...p, topicId, topicTitle: detail.topic?.title })
      }
    }
  }

  return {
    ...unitDetail,
    vocabularies: [...vocabMap.values()],
    chunks: [...chunkMap.values()],
    sentencePatterns: [...patternMap.values()],
    trainingTopics,
    __offlineAggregatedView: true,
    __offlineAggregatedTopicIds: topicDetails.map((record) => record.topicId),
    __offlineAggregatedAt: new Date().toISOString(),
  }
}

/** Aggregate vocabs/chunks/patterns/trainingTopics from stored topic details into a unitDetail */
async function aggregateUnitContent(unitDetail: any): Promise<any> {
  if (unitDetail?.__offlineAggregatedView) return unitDetail

  // Get topic IDs from the pack manifest (or fall back to trainingTopics if still present)
  let topicIds: string[] = (unitDetail.trainingTopics ?? []).map((t: any) => t.id)
  if (topicIds.length === 0) {
    const pack = await localDb.get<{ manifest?: { topics?: string[] } }>('downloaded_packs', unitDetail.id)
    topicIds = pack?.manifest?.topics ?? []
  }

  const topicDetails = (await Promise.all(topicIds.map(async (topicId) => {
    try {
      const cached = await localDb.get<{ detail: any }>('downloaded_unit_details', `topic:${topicId}`)
      return cached?.detail ? { topicId, detail: cached.detail } : null
    } catch {
      return null
    }
  }))).filter((record): record is TopicDetailRecord => Boolean(record))

  const aggregated = buildAggregatedUnitContent(unitDetail, topicDetails)
  // 回写聚合结果，下次进入直接命中快速路径
  cacheAggregated(unitDetail.id, aggregated).catch(() => {})
  return aggregated
}

/** 聚合后回写缓存，下次进入直接命中快速路径 */
async function cacheAggregated(unitId: string, aggregated: any) {
  try {
    await localDb.put('downloaded_unit_details', { ...aggregated, id: unitId })
  } catch { /* 非关键路径，静默失败 */ }
}

function summaryToMyUnit(unit: LearningUnitSummary | UnitDetail): MyUnit {
  const progress = unit.progress ?? {
    readiness: 0,
    mastery: 0,
    vocabLearned: 0,
    vocabTotal: 'vocabularies' in unit ? unit.vocabularies.length : unit.vocabCount,
    chunkMastered: 0,
    chunkTotal: 'chunks' in unit ? unit.chunks.length : unit.chunkCount,
    completedPracticeCount: 0,
    completedScriptCount: 0,
  }

  return {
    id: unit.id,
    packageType: unit.packageType,
    contentMode: unit.contentMode,
    title: unit.title,
    location: unit.location,
    description: unit.description,
    categoryName: 'trainingTopics' in unit ? unit.category : unit.categoryName ?? unit.categoryId ?? '',
    topics: 'topics' in unit ? unit.topics : unit.trainingTopics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      difficulty: topic.difficulty,
      suggestedDurationSec: topic.suggestedDurationSec,
    })),
    vocabCount: unit.vocabCount,
    chunkCount: unit.chunkCount,
    topicCount: unit.topicCount,
    scriptCount: unit.scriptCount,
    progress,
    status: 'status' in unit ? unit.status : Math.round(progress.mastery) >= 100 ? 'completed' : 'in_progress',
    completedAt: 'completedAt' in unit ? unit.completedAt : null,
    completion: 'completion' in unit ? unit.completion : {
      kind: unit.contentMode === 'novel' ? 'novel' : unit.contentMode === 'reading' || unit.contentMode === 'writing' || unit.contentMode === 'listening' ? unit.contentMode : 'practice',
      completed: 0,
      total: unit.topicCount,
      percent: Math.round(progress.mastery),
    },
    completionPercent: 'completionPercent' in unit ? unit.completionPercent : Math.round(progress.mastery),
  }
}

function hasTrackableTasksInDownloadedPack(unit: UnitDetail): boolean {
  if (unit.contentMode === 'novel') return true
  const projected = unit as UnitDetail & { __offlineProjection?: boolean; hasActivityTasks?: boolean; practiceItemCount?: number }
  if (projected.__offlineProjection) {
    return Boolean(projected.hasActivityTasks) || (projected.practiceItemCount ?? 0) > 0
  }
  if (unit.trainingTopics.some((topic) => topic.activityType && topic.activityType !== 'practice')) return true
  return buildWarmupPracticeItemIds(unit.id, unit.trainingTopics).length > 0
}

async function mergeLocalPracticeProgress(units: MyUnit[]): Promise<MyUnit[]> {
  if (units.length === 0) return units

  const packIds = units.map((unit) => unit.id)
  const progresses = await localDb.findByIndexIn<LocalDailyPracticeProgress>('daily_practice_items', 'pack_id', packIds).catch(() => [])

  const completedByPack = new Map<string, Set<string>>()
  for (const progress of progresses) {
    if ((progress.bestScoreRank ?? 0) < 2) continue
    const itemIds = completedByPack.get(progress.packId) ?? new Set<string>()
    itemIds.add(progress.itemId)
    completedByPack.set(progress.packId, itemIds)
  }
  const teachingProgresses = await localDb.findByIndexIn<LocalTeachingReadingProgress>('user_progress', 'scene_id', packIds).catch(() => [])
  const teachingProgressByTopic = new Map(
    teachingProgresses
      .filter((record) => record.type === 'teaching_reading' && record.topicId)
      .map((record) => [record.topicId, record.percentage]),
  )

  return Promise.all(units.map(async (unit) => {
    // A plan response deliberately contains no exercise pipeline. For every
    // installed package, both numerator and denominator must be calculated
    // from this exact SQLite package version, never from current server edits.
    const summary = await isPackInstalled(unit.id) ? await readUnitSummary(unit.id) : null
    if (!summary) {
      if (await isPackInstalled(unit.id)) void ensurePackProjection(unit.id).catch(() => {})
      return unit
    }

    const itemIds = summary.practiceItemIds ?? []
    const localCounts = {
      vocabCount: summary.vocabCount ?? unit.vocabCount,
      chunkCount: summary.chunkCount ?? unit.chunkCount,
      topicCount: summary.topicCount ?? unit.topicCount,
    }
    if (itemIds.length === 0) {
      if (summary.contentMode === 'novel' || summary.hasActivityTasks) return { ...unit, ...localCounts }
      const teachingTopics = (summary.teachingTopicIds ?? []).map((id: string) => ({ id }))
      if (teachingTopics.length > 0) {
        const completed = teachingTopics.filter((topic: any) =>
          (teachingProgressByTopic.get(topic.id) ?? 0) > 90,
        ).length
        const percent = Math.round((completed / teachingTopics.length) * 100)
        return {
          ...unit,
          ...localCounts,
          // Reading every document unlocks manual completion; the user still
          // explicitly confirms completion with the button in the plan.
          status: unit.progress?.mastery === 100 ? 'completed' : 'in_progress',
          completion: { kind: 'manual', completed, total: teachingTopics.length, percent },
          completionPercent: unit.progress?.mastery === 100 ? 100 : percent,
        }
      }
      const percent = Math.min(100, Math.max(0, unit.progress?.mastery ?? 0))
      return {
        ...unit,
        ...localCounts,
        status: percent >= 100 ? 'completed' : 'in_progress',
        completion: { kind: 'manual', completed: percent >= 100 ? 1 : 0, total: 1, percent },
        completionPercent: percent,
      }
    }

    const itemIdSet = new Set(itemIds)
    const completedPracticeCount = [...(completedByPack.get(unit.id) ?? new Set<string>())]
      .filter((itemId) => itemIdSet.has(itemId)).length
    const totalPracticeCount = itemIds.length
    const completionPercent = totalPracticeCount > 0
      ? Math.round((completedPracticeCount / totalPracticeCount) * 100)
      : 0

    return {
      ...unit,
      ...localCounts,
      progress: {
        ...unit.progress,
        completedPracticeCount,
        totalPracticeCount,
      },
      status: completionPercent >= 100 ? 'completed' : 'in_progress',
      completion: {
        ...unit.completion,
        kind: 'practice',
        completed: completedPracticeCount,
        total: totalPracticeCount,
        percent: completionPercent,
      },
      completionPercent,
    }
  }))
}

/** Local reading progress is authoritative until its outbox item reaches the server. */
async function mergeLocalNovelProgress(units: MyUnit[]): Promise<MyUnit[]> {
  const records = await localDb.list<LocalNovelReadingProgress>('user_progress').catch(() => [])
  const bySceneId = new Map(records
    .filter((record) => record.type === 'novel' && record.sceneId)
    .map((record) => [record.sceneId, record]))

  return units.map((unit) => {
    if (unit.contentMode !== 'novel') return unit
    const local = bySceneId.get(unit.id)
    if (!local) return unit
    const localPercent = Math.min(100, Math.max(0, Math.round(local.percentage * 100)))
    const percent = localPercent >= 95 ? 100 : Math.max(unit.completionPercent ?? 0, localPercent)
    if (percent <= (unit.completionPercent ?? 0)) return unit
    return {
      ...unit,
      status: percent >= 100 ? 'completed' : 'in_progress',
      completion: { kind: 'novel', completed: percent, total: 100, percent },
      completionPercent: percent,
    }
  })
}

async function mergeLocalUnitProgress(units: MyUnit[]): Promise<MyUnit[]> {
  return mergeLocalNovelProgress(await mergeLocalPracticeProgress(units))
}

export const learningRepository = {
  async getMyUnits(): Promise<MyUnit[]> {
    const cached = await localDb.list<MyUnit>('my_learning_units')
    if (cached.length > 0) return mergeLocalUnitProgress(cached)

    try {
      const remote = await learningApi.getMyUnits()
      await localDb.putMany('my_learning_units', remote)
      return mergeLocalUnitProgress(remote)
    } catch {
      return mergeLocalUnitProgress(await localDb.list<MyUnit>('my_learning_units'))
    }
  },

  async getCachedMyUnits(): Promise<MyUnit[]> {
    return localDb.list<MyUnit>('my_learning_units')
  },

  async refreshMyUnits(): Promise<MyUnit[]> {
    const remote = await learningApi.getMyUnits()
    await localDb.clear('my_learning_units')
    // Keep this table as the server's account projection. Package-derived
    // counts are a transient view, otherwise an uninstalled/updated package
    // can leave its previous totals behind in SQLite.
    await localDb.putMany('my_learning_units', remote)
    return mergeLocalUnitProgress(remote)
  },

  async getUnitDetail(unitId: string): Promise<UnitDetail | null> {
    // Unit content is read only from an installed package. In particular, do
    // not substitute unpublished server edits for a missing local package.
    return this.getCachedUnitDetail(unitId)
  },

  async getCachedUnitDetail(unitId: string): Promise<UnitDetail | null> {
    if (!await isPackInstalled(unitId)) return null
    const projected = await readUnitShell(unitId)
    if (projected) return projected
    const migrated = await ensurePackProjection(unitId)
    if (migrated) {
      const shell = await readUnitShell(unitId)
      if (shell) return shell
    }
    if (import.meta.env.DEV) console.warn('[offline] reading legacy aggregated unit row', unitId)
    const cached = await localDb.get<any>('downloaded_unit_details', unitId)
    return cached ? aggregateUnitContent(cached) : null
  },

  /** 已安装包优先本地播放；旧包缺章节 Ink 时才回退线上。 */
  async getStoryEpisodePlayer(packageId: string | null | undefined, episodeId: string): Promise<StoryEpisodePlayerData> {
    if (packageId && await isPackInstalled(packageId)) {
      const scene = await readUnitScene(packageId)
      const players = scene?.offlineStoryEpisodePlayers ?? []
      const localPlayer = players.find((item: StoryEpisodePlayerData) => item.episode.id === episodeId)
      if (localPlayer?.inkScript?.inkJson) return localPlayer
      const unit = await this.getCachedUnitDetail(packageId)
      const legacyPlayer = unit?.offlineStoryEpisodePlayers?.find((item) => item.episode.id === episodeId)
      if (legacyPlayer?.inkScript?.inkJson) return legacyPlayer
    }
    return learningApi.getStoryEpisodePlayer(episodeId)
  },

  async enrollUnit(unitId: string, unit?: LearningUnitSummary | UnitDetail | null): Promise<void> {
    const alreadyEnrolled = await localDb.get<MyUnit>('my_learning_units', unitId)
    if (!alreadyEnrolled && !(unit && isScriptLearningUnit(unit))) {
      const localUnits = await localDb.list<MyUnit>('my_learning_units').catch(() => [])
      const inProgressCount = localUnits.filter(isInProgressLearningUnit).length
      if (inProgressCount >= MAX_CONCURRENT_LEARNING_UNITS) {
        throw new ApiRequestError('server', 'LEARNING_UNIT_LIMIT_REACHED', {
          status: 409,
          apiCode: 'LEARNING_UNIT_LIMIT_REACHED',
        })
      }
    }

    if (unit) await localDb.put('my_learning_units', summaryToMyUnit(unit))
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'my_unit',
      entityId: unitId,
      operation: 'create',
      payload: { unitId },
    })

    try {
      await learningApi.startUnit(unitId)
      await syncOutbox.markSynced(outboxItem.id)
      const remote = await learningApi.getMyUnits()
      await localDb.clear('my_learning_units')
      await localDb.putMany('my_learning_units', remote)
    } catch (error) {
      // 4xx 表示服务端已明确拒绝本次加入（例如学习包数量上限），
      // 不能作为离线任务继续重试，更不能继续下载一个未加入学习计划的包。
      if (error instanceof ApiRequestError && error.status && error.status >= 400 && error.status < 500) {
        await localDb.delete('my_learning_units', unitId)
        await syncOutbox.markDiscarded(outboxItem.id)
        throw error
      }
      await syncOutbox.markFailed(outboxItem.id, error)
    }
  },

  /** Mark a downloaded document-only pack complete locally first, then sync it. */
  async completeUnit(unitId: string): Promise<void> {
    if (!await isPackInstalled(unitId)) throw new Error('请先下载学习包后再标记完成')
    const downloadedUnit = await this.getCachedUnitDetail(unitId)
    if (!downloadedUnit || hasTrackableTasksInDownloadedPack(downloadedUnit)) {
      throw new Error('该学习包包含可追踪任务，不能手动标记完成')
    }
    const teachingTopics = downloadedUnit.trainingTopics.filter((topic) =>
      Boolean((topic as { hasTeachingDocument?: boolean }).hasTeachingDocument)
      || (typeof topic.teachingMarkdown === 'string' && topic.teachingMarkdown.trim()))
    if (teachingTopics.length > 0) {
      const readingRecords = await localDb.list<LocalTeachingReadingProgress>('user_progress').catch(() => [])
      const progressByTopic = new Map(readingRecords
        .filter((record) => record.type === 'teaching_reading')
        .map((record) => [record.topicId, record.percentage]))
      if (teachingTopics.some((topic) => (progressByTopic.get(topic.id) ?? 0) <= 90)) {
        throw new Error('请先完成所有教学文档的阅读')
      }
    }
    const existing = await localDb.get<MyUnit>('my_learning_units', unitId)
    if (!existing) throw new Error('学习包不在当前学习计划中')
    // my_learning_units is deliberately only a server account projection.
    // Its completion kind must not override the just-validated local package.

    const completedAt = new Date().toISOString()
    await localDb.put('my_learning_units', {
      ...existing,
      status: 'completed',
      completedAt,
      completion: { kind: 'manual', completed: 1, total: 1, percent: 100 },
      completionPercent: 100,
      progress: { ...existing.progress, readiness: 100, mastery: 100 },
    })
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'my_unit',
      entityId: unitId,
      operation: 'complete',
      payload: { unitId, completedAt },
    })

    try {
      await learningApi.completeUnit(unitId)
      await syncOutbox.markSynced(outboxItem.id)
    } catch (error) {
      if (error instanceof ApiRequestError && error.status && error.status >= 400 && error.status < 500) {
        await localDb.put('my_learning_units', existing)
        await syncOutbox.markDiscarded(outboxItem.id)
        throw error
      }
      await syncOutbox.markFailed(outboxItem.id, error)
    }
  },

  /** Persist EPUB progress in SQLite and replay the latest snapshot after reconnecting. */
  async saveNovelProgress(unitId: string, data: { locator: Record<string, any>; percentage: number }): Promise<void> {
    const existing = await localDb.get<LocalNovelReadingProgress>('user_progress', `novel:${unitId}`)
    const percentage = Math.max(existing?.percentage ?? 0, Math.min(1, Math.max(0, data.percentage)))
    const record: LocalNovelReadingProgress = {
      id: `novel:${unitId}`,
      type: 'novel',
      sceneId: unitId,
      locator: data.locator,
      percentage,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    }
    await localDb.put('user_progress', record)
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'novel_progress',
      entityId: unitId,
      operation: 'update',
      payload: { locator: record.locator, percentage: record.percentage },
    })

    try {
      await learningApi.saveNovelProgress(unitId, { locator: record.locator, percentage: record.percentage })
      await localDb.put('user_progress', { ...record, syncStatus: 'synced' })
      await syncOutbox.markSynced(outboxItem.id)
    } catch (error) {
      await localDb.put('user_progress', { ...record, syncStatus: 'failed' })
      await syncOutbox.markFailed(outboxItem.id, error)
    }
  },

  /** Persist document-reading progress locally; completion is derived from the installed pack. */
  async saveTeachingReadingProgress(unitId: string, topicId: string, percentage: number): Promise<void> {
    const id = `teaching-reading:${unitId}:${topicId}`
    const existing = await localDb.get<LocalTeachingReadingProgress>('user_progress', id)
    await localDb.put('user_progress', {
      id,
      type: 'teaching_reading',
      sceneId: unitId,
      topicId,
      percentage: Math.max(existing?.percentage ?? 0, Math.min(100, Math.max(0, percentage))),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
    })
  },

  /** 清空某学习包在前端本地的练习/复习进度（重新学习时调用，与服务端 restart 对齐）。 */
  async clearPackPracticeProgress(packId: string) {
    const runs = await localDb.list<any>('daily_practice_runs')
    const removedRunIds = new Set(runs
      .filter((item) => Array.isArray(item.packIds) && item.packIds.includes(packId))
      .map((item) => item.id))
    await localDb.deleteByIndex('daily_practice_items', 'pack_id', packId)
    await localDb.deleteByIndex('daily_practice_attempts', 'pack_id', packId)
    await localDb.deleteWhere<any>('daily_practice_runs', (item) =>
      Array.isArray((item as any).packIds) && (item as any).packIds.includes(packId))
    // 删除指向已删 run 的日期/mode 指针，以及已退出包的当前练习包指针。
    // 否则 Today 页面会从这些指针恢复一个已经不存在的旧计划。
    await localDb.deleteWhere<any>('daily_practice_runs', (item) =>
      (typeof (item as any).runId === 'string' && removedRunIds.has((item as any).runId))
      || ((item as any).id === 'daily:active-pack' && (item as any).packId === packId))
    await localDb.delete('user_progress', `novel:${packId}`)
    const packProgress = await localDb.findByIndex<LocalTeachingReadingProgress>('user_progress', 'scene_id', packId)
    for (const record of packProgress) {
      if (record.type === 'teaching_reading') await localDb.delete('user_progress', record.id)
    }
    const pending = await syncOutbox.listPending()
    await Promise.all(pending
      .filter((item) => item.entityId === packId && (
        item.entityType === 'novel_progress' ||
        (item.entityType === 'my_unit' && item.operation === 'complete')
      ))
      .map((item) => syncOutbox.markDiscarded(item.id)))
  },

  async quitUnit(unitId: string): Promise<void> {
    await localDb.delete('my_learning_units', unitId)
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'my_unit',
      entityId: unitId,
      operation: 'delete',
      payload: { unitId, deletedAt: new Date().toISOString() },
    })

    try {
      await learningApi.quitUnit(unitId)
      await syncOutbox.markSynced(outboxItem.id)
    } catch (error) {
      await syncOutbox.markFailed(outboxItem.id, error)
    }
  },
}

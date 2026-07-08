import {
  learningApi,
  type LearningUnitSummary,
  type MyUnit,
  type UnitDetail,
} from '@/features/learning/api/learning-api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'

type LocalDailyPracticeProgress = {
  itemId: string
  packId: string
  bestScoreRank?: number | null
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

  for (const { topicId: fallbackTopicId, detail } of topicDetails) {
    if (!detail) continue
    const topicId = detail.topic?.id ?? fallbackTopicId

    trainingTopics.push({
      id: topicId,
      title: detail.topic?.title,
      promptEn: detail.topic?.promptEn,
      promptZh: detail.topic?.promptZh,
      difficulty: detail.topic?.difficulty,
      suggestedDurationSec: detail.topic?.suggestedDurationSec,
      metadata: detail.topic?.metadata,
      vocabularies: detail.vocabularies ?? [],
      activeChunks: (detail.activeChunks ?? []).map((c: any) => ({
        id: c.id,
        text: c.text,
        meaning: c.meaning,
      })),
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
  void cacheAggregated(unitDetail.id, aggregated)
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
    completionPercent: 'completionPercent' in unit ? unit.completionPercent : Math.round(progress.mastery),
  }
}

function countWarmupPracticeItems(unit: MyUnit): number {
  let count = 0
  for (const topic of unit.topics ?? []) {
    const pipeline = topic.metadata?.outputTraining?.enabled
      ? (topic.metadata.outputTraining.pipeline ?? [])
      : []
    for (const item of pipeline) {
      const type = item.type
      if (type === 'chunk_substitution' || type === 'pattern_drill') {
        count += Array.isArray(item.items) ? item.items.length : 0
      } else if (type === 'vocab_drill') {
        count += Array.isArray(item.vocabs) ? item.vocabs.length : 0
      } else if (type === 'vocab_sentence_building') {
        count += (Array.isArray(item.patterns) ? item.patterns : []).reduce(
          (sum: number, pattern: any) => sum + (Array.isArray(pattern?.items) ? pattern.items.length : 0),
          0,
        )
      } else if (type === 'sentence_decomposition') {
        count += 1
      }
    }
  }
  return count
}

async function mergeLocalPracticeProgress(units: MyUnit[]): Promise<MyUnit[]> {
  if (units.length === 0) return units

  const progresses = await localDb.list<LocalDailyPracticeProgress>('daily_practice_items').catch(() => [])
  if (progresses.length === 0) return units

  const completedByPack = new Map<string, Set<string>>()
  for (const progress of progresses) {
    if ((progress.bestScoreRank ?? 0) < 2) continue
    const itemIds = completedByPack.get(progress.packId) ?? new Set<string>()
    itemIds.add(progress.itemId)
    completedByPack.set(progress.packId, itemIds)
  }

  return units.map((unit) => {
    const localCompletedCount = completedByPack.get(unit.id)?.size ?? 0
    const remoteCompletedCount = unit.progress?.completedPracticeCount ?? 0
    if (localCompletedCount <= remoteCompletedCount) return unit

    const computedTotal = countWarmupPracticeItems(unit)
    const totalPracticeCount = unit.progress?.totalPracticeCount ?? computedTotal ?? unit.topicCount ?? 0
    const completedPracticeCount = totalPracticeCount > 0
      ? Math.min(localCompletedCount, totalPracticeCount)
      : localCompletedCount
    const completionPercent = totalPracticeCount > 0
      ? Math.round((completedPracticeCount / totalPracticeCount) * 100)
      : unit.completionPercent

    return {
      ...unit,
      progress: {
        ...unit.progress,
        completedPracticeCount,
        totalPracticeCount,
      },
      completionPercent: Math.max(unit.completionPercent ?? 0, completionPercent),
    }
  })
}

export const learningRepository = {
  async getMyUnits(): Promise<MyUnit[]> {
    const cached = await localDb.list<MyUnit>('my_learning_units')
    if (cached.length > 0) return mergeLocalPracticeProgress(cached)

    try {
      const remote = await learningApi.getMyUnits()
      await localDb.putMany('my_learning_units', remote)
      return mergeLocalPracticeProgress(remote)
    } catch {
      return mergeLocalPracticeProgress(await localDb.list<MyUnit>('my_learning_units'))
    }
  },

  async getCachedMyUnits(): Promise<MyUnit[]> {
    return localDb.list<MyUnit>('my_learning_units')
  },

  async refreshMyUnits(): Promise<MyUnit[]> {
    const remote = await learningApi.getMyUnits()
    const merged = await mergeLocalPracticeProgress(remote)
    await localDb.clear('my_learning_units')
    await localDb.putMany('my_learning_units', merged)
    return merged
  },

  async getUnitDetail(unitId: string): Promise<UnitDetail | null> {
    if (await isPackInstalled(unitId)) {
      const cached = await localDb.get<any>('downloaded_unit_details', unitId)
      if (cached) return aggregateUnitContent(cached)
    }

    try {
      const remote = await learningApi.getUnitDetail(unitId)
      await localDb.put('downloaded_unit_details', { ...remote, id: unitId })
      return remote
    } catch {
      const cached = await localDb.get<any>('downloaded_unit_details', unitId)
      return cached ? aggregateUnitContent(cached) : null
    }
  },

  async getCachedUnitDetail(unitId: string): Promise<UnitDetail | null> {
    if (!await isPackInstalled(unitId)) return null
    const cached = await localDb.get<any>('downloaded_unit_details', unitId)
    return cached ? aggregateUnitContent(cached) : null
  },

  async enrollUnit(unitId: string, unit?: LearningUnitSummary | UnitDetail | null): Promise<void> {
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
      await syncOutbox.markFailed(outboxItem.id, error)
    }
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

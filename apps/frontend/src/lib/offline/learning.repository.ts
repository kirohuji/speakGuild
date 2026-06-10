import {
  learningApi,
  type LearningUnitSummary,
  type MyUnit,
  type UnitDetail,
} from '@/features/learning/api/learning-api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'

async function isPackInstalled(unitId: string) {
  const pack = await localDb.get<{ status?: string }>('downloaded_packs', unitId)
  return pack?.status === 'installed'
}

/** Aggregate vocabs/chunks/patterns/trainingTopics from stored topic details into a unitDetail */
async function aggregateUnitContent(unitDetail: any): Promise<any> {
  if (unitDetail.vocabularies?.length && unitDetail.chunks?.length && unitDetail.trainingTopics?.length) {
    return unitDetail // already has aggregated data
  }

  // Get topic IDs from the pack manifest (or fall back to trainingTopics if still present)
  let topicIds: string[] = (unitDetail.trainingTopics ?? []).map((t: any) => t.id)
  if (topicIds.length === 0) {
    const pack = await localDb.get<{ manifest?: { topics?: string[] } }>('downloaded_packs', unitDetail.id)
    topicIds = pack?.manifest?.topics ?? []
  }

  const vocabMap = new Map<string, any>()
  const chunkMap = new Map<string, any>()
  const patternMap = new Map<string, any>()
  const trainingTopics: any[] = []

  for (const topicId of topicIds) {
    try {
      const cached = await localDb.get<{ detail: any }>('downloaded_unit_details', `topic:${topicId}`)
      const detail = cached?.detail
      if (!detail) continue

      // Extract trainingTopic card from topicDetail
      trainingTopics.push({
        id: detail.topic?.id ?? topicId,
        title: detail.topic?.title,
        promptEn: detail.topic?.promptEn,
        promptZh: detail.topic?.promptZh,
        difficulty: detail.topic?.difficulty,
        suggestedDurationSec: detail.topic?.suggestedDurationSec,
        activeChunks: (detail.activeChunks ?? []).slice(0, 3).map((c: any) => ({
          id: c.id,
          text: c.text,
          meaning: c.meaning,
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
    } catch { /* topic not cached yet, skip */ }
  }

  return {
    ...unitDetail,
    vocabularies: [...vocabMap.values()],
    chunks: [...chunkMap.values()],
    sentencePatterns: [...patternMap.values()],
    trainingTopics,
  }
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

export const learningRepository = {
  async getMyUnits(): Promise<MyUnit[]> {
    const cached = await localDb.list<MyUnit>('my_learning_units')
    if (cached.length > 0) return cached

    try {
      const remote = await learningApi.getMyUnits()
      await localDb.putMany('my_learning_units', remote)
      return remote
    } catch {
      return localDb.list<MyUnit>('my_learning_units')
    }
  },

  async refreshMyUnits(): Promise<MyUnit[]> {
    const remote = await learningApi.getMyUnits()
    await localDb.clear('my_learning_units')
    await localDb.putMany('my_learning_units', remote)
    return remote
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

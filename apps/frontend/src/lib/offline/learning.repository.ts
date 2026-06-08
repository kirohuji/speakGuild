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
      const cached = await localDb.get<UnitDetail>('downloaded_unit_details', unitId)
      if (cached) return cached
    }

    try {
      const remote = await learningApi.getUnitDetail(unitId)
      await localDb.put('downloaded_unit_details', { ...remote, id: unitId })
      return remote
    } catch {
      return localDb.get<UnitDetail>('downloaded_unit_details', unitId)
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

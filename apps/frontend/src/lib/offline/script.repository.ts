import {
  scriptCommunityApi,
  type ScriptPracticeMode,
  type ScriptPracticeRecord,
  type ScriptWork,
} from '@/features/scripts/api/script-community-api'
import { writeLocalStoryEpisodePassed } from '@/features/scripts/lib/story-chapter-progress'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'
import { createId } from './utils'

export const SCRIPT_PRACTICE_SYNCED_EVENT = 'manyu:script-practice-synced'
export const SCRIPT_PRACTICE_SYNC_FAILED_EVENT = 'manyu:script-practice-sync-failed'

export type ScriptPracticeSyncedEventDetail = {
  clientMutationId?: string
  localId?: string
  record: ScriptPracticeRecord
}

export type ScriptPracticeSyncFailedEventDetail = {
  clientMutationId: string
  error?: string
}

export type ScriptCompletePayload = {
  mode: ScriptPracticeMode
  durationSec?: number
  turnCount?: number
  lineCount?: number
  usedChunkCount?: number
  completedObjectiveCount?: number
  score?: number
  resultSnapshot?: Record<string, unknown>
  audioAssetId?: string
  recordingAssetIds?: string[]
  recordingBatchId?: string
  videoAssetId?: string
  clientMutationId?: string
}

export type ScriptCompleteDisplayHint = {
  episode: ScriptPracticeRecord['episode']
}

type ScriptPracticeCacheRow = {
  id: string
  remoteId?: string | null
  episodeId: string
  mode: ScriptPracticeMode
  status: ScriptPracticeRecord['status']
  syncStatus: 'pending' | 'synced' | 'failed'
  clientMutationId?: string
  createdAt: string
  record: ScriptPracticeRecord
  submitPayload?: { episodeId: string; data: ScriptCompletePayload }
  updatedAt: string
}

type ScriptWorkCacheRow = {
  id: string
  remoteId?: string | null
  episodeId: string
  recordId?: string | null
  kind: ScriptWork['kind']
  status: ScriptWork['status']
  syncStatus: 'synced'
  createdAt: string
  work: ScriptWork
  updatedAt: string
}

function localRecordId(clientMutationId: string) {
  return `local:${clientMutationId}`
}

function sortByCreatedDesc<T extends { createdAt: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt)
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id)
  })
}

async function putPracticeCacheRow(row: ScriptPracticeCacheRow): Promise<void> {
  await localDb.put('script_practice_records', row)
}

async function putWorkCacheRow(work: ScriptWork): Promise<void> {
  const row: ScriptWorkCacheRow = {
    id: work.id,
    remoteId: work.id,
    episodeId: work.episodeId,
    recordId: work.recordId,
    kind: work.kind,
    status: work.status,
    syncStatus: 'synced',
    createdAt: work.createdAt,
    work,
    updatedAt: new Date().toISOString(),
  }
  await localDb.put('script_works', row)
}

function emitPracticeSynced(detail: ScriptPracticeSyncedEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ScriptPracticeSyncedEventDetail>(SCRIPT_PRACTICE_SYNCED_EVENT, { detail }))
}

export function emitPracticeSyncFailed(detail: ScriptPracticeSyncFailedEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ScriptPracticeSyncFailedEventDetail>(SCRIPT_PRACTICE_SYNC_FAILED_EVENT, { detail }))
}

function buildOptimisticRecord(
  episodeId: string,
  data: ScriptCompletePayload,
  clientMutationId: string,
  displayHint?: ScriptCompleteDisplayHint,
): ScriptPracticeRecord {
  const now = new Date().toISOString()
  return {
    id: localRecordId(clientMutationId),
    episodeId,
    mode: data.mode,
    status: 'completed',
    durationSec: data.durationSec ?? 0,
    turnCount: data.turnCount ?? 0,
    lineCount: data.lineCount ?? 0,
    usedChunkCount: data.usedChunkCount ?? 0,
    completedObjectiveCount: data.completedObjectiveCount ?? 0,
    score: data.score ?? null,
    completedAt: now,
    createdAt: now,
    resultSnapshot: (data.resultSnapshot as ScriptPracticeRecord['resultSnapshot']) ?? null,
    episode: displayHint?.episode ?? {
      id: episodeId,
      title: '',
      chapterName: '',
      characterName: '',
      scene: { id: '', title: '' },
    },
    works: [],
  }
}

export const scriptRepository = {
  async listMyRecords(): Promise<ScriptPracticeRecord[]> {
    const rows = await localDb.list<ScriptPracticeCacheRow>('script_practice_records')
    if (rows.length === 0) {
      try {
        return await this.refreshMyRecords()
      } catch {
        return []
      }
    }
    return sortByCreatedDesc(rows.map((row) => row.record))
  },

  async refreshMyRecords(): Promise<ScriptPracticeRecord[]> {
    const allRecords: ScriptPracticeRecord[] = []
    let cursor: string | undefined
    do {
      const result = await scriptCommunityApi.myRecords({ limit: 50, cursor })
      allRecords.push(...result.list)
      cursor = result.nextCursor ?? undefined
    } while (cursor)

    const pendingRows = (await localDb.list<ScriptPracticeCacheRow>('script_practice_records'))
      .filter((row) => row.syncStatus === 'pending' || row.syncStatus === 'failed')

    await localDb.clear('script_practice_records')
    await localDb.putMany(
      'script_practice_records',
      allRecords.map((record) => ({
        id: record.id,
        remoteId: record.id,
        episodeId: record.episodeId,
        mode: record.mode,
        status: record.status,
        syncStatus: 'synced' as const,
        createdAt: record.createdAt,
        record,
        updatedAt: new Date().toISOString(),
      })),
    )
    for (const pending of pendingRows) {
      await putPracticeCacheRow(pending)
    }

    const merged = [
      ...pendingRows.map((row) => row.record),
      ...allRecords.filter((record) => !pendingRows.some((pending) => pending.remoteId === record.id
        || pending.clientMutationId && record.id === localRecordId(pending.clientMutationId))),
    ]
    return sortByCreatedDesc(merged)
  },

  async listMyWorks(): Promise<ScriptWork[]> {
    const rows = await localDb.list<ScriptWorkCacheRow>('script_works')
    if (rows.length === 0) {
      try {
        return await this.refreshMyWorks()
      } catch {
        return []
      }
    }
    return sortByCreatedDesc(rows.map((row) => row.work))
  },

  async refreshMyWorks(): Promise<ScriptWork[]> {
    const allWorks: ScriptWork[] = []
    let cursor: string | undefined
    do {
      const result = await scriptCommunityApi.myWorks({ limit: 50, cursor })
      allWorks.push(...result.list)
      cursor = result.nextCursor ?? undefined
    } while (cursor)

    await localDb.clear('script_works')
    await Promise.all(allWorks.map((work) => putWorkCacheRow(work)))
    return sortByCreatedDesc(allWorks)
  },

  async upsertWork(work: ScriptWork): Promise<void> {
    await putWorkCacheRow(work)
  },

  async completePractice(
    episodeId: string,
    data: ScriptCompletePayload,
    displayHint?: ScriptCompleteDisplayHint,
  ): Promise<{ record: ScriptPracticeRecord; pending: boolean; clientMutationId: string }> {
    const clientMutationId = data.clientMutationId?.trim() || createId()
    const payload: ScriptCompletePayload = { ...data, clientMutationId }
    const optimistic = buildOptimisticRecord(episodeId, payload, clientMutationId, displayHint)

    try {
      const remote = await scriptCommunityApi.completeRecord(episodeId, payload)
      const cachedRecord: ScriptPracticeRecord = {
        ...remote,
        episode: remote.episode ?? optimistic.episode,
        works: remote.works ?? [],
        resultSnapshot: remote.resultSnapshot ?? optimistic.resultSnapshot,
      }
      const localId = localRecordId(clientMutationId)
      if (localId !== cachedRecord.id) {
        await localDb.delete('script_practice_records', localId).catch(() => undefined)
      }
      await putPracticeCacheRow({
        id: cachedRecord.id,
        remoteId: cachedRecord.id,
        episodeId: cachedRecord.episodeId,
        mode: cachedRecord.mode,
        status: cachedRecord.status,
        syncStatus: 'synced',
        clientMutationId,
        createdAt: cachedRecord.createdAt,
        record: cachedRecord,
        updatedAt: new Date().toISOString(),
      })
      writeLocalStoryEpisodePassed(episodeId)
      emitPracticeSynced({ clientMutationId, localId, record: cachedRecord })
      return { record: cachedRecord, pending: false, clientMutationId }
    } catch {
      await putPracticeCacheRow({
        id: optimistic.id,
        remoteId: null,
        episodeId,
        mode: payload.mode,
        status: 'completed',
        syncStatus: 'pending',
        clientMutationId,
        createdAt: optimistic.createdAt,
        record: optimistic,
        submitPayload: { episodeId, data: payload },
        updatedAt: new Date().toISOString(),
      })
      await syncOutbox.enqueue({
        entityType: 'script_practice_record',
        entityId: clientMutationId,
        operation: 'create',
        payload: { episodeId, data: payload, localId: optimistic.id },
      })
      writeLocalStoryEpisodePassed(episodeId)
      return { record: optimistic, pending: true, clientMutationId }
    }
  },

  async applySyncedPracticeRecord(input: {
    localId?: string
    clientMutationId?: string
    record: ScriptPracticeRecord
  }): Promise<void> {
    if (input.localId) {
      await localDb.delete('script_practice_records', input.localId).catch(() => undefined)
    }
    await putPracticeCacheRow({
      id: input.record.id,
      remoteId: input.record.id,
      episodeId: input.record.episodeId,
      mode: input.record.mode,
      status: input.record.status,
      syncStatus: 'synced',
      clientMutationId: input.clientMutationId,
      createdAt: input.record.createdAt,
      record: input.record,
      updatedAt: new Date().toISOString(),
    })
    writeLocalStoryEpisodePassed(input.record.episodeId)
    emitPracticeSynced({
      clientMutationId: input.clientMutationId,
      localId: input.localId,
      record: input.record,
    })
  },
}

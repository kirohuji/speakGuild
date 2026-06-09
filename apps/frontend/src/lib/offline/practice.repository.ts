import {
  practiceApi,
  practiceAiApi,
  type PracticeSession,
  type TopicDetail,
} from '@/features/practice/api/english-practice-api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'

export type PracticeTurnPayload = {
  round?: number
  npcText: string
  userText: string
  userAudioUrl?: string
  inputNodeId?: string
  tags?: string[]
  judgement?: any
  objectivesCompleted?: string[]
  chunksUsed?: string[]
}

function createLocalId(prefix: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${id}`
}

function sessionRecordId(sessionId: string) {
  return `session:${sessionId}`
}

function turnRecordId(sessionId: string, round?: number) {
  return `turn:${sessionId}:${round ?? createLocalId('round')}`
}

function toIsoString(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return null
}

async function resolveSessionId(sessionId: string): Promise<string> {
  if (!sessionId.startsWith('local_session_')) return sessionId
  const mapped = await localDb.get<{ value: string }>('kv', `session-map:${sessionId}`)
  return mapped?.value ?? sessionId
}

async function getCachedTopicDetail(topicId: string): Promise<TopicDetail | null> {
  const cached = await localDb.get<{ detail: TopicDetail; unitId?: string }>('downloaded_unit_details', `topic:${topicId}`)
  if (!cached?.detail) return null
  if (!cached.unitId) return cached.detail
  const pack = await localDb.get<{ status?: string }>('downloaded_packs', cached.unitId)
  return pack?.status === 'installed' ? cached.detail : null
}

export const practiceRepository = {
  async getTopicDetail(topicId: string): Promise<TopicDetail | null> {
    const localFirst = await getCachedTopicDetail(topicId)
    if (localFirst) return localFirst

    try {
      const detail = await practiceApi.getTopicDetail(topicId)
      await localDb.put('downloaded_unit_details', {
        id: `topic:${topicId}`,
        topicId,
        detail,
        updatedAt: new Date().toISOString(),
      })
      if (detail.inkScript) {
        await localDb.put('ink_scripts', {
          id: detail.inkScript.id,
          topicId,
          ...detail.inkScript,
          updatedAt: new Date().toISOString(),
        })
      }
      return detail
    } catch {
      return getCachedTopicDetail(topicId)
    }
  },

  async getTopicInk(topicId: string) {
    const localScripts = await localDb.findByIndex<any>('ink_scripts', 'topic_id', topicId)
    const localScript = localScripts[0]
    if (localScript) {
      const pack = localScript.unitId ? await localDb.get<{ status?: string }>('downloaded_packs', localScript.unitId) : null
      if (!localScript.unitId || pack?.status === 'installed') return localScript
    }

    try {
      const ink = await practiceApi.getTopicInk(topicId)
      if (ink) {
        await localDb.put('ink_scripts', {
          id: ink.id,
          topicId,
          ...ink,
          updatedAt: new Date().toISOString(),
        })
      }
      return ink
    } catch {
      return localScript ?? null
    }
  },

  async createSession(topicId: string): Promise<{ id: string }> {
    const localSessionId = createLocalId('local_session')
    const now = new Date().toISOString()
    try {
      const remote = await practiceApi.createSession(topicId)
      await localDb.put('kv', { id: `session-map:${localSessionId}`, value: remote.id, updatedAt: new Date().toISOString() })
      await localDb.put('practice_records', {
        id: sessionRecordId(remote.id),
        type: 'session',
        remoteId: remote.id,
        sessionId: remote.id,
        localSessionId,
        topicId: remote.topicId ?? topicId,
        sceneId: remote.sceneId,
        inkScriptId: remote.inkScriptId,
        status: remote.status ?? 'active',
        turnCount: remote.turnCount ?? 0,
        turns: [],
        startedAt: toIsoString(remote.startedAt) ?? now,
        completedAt: toIsoString(remote.completedAt),
        analyzedAt: toIsoString(remote.analyzedAt),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      })
      return remote
    } catch {
      await syncOutbox.enqueue({
        entityType: 'practice_session',
        entityId: localSessionId,
        operation: 'create',
        payload: { topicId, localSessionId },
      })
      await localDb.put('practice_records', {
        id: sessionRecordId(localSessionId),
        sessionId: localSessionId,
        localSessionId,
        topicId,
        status: 'active',
        turns: [],
        startedAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      })
      return { id: localSessionId }
    }
  },

  async submitTurn(sessionId: string, data: PracticeTurnPayload): Promise<void> {
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'practice_turn',
      entityId: turnRecordId(sessionId, data.round),
      operation: 'create',
      payload: { sessionId, data },
    })

    try {
      const remoteSessionId = await resolveSessionId(sessionId)
      await practiceApi.submitTurn(remoteSessionId, data)
      await syncOutbox.markSynced(outboxItem.id)

      const recordId = sessionRecordId(remoteSessionId)
      const existing = await localDb.get<any>('practice_records', recordId)
      if (existing) {
        await localDb.put('practice_records', {
          ...existing,
          turnCount: (existing.turnCount ?? 0) + 1,
          updatedAt: new Date().toISOString(),
          syncStatus: 'synced',
        })
      }
    } catch {
      // The outbox keeps the turn for later replay.
    }
  },

  async completeSession(sessionId: string): Promise<PracticeSession | null> {
    const now = new Date().toISOString()
    await localDb.put('user_progress', {
      id: `practice-session:${sessionId}`,
      sessionId,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    })
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'practice_session',
      entityId: sessionId,
      operation: 'update',
      payload: { sessionId, status: 'completed', completedAt: now },
    })

    try {
      const result = await practiceApi.completeSession(await resolveSessionId(sessionId))
      await syncOutbox.markSynced(outboxItem.id)
      await localDb.put('practice_records', {
        id: sessionRecordId(result.id),
        type: 'session',
        remoteId: result.id,
        sessionId: result.id,
        topicId: result.topicId,
        sceneId: result.sceneId,
        inkScriptId: result.inkScriptId,
        status: result.status,
        turnCount: result.turnCount ?? 0,
        analysisResult: result.analysisResult,
        analysisRaw: result.analysisRaw,
        analysisError: result.analysisError,
        startedAt: toIsoString(result.startedAt),
        completedAt: toIsoString(result.completedAt) ?? now,
        analyzedAt: toIsoString(result.analyzedAt),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      })
      await localDb.put('user_progress', {
        id: `practice-session:${sessionId}`,
        sessionId,
        status: 'completed',
        completedAt: now,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      })
      return result
    } catch {
      return null
    }
  },

  async analyzeSession(sessionId: string) {
    return practiceAiApi.analyzeSession(sessionId)
  },
}

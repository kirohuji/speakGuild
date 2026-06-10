import {
  practiceApi,
  practiceAiApi,
  type PracticeSession,
  type TopicDetail,
} from '@/features/practice/api/english-practice-api'
import { getPracticeRecords, type PracticeRecord, type PracticeRecordsResult } from '@/features/profile/api'
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

const PRACTICE_RECORDS_CACHE_KEY = 'practice-records-cache:loaded'

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

function hasFinalAnalysis(session: Partial<PracticeSession> | null | undefined): boolean {
  return session?.status === 'analyzed' && Boolean(session.analysisResult)
}

function practiceRecordFromSession(session: PracticeSession): PracticeRecord {
  const analysis = session.analysisResult ?? {}
  return {
    recordId: session.id,
    sessionId: session.id,
    topicId: session.topicId,
    topicName: session.sceneSnapshot?.title || '英语输出训练',
    questionId: session.topicId,
    questionText: session.topicSnapshot?.title || '练习题目',
    practiceCount: session.turnCount ?? session.turns?.length ?? 0,
    lastPracticeAt: toIsoString(session.startedAt) ?? new Date().toISOString(),
    status: session.status,
    score: typeof analysis.overallScore === 'number' ? analysis.overallScore : null,
    summary: typeof analysis.summary === 'string' ? analysis.summary : null,
    completedAt: toIsoString(session.completedAt),
    analyzedAt: toIsoString(session.analyzedAt),
  }
}

function normalizePracticeRecord(record: PracticeRecord): PracticeRecord {
  return {
    ...record,
    recordId: record.recordId || record.sessionId || record.topicId,
    questionId: record.questionId || record.topicId,
    practiceCount: record.practiceCount ?? 0,
    lastPracticeAt: record.lastPracticeAt || record.analyzedAt || record.completedAt || new Date().toISOString(),
    status: record.status ?? 'analyzed',
  }
}

async function putPracticeHistoryRecord(input: {
  record: PracticeRecord
  session?: PracticeSession | null
  syncStatus?: 'pending' | 'synced'
}): Promise<void> {
  const record = normalizePracticeRecord(input.record)
  const session = input.session ?? null
  await localDb.put('practice_records', {
    id: sessionRecordId(record.sessionId ?? record.recordId),
    type: 'history',
    remoteId: record.sessionId ?? record.recordId,
    sessionId: record.sessionId ?? record.recordId,
    topicId: record.topicId,
    sceneId: session?.sceneId,
    status: record.status ?? session?.status ?? 'analyzed',
    record,
    session: session ? {
      id: session.id,
      topicId: session.topicId,
      sceneId: session.sceneId,
      inkScriptId: session.inkScriptId,
      status: session.status,
      turnCount: session.turnCount,
      topicSnapshot: session.topicSnapshot,
      sceneSnapshot: session.sceneSnapshot,
      analysisResult: session.analysisResult,
      analysisRaw: session.analysisRaw,
      analysisError: session.analysisError,
      startedAt: toIsoString(session.startedAt),
      completedAt: toIsoString(session.completedAt),
      analyzedAt: toIsoString(session.analyzedAt),
      turns: session.turns ?? [],
    } : undefined,
    updatedAt: new Date().toISOString(),
    syncStatus: input.syncStatus ?? 'synced',
  })
}

async function markPracticeRecordsCacheLoaded(): Promise<void> {
  await localDb.put('kv', {
    id: PRACTICE_RECORDS_CACHE_KEY,
    value: true,
    updatedAt: new Date().toISOString(),
  })
}

async function isPracticeRecordsCacheLoaded(): Promise<boolean> {
  const marker = await localDb.get<{ value?: boolean }>('kv', PRACTICE_RECORDS_CACHE_KEY)
  return marker?.value === true
}

async function listCachedPracticeHistory(): Promise<PracticeRecord[]> {
  const entries = await localDb.list<any>('practice_records')
  return entries
    .filter((item) => item?.type === 'history' && item?.record?.status === 'analyzed')
    .map((item) => normalizePracticeRecord(item.record))
    .sort((a, b) => String(b.analyzedAt ?? b.lastPracticeAt).localeCompare(String(a.analyzedAt ?? a.lastPracticeAt)))
}

function paginatePracticeRecords(items: PracticeRecord[], page: number, pageSize: number): PracticeRecordsResult {
  const start = (page - 1) * pageSize
  return {
    list: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  }
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
    try {
      const remote = await practiceApi.createSession(topicId)
      await localDb.put('kv', { id: `session-map:${localSessionId}`, value: remote.id, updatedAt: new Date().toISOString() })
      return remote
    } catch {
      await syncOutbox.enqueue({
        entityType: 'practice_session',
        entityId: localSessionId,
        operation: 'create',
        payload: { topicId, localSessionId },
      })
      return { id: localSessionId }
    }
  },

  async submitTurn(sessionId: string, data: PracticeTurnPayload): Promise<void> {
    console.log(`[repo.submitTurn] 入队 | sessionId=${sessionId} | round=${data.round} | userText="${data.userText?.slice(0, 40)}..."`)
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'practice_turn',
      entityId: turnRecordId(sessionId, data.round),
      operation: 'create',
      payload: { sessionId, data },
    })

    try {
      const remoteSessionId = await resolveSessionId(sessionId)
      console.log(`[repo.submitTurn] HTTP发起 | remoteSessionId=${remoteSessionId} | round=${data.round}`)
      await practiceApi.submitTurn(remoteSessionId, data)
      console.log(`[repo.submitTurn] ✅ HTTP成功 | round=${data.round}`)
      await syncOutbox.markSynced(outboxItem.id)
    } catch (err) {
      console.error(`[repo.submitTurn] ❌ HTTP失败 | round=${data.round}:`, err)
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
    const remoteSessionId = await resolveSessionId(sessionId)
    console.log(`[repo.analyzeSession] 请求后端分析 | sessionId=${sessionId} | remoteId=${remoteSessionId}`)
    const result = await practiceAiApi.analyzeSession(remoteSessionId)
    console.log(`[repo.analyzeSession] 后端分析返回 | hasAnalysis=${!!result?.analysis}`)
    try {
      const session = await practiceApi.getSession(remoteSessionId)
      console.log(`[repo.analyzeSession] 获取session详情 | turnCount=${session?.turnCount} | turns数组长度=${session?.turns?.length} | status=${session?.status}`)
      if (hasFinalAnalysis(session)) {
        await putPracticeHistoryRecord({
          record: practiceRecordFromSession(session),
          session,
          syncStatus: 'synced',
        })
        await markPracticeRecordsCacheLoaded()
      }
    } catch (err) {
      console.error(`[repo.analyzeSession] ⚠️ 缓存session失败:`, err)
      // Analysis still succeeded; history cache can be refreshed later.
    }
    return result
  },

  async listPracticeRecords(params: { page?: number; pageSize?: number } = {}): Promise<PracticeRecordsResult> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const cached = await listCachedPracticeHistory()
    const cacheLoaded = await isPracticeRecordsCacheLoaded()
    if (cached.length > 0 || cacheLoaded) {
      return paginatePracticeRecords(cached, page, pageSize)
    }
    return this.refreshPracticeRecords({ page, pageSize })
  },

  async refreshPracticeRecords(params: { page?: number; pageSize?: number } = {}): Promise<PracticeRecordsResult> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const remote = await getPracticeRecords({ page, pageSize })
    await Promise.all(
      remote.list
        .filter((record) => record.status === 'analyzed')
        .map((record) => putPracticeHistoryRecord({ record, syncStatus: 'synced' })),
    )
    await markPracticeRecordsCacheLoaded()
    return remote
  },

  async getCachedPracticeSession(sessionId: string): Promise<PracticeSession | null> {
    const record = await localDb.get<any>('practice_records', sessionRecordId(sessionId))
    return record?.type === 'history' && record.session?.analysisResult ? record.session as PracticeSession : null
  },

  async getPracticeSessionForReview(sessionId: string): Promise<PracticeSession | null> {
    const cached = await this.getCachedPracticeSession(sessionId)
    if (cached) return cached

    try {
      const session = await practiceApi.getSession(sessionId)
      if (hasFinalAnalysis(session)) {
        await putPracticeHistoryRecord({
          record: practiceRecordFromSession(session),
          session,
          syncStatus: 'synced',
        })
      }
      return session
    } catch {
      return null
    }
  },

  async clearPracticeRecordsCache(): Promise<void> {
    await localDb.clear('practice_records')
    await localDb.delete('kv', PRACTICE_RECORDS_CACHE_KEY)
  },
}

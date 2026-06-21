import {
  practiceApi,
  practiceAiApi,
  warmupRecordApi,
  type PracticeSession,
  type TopicDetail,
} from '@/features/practice/api/english-practice-api'
import { getPracticeRecords, type PracticeRecord, type PracticeRecordsResult } from '@/features/profile/api'
import { localDb } from './unified-storage'
import { syncOutbox } from './sync-outbox'
import type { WarmupRecordEntry } from '@/stores/warmup-session.store'

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
  isRetry?: boolean
  parentTurnId?: string
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

/**
 * Get cached topic detail. If the cached data is from the old format (no scene/vocabs),
 * merges shared data from the unit-level record for backward compatibility.
 */
async function getCachedTopicDetail(topicId: string): Promise<TopicDetail | null> {
  const cached = await localDb.get<{ detail: any; unitId?: string }>('downloaded_unit_details', `topic:${topicId}`)
  console.log('[practiceRepo] 🗄️ getCachedTopicDetail | topicId=', topicId, '| found=', !!cached?.detail)
  if (!cached?.detail) return null

  // Check pack installed status
  if (cached.unitId) {
    const pack = await localDb.get<{ status?: string }>('downloaded_packs', cached.unitId)
    if (pack?.status !== 'installed') return null
  }

  let detail = cached.detail

  // Backward compat: if old-format cache (missing scene), merge from unit record
  const needsMerge = !detail.scene?.characters?.length
  if (needsMerge && cached.unitId) {
    console.log('[practiceRepo] ⚠️ 旧格式缓存，从unit记录合并scene')
    const unitRecord = await localDb.get<any>('downloaded_unit_details', cached.unitId)
    if (unitRecord?.scene) {
      detail = { ...detail, scene: unitRecord.scene }
    }
  }

  if (detail.scene) {
    console.log('[practiceRepo]   scene.title=', detail.scene.title, '| characters.length=', detail.scene.characters?.length ?? 0)
    detail.scene.characters?.forEach((c: any, i: number) => {
      console.log(`[practiceRepo]   Char[${i}]: name=${c.name} avatarUrl=${c.avatarUrl || '(none)'} spriteBaseUrl=${c.spriteBaseUrl || '(none)'}`)
    })
  }

  return detail as TopicDetail
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

  // ── Warmup Records (今日任务练习记录) ──

  /**
   * 保存今日任务的热身练习记录到本地 SQLite，并尝试同步到后端。
   * 采用 offline-first：先写本地，后异步同步。
   */
  async submitWarmupRecords(topicId: string, topicTitle: string, items: WarmupRecordEntry[]) {
    const recordId = `warmup:${Date.now()}:${topicId}`
    const now = new Date().toISOString()

    // 1. 本地持久化
    await localDb.put('warmup_records', {
      id: recordId,
      topicId,
      topicTitle,
      items,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    })

    // 2. 后台同步到后端
    try {
      await warmupRecordApi.save(topicId, items)
      await warmupRecordApi.assess(topicId, topicTitle, items)
      await localDb.put('warmup_records', {
        id: recordId,
        topicId,
        topicTitle,
        items,
        createdAt: now,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      })
    } catch (err) {
      console.warn('[practiceRepo] Warmup sync failed, will retry later:', err)
      // Outbox retry via sync-outbox
      await syncOutbox.enqueue({
        entityType: 'warmup_records',
        entityId: recordId,
        operation: 'create',
        payload: { topicId, topicTitle, items, createdAt: now },
      })
    }

    // 3. 标记今日活动
    await this.markTodayActivity(items.length)

    return { id: recordId, synced: false }
  },

  /** 标记今日练习活跃（用于打卡统计） */
  async markTodayActivity(count: number = 1, date?: string): Promise<void> {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : new Date().toISOString().slice(0, 10)
    const id = `daily:${day}`
    const existing = await localDb.get<{ count: number }>('daily_activity', id)
    await localDb.put('daily_activity', {
      id,
      date: day,
      count: (existing?.count ?? 0) + count,
      updatedAt: new Date().toISOString(),
    })
    void import('@/lib/native/learning-reminder')
      .then(({ cancelTodayLearningReminder, rescheduleLearningReminder }) =>
        cancelTodayLearningReminder().then(() => rescheduleLearningReminder()),
      )
      .catch(() => undefined)
  },

  /** 获取本地已缓存的热身记录 */
  async getCachedWarmupRecords(topicId?: string): Promise<any[]> {
    const all = await localDb.list<any>('warmup_records')
    let filtered = all.filter((r) => r?.items?.length)
    if (topicId) filtered = filtered.filter((r) => r.topicId === topicId)
    return filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  },

  // ── Daily Progress (每日进度持久化) ──

  /** 获取今日练习进度（已完成步骤 ID 集合） */
  async getTodayProgress(): Promise<{ date: string; packId: string | null; doneIds: string[] } | null> {
    const today = new Date().toISOString().slice(0, 10)
    const record = await localDb.get<any>('daily_progress', `daily:${today}`)
    if (!record || record.date !== today) return null
    // doneIds 可能以 JSON 字符串形式存储
    let doneIds: string[] = []
    if (Array.isArray(record.doneIds)) {
      doneIds = record.doneIds
    } else if (typeof record.doneIds === 'string') {
      try { doneIds = JSON.parse(record.doneIds) } catch { doneIds = [] }
    }
    return { date: record.date, packId: record.packId || null, doneIds }
  },

  /** 保存今日练习进度 */
  async saveTodayProgress(packId: string | null, doneIds: string[]): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    await localDb.put('daily_progress', {
      id: `daily:${today}`,
      date: today,
      packId,
      doneIds: JSON.stringify(doneIds),
      updatedAt: new Date().toISOString(),
    })
  },

  /** 获取今日是否已完成打卡 */
  async isTodayCheckedIn(): Promise<boolean> {
    const progress = await this.getTodayProgress()
    return progress !== null && progress.doneIds.length > 0
  },
}

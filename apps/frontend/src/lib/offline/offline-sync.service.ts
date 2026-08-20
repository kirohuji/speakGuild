import { learningApi } from '@/features/learning/api/learning-api'
import { practiceApi, expressionApi, dailyPracticeApi } from '@/features/practice/api/english-practice-api'
import { toast } from 'sonner'
import { syncApi } from './sync-api'
import { localDb } from './unified-storage'
import { syncOutbox, type SyncOutboxItem } from './sync-outbox'
import { learningContentRepository } from './learning-content.repository'
import { learningPackService } from './learning-pack.service'
import { useOfflineSyncStore } from '@/stores/offline-sync.store'
import { upsertWarmupRecordEntries } from './warmup-record-index'
import { pullRemoteDailyProgress, restoreRemoteDailyPracticeRun } from './daily-practice.repository'
import { toIsoString, errorMessage, resolveSessionId } from './utils'
import { createLogger } from './logger'

const logger = createLogger('offline-sync')

const USER_SYNC_CURSOR_KEY = 'sync:user:cursor'

export interface OfflineSyncResult {
  push: { synced: number; failed: number; skipped: number; operations?: Record<string, number> }
  pull: { cursor: string | null; changed: number; deleted: number } | null
  refreshedPacks: string[]
}

// All callers must share one real sync promise. In particular, logout must wait
// for an already-running foreground sync instead of treating it as a no-op.
let activeSyncPromise: Promise<OfflineSyncResult> | null = null

function userSyncCursorKey(userId?: string | null) {
  return userId ? `sync:user:${userId}:cursor` : USER_SYNC_CURSOR_KEY
}

function isPermanentSyncError(error: unknown): boolean {
  const message = errorMessage(error)
  const status = (error as any)?.response?.status
  return status === 404 || [
    '练习话题不存在',
    '话题不存在',
    '练习会话不存在',
    'Topic not found',
    'Session not found',
    'Not Found',
  ].some((marker) => message.includes(marker))
}

async function discardSessionDependents(sessionId: string): Promise<void> {
  const items = await localDb.list<SyncOutboxItem>('outbox')
  await Promise.all(items.map(async (item) => {
    const payload = item.payload as any
    const referencesSession =
      item.entityId === sessionId ||
      payload?.sessionId === sessionId ||
      payload?.data?.sessionId === sessionId
    if (referencesSession) {
      await syncOutbox.markDiscarded(item.id)
    }
  }))
}

async function applyExpressionItem(item: any): Promise<void> {
  await learningContentRepository.saveRemoteExpressionEntry(item)
}

async function cacheExpressionItem(
  expressionCache: { items: any[] } | undefined,
  item: any,
): Promise<void> {
  if (!item) return
  await applyExpressionItem(item)
  if (!expressionCache?.items) return
  const index = expressionCache.items.findIndex((expr: any) => expr.id === item.id)
  if (index >= 0) {
    expressionCache.items[index] = item
  } else {
    expressionCache.items.push(item)
  }
}

async function deleteExpressionItem(remoteId: string): Promise<void> {
  await learningContentRepository.deleteExpressionByRemoteId(remoteId)
}

async function applyPracticeSessionItem(item: any, localSessionId?: string | null): Promise<void> {
  if (!item?.id) return
  if (localSessionId && localSessionId !== item.id) {
    await localDb.delete('practice_records', `session:${localSessionId}`)
  }
  if (item.status !== 'analyzed' || !item.analysisResult) return

  const fullSession = await practiceApi.getSession(item.id).catch(() => null)
  if (!fullSession?.analysisResult || fullSession.status !== 'analyzed') return

  const analysis = fullSession.analysisResult as any
  const topicSnapshot = fullSession.topicSnapshot as any
  const sceneSnapshot = fullSession.sceneSnapshot as any
  await localDb.put('practice_records', {
    id: `session:${fullSession.id}`,
    type: 'history',
    remoteId: fullSession.id,
    sessionId: fullSession.id,
    localSessionId: localSessionId ?? undefined,
    topicId: fullSession.topicId,
    sceneId: fullSession.sceneId,
    status: fullSession.status,
    record: {
      recordId: fullSession.id,
      sessionId: fullSession.id,
      topicId: fullSession.topicId,
      topicName: sceneSnapshot?.title || '英语输出训练',
      questionId: fullSession.topicId,
      questionText: topicSnapshot?.title || '练习题目',
      practiceCount: fullSession.turnCount ?? fullSession.turns?.length ?? 0,
      lastPracticeAt: toIsoString(fullSession.startedAt) ?? new Date().toISOString(),
      status: fullSession.status,
      score: typeof analysis?.overallScore === 'number' ? analysis.overallScore : null,
      summary: typeof analysis?.summary === 'string' ? analysis.summary : null,
      completedAt: toIsoString(fullSession.completedAt),
      analyzedAt: toIsoString(fullSession.analyzedAt),
    },
    session: {
      id: fullSession.id,
      topicId: fullSession.topicId,
      sceneId: fullSession.sceneId,
      inkScriptId: fullSession.inkScriptId,
      status: fullSession.status,
      turnCount: fullSession.turnCount ?? 0,
      topicSnapshot: fullSession.topicSnapshot,
      sceneSnapshot: fullSession.sceneSnapshot,
      analysisResult: fullSession.analysisResult,
      analysisRaw: fullSession.analysisRaw,
      analysisError: fullSession.analysisError,
      startedAt: toIsoString(fullSession.startedAt),
      completedAt: toIsoString(fullSession.completedAt),
      analyzedAt: toIsoString(fullSession.analyzedAt),
      turns: fullSession.turns ?? [],
    },
    updatedAt: new Date().toISOString(),
    syncStatus: 'synced',
  })
}

async function applyWarmupRecordItem(item: any): Promise<void> {
  if (!item?.id || !Array.isArray(item.items) || item.items.length === 0) return
  const record = {
    id: `remote-warmup:${item.id}`,
    remoteId: item.id,
    topicId: item.topicId,
    topicTitle: item.topicTitle ?? '',
    score: item.score ?? null,
    feedback: item.feedback ?? null,
    items: item.items,
    createdAt: toIsoString(item.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(item.createdAt) ?? new Date().toISOString(),
    syncStatus: 'synced',
  }
  await localDb.put('warmup_records', record)
  await upsertWarmupRecordEntries(record)
}

async function applyUserPullChanges(changed: any, deleted: any): Promise<void> {
  for (const item of changed?.expressionItems ?? []) {
    await applyExpressionItem(item)
  }

  for (const item of changed?.sceneProgresses ?? []) {
    if (!item.sceneId) continue
    await localDb.put('user_progress', {
      id: `scene:${item.sceneId}`,
      type: 'scene',
      remoteId: item.id,
      sceneId: item.sceneId,
      readiness: item.readiness ?? 0,
      mastery: item.mastery ?? 0,
      vocabLearned: item.vocabLearned ?? 0,
      vocabTotal: item.vocabTotal ?? 0,
      chunkMastered: item.chunkMastered ?? 0,
      chunkTotal: item.chunkTotal ?? 0,
      completedPracticeCount: item.completedPracticeCount ?? 0,
      completedScriptCount: item.completedScriptCount ?? 0,
      prerequisiteCompleted: item.prerequisiteCompleted ?? false,
      updatedAt: toIsoString(item.updatedAt) ?? new Date().toISOString(),
      syncStatus: 'synced',
    })
  }

  for (const item of changed?.chunkProgresses ?? []) {
    if (!item.chunkId) continue
    await localDb.put('user_progress', {
      id: `chunk:${item.chunkId}`,
      type: 'chunk',
      remoteId: item.id,
      chunkId: item.chunkId,
      status: item.status ?? 'not_learned',
      seenCount: item.seenCount ?? 0,
      spokenCount: item.spokenCount ?? 0,
      correctUseCount: item.correctUseCount ?? 0,
      usedSceneIds: item.usedSceneIds ?? [],
      lastPracticedAt: toIsoString(item.lastPracticedAt),
      updatedAt: toIsoString(item.updatedAt) ?? new Date().toISOString(),
      syncStatus: 'synced',
    })
  }

  for (const item of changed?.practiceSessions ?? []) {
    await applyPracticeSessionItem(item)
  }

  for (const item of changed?.practiceWarmupRecords ?? []) {
    await applyWarmupRecordItem(item)
  }

  for (const item of changed?.dailyPracticeRuns ?? []) {
    await restoreRemoteDailyPracticeRun(item)
  }

  for (const session of changed?.topicSessions ?? []) {
    if (!session?.id) continue
    await localDb.put('topic_sessions', {
      id: `session:${session.id}`,
      remoteId: session.id,
      topicId: session.topicId,
      sceneId: session.sceneId,
      status: session.status,
      analysisResult: session.analysisResult,
      startedAt: toIsoString(session.startedAt),
      completedAt: toIsoString(session.completedAt),
      analyzedAt: toIsoString(session.analyzedAt),
      submissions: session.submissions ?? [],
      updatedAt: toIsoString(session.updatedAt) ?? new Date().toISOString(),
      syncStatus: 'synced',
    })
    for (const sub of session.submissions ?? []) {
      if (!sub?.id) continue
      await localDb.put('topic_submissions', {
        id: `sub:${sub.id}`,
        remoteId: sub.id,
        sessionId: session.id,
        revision: sub.revision,
        status: sub.status,
        response: sub.response,
        syncStatus: 'synced',
      })
    }
  }

  for (const id of deleted?.expressionItems ?? []) {
    await deleteExpressionItem(id)
  }

  // 批量删除 user_progress：一次 scan 替代逐条 list()
  const deletedSceneIds = new Set<string>((deleted?.sceneProgresses ?? []).map(String))
  const deletedChunkIds = new Set<string>((deleted?.chunkProgresses ?? []).map(String))
  if (deletedSceneIds.size > 0 || deletedChunkIds.size > 0) {
    for (const id of deletedSceneIds) {
      const matches = await localDb.findByIndex<any>('user_progress', 'remote_id', id)
      const fallback = await localDb.get<any>('user_progress', id)
      for (const item of fallback ? [...matches, fallback] : matches) {
        await localDb.delete('user_progress', item.id)
      }
    }
    for (const id of deletedChunkIds) {
      const matches = await localDb.findByIndex<any>('user_progress', 'remote_id', id)
      const fallback = await localDb.get<any>('user_progress', id)
      for (const item of fallback ? [...matches, fallback] : matches) {
        await localDb.delete('user_progress', item.id)
      }
    }
  }
}

async function replayItem(
  item: SyncOutboxItem,
  expressionCache?: { items: any[] },
): Promise<boolean> {
  if (item.entityType === 'my_unit') {
    if (item.operation === 'create') {
      await learningApi.startUnit(item.entityId)
      return true
    }
    if (item.operation === 'delete') {
      await learningApi.quitUnit(item.entityId)
      return true
    }
  }

  if (item.entityType === 'practice_session') {
    const payload = item.payload as any
    if (item.operation === 'create') {
      const remote = await practiceApi.createSession(payload.topicId)
      await localDb.put('kv', {
        id: `session-map:${payload.localSessionId ?? item.entityId}`,
        value: remote.id,
        updatedAt: new Date().toISOString(),
      })
      await applyPracticeSessionItem(remote, payload.localSessionId ?? item.entityId)
      return true
    }
    if (item.operation === 'update' && payload.status === 'completed') {
      const remoteSessionId = await resolveSessionId(localDb, payload.sessionId ?? item.entityId)
      if (!remoteSessionId) return false
      const updated = await practiceApi.completeSession(remoteSessionId)
      await applyPracticeSessionItem(updated, payload.sessionId ?? item.entityId)
      return true
    }
  }

  if (item.entityType === 'practice_turn' && item.operation === 'create') {
    const payload = item.payload as any
    const remoteSessionId = await resolveSessionId(localDb, payload.sessionId)
    if (!remoteSessionId) throw new Error('练习会话尚未同步')
    await practiceApi.submitTurn(remoteSessionId, payload.data)
    return true
  }

  // warmup_records 不再单独入队：统一走 daily_practice → dailyPracticeApi.complete（含 SM-2 排期）。
  // 旧的 bare push 分支已删除，避免与 complete 路径重复创建 practiceWarmupRecord。

  // 学习包：本地概念，不推服务端，直接标记完成
  if (item.entityType === 'learning_pack') {
    return true
  }

  if (item.entityType === 'daily_practice') {
    const payload = item.payload as any
    const result = await dailyPracticeApi.complete(payload)
    await localDb.putMany(
      'daily_practice_items',
      (result.itemProgresses ?? []).map((progress) => ({ ...progress, id: progress.itemId })),
    )
    const attempts = (payload?.attempts ?? []) as Array<{ id?: string; clientAttemptId?: string }>
    await Promise.all((result.syncedAttempts ?? []).map(async (clientAttemptId: string) => {
      const attempt = attempts.find((entry) => entry.clientAttemptId === clientAttemptId)
      if (attempt?.id) {
        await localDb.put('daily_practice_attempts', { ...attempt, id: attempt.id, syncStatus: 'synced' })
      }
    }))
    // 回写本地 warmup 记录：离线完成的记录，联网重放成功后标记 synced + remoteId
    const localRecordId = payload?.localWarmupRecordId
    if (localRecordId && result.warmupRecordId) {
      const existing = await localDb.get<any>('warmup_records', localRecordId)
      if (existing) {
        const next = {
          ...existing,
          remoteId: result.warmupRecordId,
          updatedAt: new Date().toISOString(),
          syncStatus: 'synced',
        }
        await localDb.put('warmup_records', next)
        await upsertWarmupRecordEntries({ ...next, updatedAt: existing.updatedAt ?? existing.createdAt ?? next.updatedAt })
      }
    }
    const clientRunId = payload?.run?.clientRunId ?? item.entityId
    const localRun = await localDb.get<any>('daily_practice_runs', clientRunId)
    if (localRun) {
      await localDb.put('daily_practice_runs', {
        ...localRun,
        syncStatus: 'synced',
        // Snapshot replay acknowledges persistence, not completion.
        submissionStatus: payload?.run?.submissionStatus === 'synced' ? 'synced' : localRun.submissionStatus,
        updatedAt: new Date().toISOString(),
      })
    }
    return true
  }

  // 生词本同步
  if (item.entityType === 'word_entry') {
    const payload = item.payload as any
    const word = payload.word ?? item.entityId

    if (item.operation === 'create') {
      const created = await expressionApi.create({
        type: 'word',
        original: word,
        chunkText: '',
        notebookIds: payload.notebookIds,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        sourceSnapshot: payload.sourceSnapshot,
      })
      await cacheExpressionItem(expressionCache, created)
      return true
    }
  }

  // 句块同步
  if (item.entityType === 'chunk_entry') {
    const payload = item.payload as any
    const text = payload.chunkText ?? payload.original ?? item.entityId

    if (item.operation === 'create') {
      const created = await expressionApi.create({
        type: 'chunk',
        chunkText: text,
        original: payload.original ?? '',
        sceneName: payload.sceneName,
        notebookIds: payload.notebookIds,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        sourceSnapshot: payload.sourceSnapshot,
      })
      await cacheExpressionItem(expressionCache, created)
      return true
    }
  }

  // 句型同步
  if (item.entityType === 'pattern_entry') {
    const payload = item.payload as any
    const pattern = payload.pattern ?? item.entityId

    if (item.operation === 'create') {
      const created = await expressionApi.create({
        type: 'scene_phrase',
        chunkText: pattern,
        corrected: payload.example ?? pattern,
        original: payload.meaning ?? '',
        sceneName: payload.sceneName,
        notebookIds: payload.notebookIds,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        sourceSnapshot: payload.sourceSnapshot,
      })
      await cacheExpressionItem(expressionCache, created)
      return true
    }
  }

  // ---- 阅读/写作 TopicSession + Submission ----
  if (item.entityType === 'topic_session') {
    const payload = item.payload as any
    if (item.operation === 'create') {
      const created = await learningApi.startTopicSession(payload.topicId)
      return true
    }
    if (item.operation === 'complete') {
      const remoteId = await resolveSessionId(localDb, item.entityId)
      if (!remoteId) return false
      await learningApi.completeTopicSession(payload.topicId, remoteId)
      return true
    }
  }

  if (item.entityType === 'topic_submission') {
    const payload = item.payload as any
    if (item.operation === 'create') {
      const remoteSessionId = await resolveSessionId(localDb, payload.sessionId)
      if (!remoteSessionId) throw new Error('练习会话尚未同步')
      await learningApi.saveTopicSubmission(payload.topicId, {
        response: payload.response,
        status: payload.status ?? 'submitted',
        revision: payload.revision,
      })
      return true
    }
  }

  return false
}

export const offlineSyncService = {
  async pull(userId?: string | null): Promise<{ cursors: Record<string, string | null>; changed: number; deleted: number }> {
    const cursorKey = userSyncCursorKey(userId)
    const cursorRecord = await localDb.get<{ value?: string }>('kv', cursorKey)
    // cursors 以 JSON 对象存储在 kv 中，每种类型独立
    let cursors: Record<string, string> = {}
    try {
      cursors = cursorRecord?.value ? JSON.parse(cursorRecord.value) : {}
    } catch { /* 旧格式兼容：忽略 */ }
    let totalChanged = 0
    let totalDeleted = 0
    let finalCursors: Record<string, string | null> = { ...cursors }

    // 循环分页拉取，直到所有类型 hasMore 均为 false。
    const MAX_PULL_DURATION_MS = 30_000
    const pullStartedAt = Date.now()
    let lastCursors = { ...cursors }

    while (true) {
      const result = await syncApi.pull(cursors)
      await applyUserPullChanges(result.changed, result.deleted)

      totalChanged +=
        (result.changed.expressionItems?.length ?? 0) +
        (result.changed.sceneProgresses?.length ?? 0) +
        (result.changed.chunkProgresses?.length ?? 0) +
        (result.changed.practiceSessions?.length ?? 0) +
        (result.changed.practiceTurns?.length ?? 0) +
        (result.changed.practiceWarmupRecords?.length ?? 0) +
        (result.changed.dailyPracticeRuns?.length ?? 0)
      totalDeleted +=
        (result.deleted.expressionItems?.length ?? 0) +
        (result.deleted.sceneProgresses?.length ?? 0) +
        (result.deleted.chunkProgresses?.length ?? 0)

      finalCursors = result.cursors

      // 检查是否所有类型都已拉完
      const anyMore = Object.values(result.hasMore).some(Boolean)
      if (!anyMore) break

      if (Date.now() - pullStartedAt > MAX_PULL_DURATION_MS) {
        // 超时：回退到上一页 cursors，下次 sync 从断点继续
        logger.warn(`pull timeout after ${MAX_PULL_DURATION_MS}ms, will resume on next sync`)
        finalCursors = lastCursors
        break
      }
      lastCursors = result.cursors
      cursors = result.cursors
    }

    if (finalCursors) {
      await localDb.put('kv', {
        id: cursorKey,
        value: JSON.stringify(finalCursors),
        updatedAt: new Date().toISOString(),
      })
    }

    return { cursors: finalCursors, changed: totalChanged, deleted: totalDeleted }
  },

  async sync(userId?: string | null): Promise<OfflineSyncResult> {
    // A snapshot can be enqueued while a foreground sync is already pulling.
    // Callers that need a durability barrier (notably sign-out) must therefore
    // start a fresh pass after the in-flight pass completes, rather than merely
    // sharing a promise whose flush phase may already have finished.
    if (activeSyncPromise) {
      await activeSyncPromise
      return this.sync(userId)
    }
    const syncStore = useOfflineSyncStore.getState()
    const logId = syncStore.begin('开始同步')
    const running = (async (): Promise<OfflineSyncResult> => {
      try {
        const push = await this.flush()
        if (push.failed > 0) {
          const detail = { push, pull: null, refreshedPacks: [] as string[] }
          toast.error(`同步失败：${push.failed} 条数据未上传，将在下次打开时重试`)
          useOfflineSyncStore.getState().finish(logId, {
            status: 'failed',
            summary: `同步失败：${push.failed} 条未上传`,
            detail,
            error: `${push.failed} 条待同步操作上传失败，请展开存储管理查看具体队列项。`,
          })
          return detail
        }
        if (push.synced > 0) {
          toast.success(`已同步 ${push.synced} 条离线数据`)
        }
        const pull = await this.pull(userId)

        // 拉取今日任务 item 权威进度并收敛到本地（不覆盖有未同步 attempt 的项）
        const localDailyItems = await localDb.list<{ itemId?: string; id: string }>('daily_practice_items')
        const dailyItemIds = localDailyItems.map((item) => item.itemId ?? item.id).filter(Boolean)
        await pullRemoteDailyProgress(dailyItemIds)

        const refreshedPacks = await this.refreshContentUpdates()
        if (refreshedPacks.length > 0) {
          toast.success(`已更新 ${refreshedPacks.length} 个离线学习包`)
        }

        const result = { push, pull, refreshedPacks }
        useOfflineSyncStore.getState().finish(logId, {
          status: 'success',
          summary: `同步完成：上传 ${push.synced}，拉取 ${pull.changed + pull.deleted}，更新学习包 ${refreshedPacks.length}`,
          detail: result,
        })
        return result
      } catch (error) {
        useOfflineSyncStore.getState().finish(logId, {
          status: 'failed',
          summary: '同步失败',
          error,
        })
        throw error
      }
    })()
    activeSyncPromise = running
    try {
      return await running
    } finally {
      if (activeSyncPromise === running) activeSyncPromise = null
    }
  },

  /** 检查公共内容更新，返回需要刷新的学习包 ID 列表 */
  async checkContentUpdates(): Promise<string[]> {
    try {
      const versionRecord = await localDb.get<{ value?: string }>('kv', 'sync:content:since')
      const manifest = await syncApi.contentManifest(versionRecord?.value ?? null)

      // 收集所有变更涉及的内容 ID
      const changedIds = new Set<string>([
        ...(manifest.changed?.scenes?.map((s: any) => s.id) ?? []),
        ...(manifest.changed?.topics?.map((t: any) => t.id) ?? []),
        ...(manifest.changed?.vocabularies?.map((v: any) => v.id) ?? []),
        ...(manifest.changed?.chunks?.map((c: any) => c.id) ?? []),
        ...(manifest.changed?.sentencePatterns?.map((p: any) => p.id) ?? []),
        ...(manifest.changed?.storyEpisodes?.map((e: any) => e.id) ?? []),
        ...(manifest.changed?.dictionaries?.map((d: any) => d.id) ?? []),
      ])

      if (changedIds.size === 0) return []

      // 找出哪些已安装学习包的内容发生了变更
      const packs = await localDb.list<{ packId: string; manifest?: { topics?: string[]; vocabularies?: string[]; chunks?: string[]; sentencePatterns?: string[]; storyEpisodes?: string[]; inkScripts?: string[] } }>('downloaded_packs')
      const stalePacks = packs
        .filter((pack) => {
          const ids = [
            ...(pack.manifest?.topics ?? []),
            ...(pack.manifest?.vocabularies ?? []),
            ...(pack.manifest?.chunks ?? []),
            ...(pack.manifest?.sentencePatterns ?? []),
            ...(pack.manifest?.storyEpisodes ?? []),
            ...(pack.manifest?.inkScripts ?? []),
          ]
          return ids.some((id) => changedIds.has(id))
        })
        .map((pack) => pack.packId)

      return stalePacks
    } catch (error) {
      logger.warn('content manifest check failed:', error)
      return []
    }
  },

  async refreshContentUpdates(): Promise<string[]> {
    const versionRecord = await localDb.get<{ value?: string }>('kv', 'sync:content:since')
    const manifest = await syncApi.contentManifest(versionRecord?.value ?? null)
    const changedIds = new Set<string>([
      ...(manifest.changed?.scenes?.map((s: any) => s.id) ?? []),
      ...(manifest.changed?.topics?.map((t: any) => t.id) ?? []),
      ...(manifest.changed?.vocabularies?.map((v: any) => v.id) ?? []),
      ...(manifest.changed?.chunks?.map((c: any) => c.id) ?? []),
      ...(manifest.changed?.sentencePatterns?.map((p: any) => p.id) ?? []),
      ...(manifest.changed?.storyEpisodes?.map((e: any) => e.id) ?? []),
      ...(manifest.changed?.dictionaries?.map((d: any) => d.id) ?? []),
    ])

    if (changedIds.size === 0) {
      if (manifest.generatedAt) {
        await localDb.put('kv', {
          id: 'sync:content:since',
          value: manifest.generatedAt,
          updatedAt: new Date().toISOString(),
        })
      }
      return []
    }

    const packs = await localDb.list<{ packId: string; manifest?: { topics?: string[]; vocabularies?: string[]; chunks?: string[]; sentencePatterns?: string[]; storyEpisodes?: string[]; inkScripts?: string[] } }>('downloaded_packs')
    const stalePacks = packs
      .filter((pack) => {
        const ids = [
          ...(pack.manifest?.topics ?? []),
          ...(pack.manifest?.vocabularies ?? []),
          ...(pack.manifest?.chunks ?? []),
          ...(pack.manifest?.sentencePatterns ?? []),
          ...(pack.manifest?.storyEpisodes ?? []),
          ...(pack.manifest?.inkScripts ?? []),
        ]
        return ids.some((id) => changedIds.has(id))
      })
      .map((pack) => pack.packId)

    const refreshed: string[] = []
    for (const packId of stalePacks) {
      try {
        await learningPackService.installUnit(packId)
        refreshed.push(packId)
      } catch (error) {
        logger.warn('pack refresh failed', { packId, error: errorMessage(error) })
      }
    }

    if (manifest.generatedAt && refreshed.length === stalePacks.length) {
      await localDb.put('kv', {
        id: 'sync:content:since',
        value: manifest.generatedAt,
        updatedAt: new Date().toISOString(),
      })
    }

    return refreshed
  },

  async flush(): Promise<{ synced: number; failed: number; skipped: number; operations: Record<string, number> }> {
    let synced = 0
    let failed = 0
    let skipped = 0

    const items = await syncOutbox.listPending()
    const operations = items.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.entityType}:${item.operation}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    if (items.length === 0) {
      // 清理历史上残留的 synced 记录
      await syncOutbox.cleanup()
      return { synced, failed, skipped, operations }
    }

    // 预取 expression 全量列表，供 replayItem 中 delete 操作复用（避免逐条 list()）
    let exprCtx: { items: any[] } | undefined
    try {
      const raw = await expressionApi.list()
      exprCtx = { items: Array.isArray(raw) ? raw : (raw as any)?.items ?? [] }
    } catch { /* 预取失败不影响同步，回退到逐条查询 */ }

    // 分离可批量推送的类型和需要单独处理的复杂类型。
    // practice_session / practice_turn 需要按创建顺序 replay，才能把 local_session 映射到远端 session。
    const bulkEntityTypes = new Set(['my_unit', 'word_entry', 'chunk_entry', 'pattern_entry'])
    const bulkItems = items.filter((item) => bulkEntityTypes.has(item.entityType))
    const individualItems = items.filter((item) => !bulkItems.includes(item))

    // 批量推送（每批最多 100 条，防止单次请求体过大）
    const BATCH_SIZE = 100
    for (let offset = 0; offset < bulkItems.length; offset += BATCH_SIZE) {
      const batch = bulkItems.slice(offset, offset + BATCH_SIZE)
      try {
        const { results } = await syncApi.push(
          batch.map((item) => ({
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            payload: item.payload,
            clientMutationId: item.clientMutationId,
          })),
        )

        for (let i = 0; i < batch.length; i++) {
          const result = results[i]
          if (result?.status === 'synced') {
            if (result.remoteItem) {
              await cacheExpressionItem(exprCtx, result.remoteItem)
            }
            await syncOutbox.markSynced(batch[i].id)
            synced += 1
          } else if (result?.status === 'skipped') {
            await syncOutbox.markSynced(batch[i].id)
            skipped += 1
          } else if (isPermanentSyncError(result?.error)) {
            await syncOutbox.markDiscarded(batch[i].id)
            skipped += 1
          } else {
            await syncOutbox.markFailed(batch[i].id, result?.error)
            failed += 1
          }
        }
      } catch {
        // 批量失败，回退到逐条 replay
        for (const item of batch) {
          try {
            const handled = await replayItem(item, exprCtx)
            if (handled) {
              await syncOutbox.markSynced(item.id)
              synced += 1
            } else {
              await syncOutbox.markFailed(item.id, new Error('同步依赖尚未准备好'))
              failed += 1
            }
          } catch (error) {
            if (isPermanentSyncError(error)) {
              await syncOutbox.markDiscarded(item.id)
              if (item.entityType === 'practice_session') {
                await discardSessionDependents(item.entityId)
              }
              skipped += 1
            } else {
              await syncOutbox.markFailed(item.id, error)
              failed += 1
            }
          }
        }
      }
    }

    // 逐条处理需要顺序 replay 的类型。
    let madeProgress = true
    while (madeProgress) {
      madeProgress = false
      const pending = await syncOutbox.listPending()

      for (const item of pending) {
        if (bulkEntityTypes.has(item.entityType)) {
          continue // 已批量处理，跳过
        }
        try {
          const handled = await replayItem(item, exprCtx)
          if (!handled) {
            await syncOutbox.markFailed(item.id, new Error('同步依赖尚未准备好'))
            failed += 1
            continue
          }
          await syncOutbox.markSynced(item.id)
          synced += 1
          madeProgress = true
        } catch (error) {
          if (isPermanentSyncError(error)) {
            await syncOutbox.markDiscarded(item.id)
            if (item.entityType === 'practice_session') {
              await discardSessionDependents(item.entityId)
            }
            skipped += 1
            madeProgress = true
          } else {
            await syncOutbox.markFailed(item.id, error)
            failed += 1
          }
        }
      }
    }

    // 清理 outbox 中已同步的旧记录
    await syncOutbox.cleanup()

    return { synced, failed, skipped, operations }
  },
}

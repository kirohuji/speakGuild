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

const USER_SYNC_CURSOR_KEY = 'sync:user:cursor'

function userSyncCursorKey(userId?: string | null) {
  return userId ? `sync:user:${userId}:cursor` : USER_SYNC_CURSOR_KEY
}

async function resolveSessionId(sessionId: string): Promise<string | null> {
  if (!sessionId.startsWith('local_session_')) return sessionId
  const mapped = await localDb.get<{ value: string }>('kv', `session-map:${sessionId}`)
  return mapped?.value ?? null
}

function errorMessage(error: unknown): string {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  const maybe = error as any
  return maybe?.response?.data?.message ?? maybe?.message ?? String(error)
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

function toIsoString(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return null
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
      const remoteSessionId = await resolveSessionId(payload.sessionId ?? item.entityId)
      if (!remoteSessionId) return false
      const updated = await practiceApi.completeSession(remoteSessionId)
      await applyPracticeSessionItem(updated, payload.sessionId ?? item.entityId)
      return true
    }
  }

  if (item.entityType === 'practice_turn' && item.operation === 'create') {
    const payload = item.payload as any
    const remoteSessionId = await resolveSessionId(payload.sessionId)
    if (!remoteSessionId) throw new Error('练习会话尚未同步')
    await practiceApi.submitTurn(remoteSessionId, payload.data)
    return true
  }

  if (item.entityType === 'warmup_records' && item.operation === 'create') {
    const payload = item.payload as any
    const { results } = await syncApi.push([{
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      payload: item.payload,
      clientMutationId: item.clientMutationId,
    }])
    const result = results[0]
    if (!result || result.status !== 'synced') {
      throw new Error(result?.error ?? 'warmup record sync failed')
    }
    const record = {
      id: item.entityId,
      remoteId: result.remoteId,
      topicId: payload.topicId,
      topicTitle: payload.topicTitle,
      score: payload.score ?? result.remoteItem?.score ?? null,
      feedback: payload.feedback ?? result.remoteItem?.feedback ?? null,
      items: payload.items ?? [],
      createdAt: payload.createdAt ?? item.createdAt,
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
    }
    await localDb.put('warmup_records', record)
    await upsertWarmupRecordEntries({ ...record, updatedAt: record.createdAt })
    return true
  }

  // 学习包：本地概念，不推服务端，直接标记完成
  if (item.entityType === 'learning_pack') {
    return true
  }

  if (item.entityType === 'daily_practice') {
    const result = await dailyPracticeApi.complete(item.payload)
    const attempts = ((item.payload as any)?.attempts ?? []) as Array<{ id?: string; clientAttemptId?: string }>
    await Promise.all((result.syncedAttempts ?? []).map(async (clientAttemptId: string) => {
      const attempt = attempts.find((entry) => entry.clientAttemptId === clientAttemptId)
      if (attempt?.id) {
        await localDb.put('daily_practice_attempts', { ...attempt, id: attempt.id, syncStatus: 'synced' })
      }
    }))
    return true
  }

  // 生词本同步
  if (item.entityType === 'word_entry') {
    const payload = item.payload as any
    const word = payload.word ?? item.entityId

    if (item.operation === 'create') {
      const created = await expressionApi.create({ type: 'word', original: word, chunkText: '' })
      await cacheExpressionItem(expressionCache, created)
      return true
    }

    if (item.operation === 'delete') {
      const items = expressionCache?.items ?? []
      const match = items.find(
        (expr: any) => (expr.type === 'word' || !expr.type) && expr.original === word,
      )
      if (match?.id) {
        await expressionApi.remove(match.id)
        return true
      }
      // 服务端没有这条记录，视为已删除
      return true
    }

    if (item.operation === 'update') {
      const items = expressionCache?.items ?? []
      const match = items.find(
        (expr: any) => (expr.type === 'word' || !expr.type) && expr.original === word,
      )
      if (match?.id && payload.masteryStatus) {
        const updated = await expressionApi.updateStatus(match.id, payload.masteryStatus)
        await cacheExpressionItem(expressionCache, updated)
      }
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
      })
      await cacheExpressionItem(expressionCache, created)
      return true
    }

    if (item.operation === 'delete') {
      const items = expressionCache?.items ?? []
      const match = items.find(
        (expr: any) => expr.type === 'chunk' && (expr.chunkText === text || expr.original === text),
      )
      if (match?.id) {
        await expressionApi.remove(match.id)
        return true
      }
      return true
    }

    if (item.operation === 'update') {
      const items = expressionCache?.items ?? []
      const match = items.find(
        (expr: any) => expr.type === 'chunk' && (expr.chunkText === text || expr.original === text),
      )
      if (match?.id && payload.masteryStatus) {
        const updated = await expressionApi.updateStatus(match.id, payload.masteryStatus)
        await cacheExpressionItem(expressionCache, updated)
      }
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
      })
      await cacheExpressionItem(expressionCache, created)
      return true
    }

    if (item.operation === 'delete') {
      const items = expressionCache?.items ?? []
      const match = items.find(
        (expr: any) => expr.type === 'scene_phrase' && expr.chunkText === pattern,
      )
      if (match?.id) {
        await expressionApi.remove(match.id)
        return true
      }
      return true
    }

    if (item.operation === 'update') {
      const items = expressionCache?.items ?? []
      const match = items.find(
        (expr: any) => expr.type === 'scene_phrase' && expr.chunkText === pattern,
      )
      if (match?.id && payload.masteryStatus) {
        const updated = await expressionApi.updateStatus(match.id, payload.masteryStatus)
        await cacheExpressionItem(expressionCache, updated)
      }
      return true
    }
  }

  return false
}

export const offlineSyncService = {
  async pull(userId?: string | null): Promise<{ cursor: string | null; changed: number; deleted: number }> {
    const cursorKey = userSyncCursorKey(userId)
    const cursorRecord = await localDb.get<{ value?: string }>('kv', cursorKey)
    let cursor: string | null = cursorRecord?.value ?? null
    let totalChanged = 0
    let totalDeleted = 0
    let finalCursor: string | null = null

    // 循环分页拉取，直到服务端返回 hasMore: false
    // ★ 设置最大 5 页上限，防止启动时一次性拉取过多数据导致主线程长时间阻塞
    const MAX_PULL_PAGES = 5
    let pages = 0

    while (true) {
      pages++
      const result = await syncApi.pull(cursor)
      await applyUserPullChanges(result.changed, result.deleted)

      totalChanged +=
        (result.changed.expressionItems?.length ?? 0) +
        (result.changed.sceneProgresses?.length ?? 0) +
        (result.changed.chunkProgresses?.length ?? 0) +
        (result.changed.practiceSessions?.length ?? 0) +
        (result.changed.practiceTurns?.length ?? 0) +
        (result.changed.practiceWarmupRecords?.length ?? 0)
      totalDeleted +=
        (result.deleted.expressionItems?.length ?? 0) +
        (result.deleted.sceneProgresses?.length ?? 0) +
        (result.deleted.chunkProgresses?.length ?? 0)

      finalCursor = result.cursor

      if (!result.hasMore) break
      if (pages >= MAX_PULL_PAGES) {
        console.warn(`[offline-sync] pull reached max pages (${MAX_PULL_PAGES}), remaining data will be pulled on next sync`)
        break
      }
      cursor = result.cursor
    }

    if (finalCursor) {
      await localDb.put('kv', {
        id: cursorKey,
        value: finalCursor,
        updatedAt: new Date().toISOString(),
      })
    }

    return { cursor: finalCursor, changed: totalChanged, deleted: totalDeleted }
  },

  async sync(userId?: string | null): Promise<{
    push: { synced: number; failed: number; skipped: number; operations?: Record<string, number> }
    pull: { cursor: string | null; changed: number; deleted: number } | null
    refreshedPacks: string[]
  }> {
    const syncStore = useOfflineSyncStore.getState()
    if (syncStore.isSyncing) {
      return {
        push: { synced: 0, failed: 0, skipped: 0 },
        pull: null,
        refreshedPacks: [],
      }
    }

    const logId = syncStore.begin('开始同步')
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
      const packs = await localDb.list<{ packId: string; manifest?: { topics?: string[]; vocabularies?: string[]; chunks?: string[]; sentencePatterns?: string[] } }>('downloaded_packs')
      const stalePacks = packs
        .filter((pack) => {
          const ids = [
            ...(pack.manifest?.topics ?? []),
            ...(pack.manifest?.vocabularies ?? []),
            ...(pack.manifest?.chunks ?? []),
            ...(pack.manifest?.sentencePatterns ?? []),
          ]
          return ids.some((id) => changedIds.has(id))
        })
        .map((pack) => pack.packId)

      return stalePacks
    } catch (error) {
      console.warn('[offline-sync] content manifest check failed:', error)
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

    const packs = await localDb.list<{ packId: string; manifest?: { topics?: string[]; vocabularies?: string[]; chunks?: string[]; sentencePatterns?: string[] } }>('downloaded_packs')
    const stalePacks = packs
      .filter((pack) => {
        const ids = [
          ...(pack.manifest?.topics ?? []),
          ...(pack.manifest?.vocabularies ?? []),
          ...(pack.manifest?.chunks ?? []),
          ...(pack.manifest?.sentencePatterns ?? []),
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
        console.warn('[offline-sync] pack refresh failed:', packId, error)
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

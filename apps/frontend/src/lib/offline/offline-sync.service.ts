import { learningApi } from '@/features/learning/api/learning-api'
import { practiceApi, expressionApi } from '@/features/practice/api/english-practice-api'
import { transcribeRecording } from '@/lib/practice-ai-api'
import { toast } from 'sonner'
import { syncApi } from './sync-api'
import { localDb } from './unified-storage'
import { syncOutbox, type SyncOutboxItem } from './sync-outbox'
import { learningContentRepository } from './learning-content.repository'
import { learningPackService } from './learning-pack.service'
import { useOfflineSyncStore } from '@/stores/offline-sync.store'

const USER_SYNC_CURSOR_KEY = 'sync:user:cursor'

function userSyncCursorKey(userId?: string | null) {
  return userId ? `sync:user:${userId}:cursor` : USER_SYNC_CURSOR_KEY
}

async function resolveSessionId(sessionId: string): Promise<string | null> {
  if (!sessionId.startsWith('local_session_')) return sessionId
  const mapped = await localDb.get<{ value: string }>('kv', `session-map:${sessionId}`)
  return mapped?.value ?? null
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
  await localDb.put('practice_records', {
    id: `session:${item.id}`,
    type: 'session',
    remoteId: item.id,
    sessionId: item.id,
    localSessionId: localSessionId ?? undefined,
    topicId: item.topicId,
    sceneId: item.sceneId,
    inkScriptId: item.inkScriptId,
    status: item.status,
    turnCount: item.turnCount ?? 0,
    analysisResult: item.analysisResult,
    analysisRaw: item.analysisRaw,
    analysisError: item.analysisError,
    startedAt: toIsoString(item.startedAt),
    completedAt: toIsoString(item.completedAt),
    analyzedAt: toIsoString(item.analyzedAt),
    updatedAt: toIsoString(item.updatedAt) ?? new Date().toISOString(),
    syncStatus: 'synced',
  })
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
    if (!remoteSessionId) return false
    await practiceApi.submitTurn(remoteSessionId, payload.data)
    const record = await localDb.get<any>('practice_records', `session:${remoteSessionId}`)
    if (record) {
      await localDb.put('practice_records', {
        ...record,
        turnCount: (record.turnCount ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      })
    }
    return true
  }

  // 学习包：本地概念，不推服务端，直接标记完成
  if (item.entityType === 'learning_pack') {
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

  // 录音离线上传：取 blob → 上传 → 存 audioUrl 到 kv
  if (item.entityType === 'recording' && item.operation === 'create') {
    const payload = item.payload as any
    const blobId = payload.blobId ?? item.entityId
    const recording = await localDb.getBlob(blobId)
    if (!recording) return true // blob 已被清理，视为已完成

    const ext = recording.mimeType?.includes('ogg') ? 'ogg'
      : recording.mimeType?.includes('mp4') ? 'mp4'
      : 'webm'
    const result = await transcribeRecording(recording.blob, `recording.${ext}`)

    // 存下 audioUrl，供后续 turn 查找
    if (result.audioUrl) {
      await localDb.put('kv', {
        id: `recording-result:${blobId}`,
        value: { audioUrl: result.audioUrl, text: result.text },
        updatedAt: new Date().toISOString(),
      })
    }
    await localDb.deleteBlob(blobId)
    return true
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
    while (true) {
      const result = await syncApi.pull(cursor)
      await applyUserPullChanges(result.changed, result.deleted)

      totalChanged +=
        (result.changed.expressionItems?.length ?? 0) +
        (result.changed.sceneProgresses?.length ?? 0) +
        (result.changed.chunkProgresses?.length ?? 0) +
        (result.changed.practiceSessions?.length ?? 0) +
        (result.changed.practiceTurns?.length ?? 0)
      totalDeleted +=
        (result.deleted.expressionItems?.length ?? 0) +
        (result.deleted.sceneProgresses?.length ?? 0) +
        (result.deleted.chunkProgresses?.length ?? 0)

      finalCursor = result.cursor

      if (!result.hasMore) break
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
    push: { synced: number; failed: number; skipped: number }
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
        ...(manifest.changed?.scriptEpisodes?.map((e: any) => e.id) ?? []),
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
      ...(manifest.changed?.scriptEpisodes?.map((e: any) => e.id) ?? []),
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

  async flush(): Promise<{ synced: number; failed: number; skipped: number }> {
    let synced = 0
    let failed = 0
    let skipped = 0

    const items = await syncOutbox.listPending()
    if (items.length === 0) {
      // 清理历史上残留的 synced 记录
      await syncOutbox.cleanup()
      return { synced, failed, skipped }
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
              skipped += 1
            }
          } catch (error) {
            await syncOutbox.markFailed(item.id, error)
            failed += 1
          }
        }
      }
    }

    // 逐条处理复杂类型（recording 等非批量类型）
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
            skipped += 1
            continue
          }
          await syncOutbox.markSynced(item.id)
          synced += 1
          madeProgress = true
        } catch (error) {
          await syncOutbox.markFailed(item.id, error)
          failed += 1
        }
      }
    }

    // 清理 outbox 中已同步的旧记录
    await syncOutbox.cleanup()

    return { synced, failed, skipped }
  },
}

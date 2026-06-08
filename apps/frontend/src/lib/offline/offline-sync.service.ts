import { learningApi } from '@/features/learning/api/learning-api'
import { practiceApi, expressionApi } from '@/features/practice/api/english-practice-api'
import { transcribeRecording } from '@/lib/practice-ai-api'
import { syncApi } from './sync-api'
import { localDb } from './local-db'
import { syncOutbox, type SyncOutboxItem } from './sync-outbox'
import { learningContentRepository } from './learning-content.repository'

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

async function deleteExpressionItem(remoteId: string): Promise<void> {
  await learningContentRepository.deleteExpressionByRemoteId(remoteId)
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
    if (!item.id) continue
    await localDb.put('practice_records', {
      id: `session:${item.id}`,
      type: 'session',
      remoteId: item.id,
      sessionId: item.id,
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

  for (const item of changed?.practiceTurns ?? []) {
    if (!item.id) continue
    await localDb.put('practice_records', {
      id: `turn:${item.sessionId}:${item.round ?? item.id}`,
      type: 'turn',
      remoteId: item.id,
      sessionId: item.sessionId,
      round: item.round,
      npcText: item.npcText,
      userText: item.userText,
      userAudioUrl: item.userAudioUrl,
      inputNodeId: item.inputNodeId,
      tags: item.tags,
      judgement: item.judgement,
      objectivesCompleted: item.objectivesCompleted ?? [],
      chunksUsed: item.chunksUsed ?? [],
      createdAt: toIsoString(item.createdAt),
      syncStatus: 'synced',
    })
  }

  for (const id of deleted?.expressionItems ?? []) {
    await deleteExpressionItem(id)
  }

  for (const id of deleted?.sceneProgresses ?? []) {
    const records = await localDb.list<any>('user_progress')
    const match = records.find((item) => item.remoteId === id || item.id === id)
    if (match?.id) await localDb.delete('user_progress', match.id)
  }

  for (const id of deleted?.chunkProgresses ?? []) {
    const records = await localDb.list<any>('user_progress')
    const match = records.find((item) => item.remoteId === id || item.id === id)
    if (match?.id) await localDb.delete('user_progress', match.id)
  }
}

async function replayItem(item: SyncOutboxItem): Promise<boolean> {
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
      return true
    }
    if (item.operation === 'update' && payload.status === 'completed') {
      const remoteSessionId = await resolveSessionId(payload.sessionId ?? item.entityId)
      if (!remoteSessionId) return false
      await practiceApi.completeSession(remoteSessionId)
      return true
    }
  }

  if (item.entityType === 'practice_turn' && item.operation === 'create') {
    const payload = item.payload as any
    const remoteSessionId = await resolveSessionId(payload.sessionId)
    if (!remoteSessionId) return false
    await practiceApi.submitTurn(remoteSessionId, payload.data)
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
      await expressionApi.create({ type: 'word', original: word, chunkText: '' })
      return true
    }

    if (item.operation === 'delete') {
      const list = await expressionApi.list()
      const items = Array.isArray(list) ? list : (list as any)?.items ?? []
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
  }

  // 句块同步
  if (item.entityType === 'chunk_entry') {
    const payload = item.payload as any
    const text = payload.chunkText ?? payload.original ?? item.entityId

    if (item.operation === 'create') {
      await expressionApi.create({
        type: 'chunk',
        chunkText: text,
        original: payload.original ?? '',
        sceneName: payload.sceneName,
      })
      return true
    }

    if (item.operation === 'delete') {
      const list = await expressionApi.list()
      const items = Array.isArray(list) ? list : (list as any)?.items ?? []
      const match = items.find(
        (expr: any) => expr.type === 'chunk' && (expr.chunkText === text || expr.original === text),
      )
      if (match?.id) {
        await expressionApi.remove(match.id)
        return true
      }
      return true
    }
  }

  // 句型同步
  if (item.entityType === 'pattern_entry') {
    const payload = item.payload as any
    const pattern = payload.pattern ?? item.entityId

    if (item.operation === 'create') {
      await expressionApi.create({
        type: 'scene_phrase',
        chunkText: pattern,
        corrected: payload.example ?? pattern,
        original: payload.meaning ?? '',
        sceneName: payload.sceneName,
      })
      return true
    }

    if (item.operation === 'delete') {
      const list = await expressionApi.list()
      const items = Array.isArray(list) ? list : (list as any)?.items ?? []
      const match = items.find(
        (expr: any) => expr.type === 'scene_phrase' && expr.chunkText === pattern,
      )
      if (match?.id) {
        await expressionApi.remove(match.id)
        return true
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
    const cursorRecord = await localDb.get<{ value?: string }>('kv', userSyncCursorKey(userId))
    const result = await syncApi.pull(cursorRecord?.value ?? null)

    await applyUserPullChanges(result.changed, result.deleted)

    if (result.cursor) {
      await localDb.put('kv', {
        id: userSyncCursorKey(userId),
        value: result.cursor,
        updatedAt: new Date().toISOString(),
      })
    }

    return {
      cursor: result.cursor ?? null,
      changed:
        (result.changed.expressionItems?.length ?? 0) +
        (result.changed.sceneProgresses?.length ?? 0) +
        (result.changed.chunkProgresses?.length ?? 0) +
        (result.changed.practiceSessions?.length ?? 0) +
        (result.changed.practiceTurns?.length ?? 0),
      deleted:
        (result.deleted.expressionItems?.length ?? 0) +
        (result.deleted.sceneProgresses?.length ?? 0) +
        (result.deleted.chunkProgresses?.length ?? 0),
    }
  },

  async sync(userId?: string | null): Promise<{
    push: { synced: number; failed: number; skipped: number }
    pull: { cursor: string | null; changed: number; deleted: number } | null
  }> {
    const push = await this.flush()
    if (push.failed > 0) {
      return { push, pull: null }
    }
    const pull = await this.pull(userId)
    return { push, pull }
  },

  async flush(): Promise<{ synced: number; failed: number; skipped: number }> {
    let synced = 0
    let failed = 0
    let skipped = 0

    const items = await syncOutbox.listPending()
    if (items.length === 0) return { synced, failed, skipped }

    // 分离可批量推送的简单类型和需要单独处理的复杂类型
    const bulkItems = items.filter(
      (item) => item.entityType === 'my_unit' || item.entityType === 'word_entry' || item.entityType === 'chunk_entry' || item.entityType === 'pattern_entry',
    )
    const individualItems = items.filter(
      (item) => !bulkItems.includes(item),
    )

    // 批量推送简单类型
    if (bulkItems.length > 0) {
      try {
        const { results } = await syncApi.push(
          bulkItems.map((item) => ({
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            payload: item.payload,
            clientMutationId: item.clientMutationId,
          })),
        )

        for (let i = 0; i < bulkItems.length; i++) {
          const result = results[i]
          if (result?.status === 'synced') {
            await syncOutbox.markSynced(bulkItems[i].id)
            synced += 1
          } else if (result?.status === 'skipped') {
            skipped += 1
          } else {
            await syncOutbox.markFailed(bulkItems[i].id, result?.error)
            failed += 1
          }
        }
      } catch {
        // 批量失败，回退到逐条 replay
        for (const item of bulkItems) {
          try {
            const handled = await replayItem(item)
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

    // 逐条处理复杂类型（practice_session / practice_turn / recording）
    let madeProgress = true
    while (madeProgress) {
      madeProgress = false
      const pending = await syncOutbox.listPending()

      for (const item of pending) {
        if (item.entityType === 'my_unit' || item.entityType === 'word_entry' || item.entityType === 'chunk_entry' || item.entityType === 'pattern_entry') {
          continue // 已批量处理，跳过
        }
        try {
          const handled = await replayItem(item)
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

    return { synced, failed, skipped }
  },
}

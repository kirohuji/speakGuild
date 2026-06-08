import { learningApi } from '@/features/learning/api/learning-api'
import { practiceApi, expressionApi } from '@/features/practice/api/english-practice-api'
import { transcribeRecording } from '@/lib/practice-ai-api'
import { syncApi } from './sync-api'
import { localDb } from './local-db'
import { syncOutbox, type SyncOutboxItem } from './sync-outbox'

async function resolveSessionId(sessionId: string): Promise<string | null> {
  if (!sessionId.startsWith('local_session_')) return sessionId
  const mapped = await localDb.get<{ value: string }>('kv', `session-map:${sessionId}`)
  return mapped?.value ?? null
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

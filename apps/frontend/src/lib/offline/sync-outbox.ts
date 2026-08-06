import { localDb } from './unified-storage'
import { createId } from './utils'

export type SyncEntityType =
  | 'my_unit'
  | 'word_entry'
  | 'chunk_entry'
  | 'pattern_entry'
  | 'practice_session'
  | 'practice_turn'
  | 'learning_pack'
  | 'daily_practice'
  | 'topic_session'
  | 'topic_submission'

export type SyncOperation = 'create' | 'update' | 'delete'

export interface SyncOutboxItem<TPayload = unknown> {
  id: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: TPayload
  clientMutationId: string
  createdAt: string
  updatedAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  lastError?: string
  syncedAt?: string
}

export const syncOutbox = {
  async enqueue<TPayload>(input: {
    entityType: SyncEntityType
    entityId: string
    operation: SyncOperation
    payload: TPayload
  }): Promise<SyncOutboxItem<TPayload>> {
    const now = new Date().toISOString()
    const item: SyncOutboxItem<TPayload> = {
      id: createId(),
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      clientMutationId: createId(),
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      status: 'pending',
    }
    await localDb.put('outbox', item)
    return item
  },

  async listPending(): Promise<SyncOutboxItem[]> {
    const items = await localDb.list<SyncOutboxItem>('outbox')
    return items
      .filter((item) => item.status === 'pending' || item.status === 'failed')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  async markSynced(id: string): Promise<void> {
    // 标记为已同步（而非立即删除），保留 7 天审计追溯。
    // 旧记录由 cleanup() 统一清理。
    try {
      const item = await localDb.get<SyncOutboxItem>('outbox', id)
      if (!item) return
      await localDb.put('outbox', {
        ...item,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.warn('[sync-outbox] markSynced update failed:', error)
    }
  },

  async markDiscarded(id: string): Promise<void> {
    // 永久失败项（例如服务端内容已删除）不应继续重试。
    // 与 markSynced 对称：标记而非删除，由 cleanup() 统一清理。
    try {
      const item = await localDb.get<SyncOutboxItem>('outbox', id)
      if (!item) return
      await localDb.put('outbox', {
        ...item,
        status: 'synced',
        lastError: 'discarded: permanent failure',
        syncedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.warn('[sync-outbox] markDiscarded update failed:', error)
    }
  },

  /** 清理历史上残留的 synced 记录和过期失败记录 */
  async cleanup(): Promise<number> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      // 清理 7 天前的已同步记录（正常完成，无需保留）
      await localDb.deleteWhere<SyncOutboxItem>('outbox', (item) =>
        item.status === 'synced' && (item.syncedAt ?? item.updatedAt) < sevenDaysAgo,
      )
      // 清理永久失败的记录
      await localDb.deleteWhere<SyncOutboxItem>('outbox', (item) => isPermanentFailure(item.lastError))
      // 清理 7 天前仍然失败的记录（重试无意义）
      await localDb.deleteWhere<SyncOutboxItem>('outbox', (item) =>
        item.status === 'failed' && item.updatedAt < sevenDaysAgo,
      )
      return 0
    } catch {
      return 0
    }
  },

  async markFailed(id: string, error: unknown): Promise<void> {
    const item = await localDb.get<SyncOutboxItem>('outbox', id)
    if (!item) return
    await localDb.put('outbox', {
      ...item,
      status: 'failed',
      retryCount: item.retryCount + 1,
      updatedAt: new Date().toISOString(),
      lastError: serializeError(error),
    })
  },
}

function serializeError(error: unknown): string {
  if (!error) return 'Unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  const value = error as any
  const status = value?.response?.status
  const message = value?.response?.data?.message ?? value?.message
  if (status && message) return `${status}: ${message}`
  if (message) return String(message)
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function isPermanentFailure(error?: string): boolean {
  if (!error) return false
  return [
    '练习话题不存在',
    '话题不存在',
    '练习会话不存在',
    'Topic not found',
    'Session not found',
    'Not Found',
    '404',
  ].some((marker) => error.includes(marker))
}

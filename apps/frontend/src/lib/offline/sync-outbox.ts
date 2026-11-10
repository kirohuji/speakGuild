import { localDb } from './unified-storage'
import { createId } from './utils'

export type SyncEntityType =
  | 'my_unit'
  | 'word_entry'
  | 'chunk_entry'
  | 'pattern_entry'
  | 'practice_session'
  | 'practice_turn'
  | 'daily_practice'
  | 'topic_session'
  | 'topic_submission'
  | 'novel_progress'
  | 'script_practice_record'
  | 'nqtr_save'

export type SyncOperation = 'create' | 'update' | 'delete' | 'complete' | 'snapshot'

export interface SyncOutboxItem<TPayload = unknown> {
  id: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: TPayload
  clientMutationId: string
  createdAt: string
  updatedAt: string
  /** Monotonic local revision used to acknowledge exactly one sent payload. */
  revision?: number
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
    const existing = (await localDb.findByIndex<SyncOutboxItem<TPayload>>('outbox', 'entity_id', input.entityId)).find((item) =>
      item.entityType === input.entityType
      && item.entityId === input.entityId
      && item.operation === input.operation
      && (item.status === 'pending' || item.status === 'failed'),
    )
    if (existing) {
      const existingRevision = input.entityType === 'daily_practice'
        ? String((existing.payload as any)?.run?.clientUpdatedAt ?? '')
        : ''
      const incomingRevision = input.entityType === 'daily_practice'
        ? String((input.payload as any)?.run?.clientUpdatedAt ?? '')
        : ''
      // A delayed completion snapshot must never replace a newer retry
      // snapshot merely because it reaches the outbox later.
      if (existingRevision && incomingRevision && existingRevision > incomingRevision) {
        return existing
      }
      const merged: SyncOutboxItem<TPayload> = {
        ...existing,
        payload: input.payload,
        updatedAt: now,
        revision: (existing.revision ?? 0) + 1,
        status: 'pending',
        lastError: undefined,
      }
      await localDb.put('outbox', merged)
      return merged
    }
    const item: SyncOutboxItem<TPayload> = {
      id: createId(),
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      clientMutationId: createId(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      retryCount: 0,
      status: 'pending',
    }
    await localDb.put('outbox', item)
    return item
  },

  async listPending(): Promise<SyncOutboxItem[]> {
    const items = await localDb.findByIndexIn<SyncOutboxItem>('outbox', 'status', ['pending', 'failed'])
    return items
      // Older app versions briefly wrote device-local learning-pack events to
      // the sync outbox. Never replay those records as remote mutations.
      .filter((item) => String(item.entityType) !== 'learning_pack')
      .filter((item) => item.status === 'pending' || item.status === 'failed')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  /**
   * A replay works on a snapshot of an outbox row.  Do not acknowledge a row
   * which was coalesced with a newer payload while that request was in flight.
   */
  async markSynced(id: string, expected?: Pick<SyncOutboxItem, 'revision' | 'updatedAt'>): Promise<boolean> {
    // 标记为已同步（而非立即删除），保留 7 天审计追溯。
    // 旧记录由 cleanup() 统一清理。
    try {
      const item = await localDb.get<SyncOutboxItem>('outbox', id)
      if (!item) return false
      if (expected?.revision !== undefined) {
        if (item.revision !== expected.revision) return false
      } else if (expected?.updatedAt && item.updatedAt !== expected.updatedAt) return false
      await localDb.put('outbox', {
        ...item,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      })
      return true
    } catch (error) {
      console.warn('[sync-outbox] markSynced update failed:', error)
      return false
    }
  },

  /** True only when a coalesced payload replaced the snapshot just replayed. */
  async hasNewerRevision(id: string, expected: Pick<SyncOutboxItem, 'revision' | 'updatedAt'>): Promise<boolean> {
    try {
      const item = await localDb.get<SyncOutboxItem>('outbox', id)
      if (!item || (item.status !== 'pending' && item.status !== 'failed')) return false
      if (expected.revision !== undefined) return item.revision !== expected.revision
      return item.updatedAt !== expected.updatedAt
    } catch {
      // A local read failure is not evidence of a new payload.  Let the next
      // foreground/background sync retry instead of spinning forever here.
      return false
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
      await localDb.deleteWhere<SyncOutboxItem>('outbox', (item) =>
        String(item.entityType) === 'learning_pack',
      )
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

  async markFailed(id: string, error: unknown, expected?: Pick<SyncOutboxItem, 'revision' | 'updatedAt'>): Promise<boolean> {
    const item = await localDb.get<SyncOutboxItem>('outbox', id)
    if (!item) return false
    if (expected?.revision !== undefined) {
      if (item.revision !== expected.revision) return false
    } else if (expected?.updatedAt && item.updatedAt !== expected.updatedAt) return false
    await localDb.put('outbox', {
      ...item,
      status: 'failed',
      retryCount: item.retryCount + 1,
      updatedAt: new Date().toISOString(),
      lastError: serializeError(error),
    })
    return true
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

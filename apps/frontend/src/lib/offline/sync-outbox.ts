import { localDb } from './unified-storage'
import { createId } from './utils'

export type SyncEntityType =
  | 'user_recording'
  | 'notebook'
  | 'notebook_item'
  | 'my_unit'
  | 'word_entry'
  | 'chunk_entry'
  | 'pattern_entry'
  | 'practice_session'
  | 'practice_turn'
  | 'daily_practice'
  | 'learning_activity'
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
  nextRetryAt?: string
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
    if (input.entityType === 'daily_practice') {
      await localDb.saveDailyPracticeOutbox(input.entityId, input.operation, input.payload)
      return (await localDb.get<SyncOutboxItem<TPayload>>('outbox', `daily-practice:${input.entityId}`))!
    }
    const now = new Date().toISOString()
    const existing = (await localDb.findByIndex<SyncOutboxItem<TPayload>>('outbox', 'entity_id', input.entityId)).find((item) =>
      item.entityType === input.entityType
      && item.entityId === input.entityId
      && item.operation === input.operation
      && (item.status === 'pending' || item.status === 'failed'),
    )
    if (existing) {
      const merged: SyncOutboxItem<TPayload> = {
        ...existing,
        payload: input.payload,
        updatedAt: now,
        revision: (existing.revision ?? 0) + 1,
        status: 'pending',
        lastError: undefined,
        nextRetryAt: now,
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
      nextRetryAt: now,
      retryCount: 0,
      status: 'pending',
    }
    await localDb.put('outbox', item)
    return item
  },

  async listPending(types?: ReadonlySet<SyncEntityType>): Promise<SyncOutboxItem[]> {
    return localDb.listDueOutbox(new Date().toISOString(), 100, types ? [...types] : undefined)
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
      return await localDb.patchOutbox(id, item.revision ?? 0, 'synced')
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
    // Permanent failures were removed by cleanup immediately; keep that behavior without scanning failures.
    try { await localDb.delete('outbox', id) }
    catch (error) { console.warn('[sync-outbox] markDiscarded failed:', error) }
  },

  /** 清理已同步记录和永久失败记录；普通失败记录不按时间过期。 */
  async cleanup(): Promise<number> {
    try {
      await localDb.pruneSyncedOutbox(new Date(Date.now() - 7 * 86400000).toISOString())
      // Ordinary failures are never deleted by age.
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
    return localDb.patchOutbox(id, item.revision ?? 0, 'failed', serializeError(error),
      new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(item.retryCount, 7))).toISOString())
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

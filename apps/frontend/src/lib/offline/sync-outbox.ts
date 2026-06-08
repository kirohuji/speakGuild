import { localDb } from './unified-storage'

export type SyncEntityType =
  | 'my_unit'
  | 'word_entry'
  | 'chunk_entry'
  | 'pattern_entry'
  | 'practice_session'
  | 'practice_turn'
  | 'learning_pack'
  | 'recording'

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
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    // 同步成功后直接删除 outbox 记录，避免无限膨胀
    try {
      await localDb.delete('outbox', id)
    } catch (error) {
      console.warn('[sync-outbox] markSynced delete failed:', error)
    }
  },

  /** 清理历史上残留的 synced 记录（兼容旧版本遗留数据） */
  async cleanup(): Promise<number> {
    try {
      // 删除状态为 synced 的记录（旧逻辑遗留）
      await localDb.deleteWhere<SyncOutboxItem>('outbox', (item) => item.status === 'synced')
      // 删除 7 天前失败的记录（重试无意义）
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
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
      lastError: error instanceof Error ? error.message : String(error),
    })
  },
}

import { localDb } from './unified-storage'
import { syncApi, type PushResult } from './sync-api'
import type { SyncOutboxItem } from './sync-outbox'
import { learningContentRepository, notifyLearningLibraryChanged } from './learning-content.repository'
import { serializeNotebookWrite } from './notebook-mutations'

export type NotebookPushItem = {
  entityType: string
  entityId: string
  operation: string
  payload: any
  clientMutationId?: string
}

export type NotebookBatchContext = {
  /** Outbox ids already marked synced (or acked earlier in this flush). */
  syncedIds: Set<string>
  /** Ordered batch currently being prepared / pushed. */
  batchIds: Set<string>
  batchOrder: SyncOutboxItem[]
  /** Local notebook id → known server id (remoteId or in-batch create entityId). */
  notebookServerIds: Map<string, string>
}

/** Match a locally initialized system book before pulling its server identity. */
export async function findPulledNotebook(notebook: any) {
  const aliases = await localDb.findByIndex<any>('learning_notebooks', 'remote_id', notebook.id)
  const existing = aliases[0] ?? await localDb.get<any>('learning_notebooks', notebook.id)
  if (existing || notebook.kind !== 'uncategorized') return existing
  return (await localDb.list<any>('learning_notebooks')).find(row =>
    row.kind === 'uncategorized' && !row.deletedAt && !row.remoteId)
}

function predecessorReady(predecessor: string | undefined, ctx?: NotebookBatchContext): boolean {
  if (!predecessor) return true
  if (ctx?.syncedIds.has(predecessor)) return true
  if (!ctx?.batchOrder.length) return false
  // Current candidate is always last in batchOrder while preparing.
  const index = ctx.batchOrder.findIndex((row) => row.id === predecessor)
  return index >= 0 && index < ctx.batchOrder.length - 1
}

/**
 * Resolve payload for a notebook outbox row.
 * Returns null when dependencies are not ready for this batch (caller should skip / defer).
 * Throws when the mutation is permanently blocked outside a batch context.
 */
export async function prepareNotebookPushItem(
  item: SyncOutboxItem,
  ctx?: NotebookBatchContext,
): Promise<NotebookPushItem | null> {
  const payload = { ...(item.payload as any) }
  if (payload.predecessor) {
    const previous = await localDb.get<SyncOutboxItem>('outbox', payload.predecessor)
    const ready =
      !previous
      || previous.status === 'synced'
      || predecessorReady(payload.predecessor, ctx)
    if (!ready) {
      if (ctx) return null
      throw new Error('前置操作尚未同步')
    }
  }

  if (item.entityType === 'notebook_item') {
    const localNotebookId = payload.notebookId
    const notebook = await localDb.get<any>('learning_notebooks', localNotebookId)
    const mapped = ctx?.notebookServerIds.get(localNotebookId)
    const serverId = notebook?.remoteId ?? mapped
    if (!serverId) {
      if (ctx) return null
      throw new Error('学习本尚未同步')
    }
    payload.notebookId = serverId
  } else {
    const notebook = await localDb.get<any>('learning_notebooks', item.entityId)
    payload.remoteId = notebook?.remoteId ?? undefined
    // Client-created notebooks use entityId as the server primary key on first create.
    if (ctx && !notebook?.remoteId) {
      ctx.notebookServerIds.set(item.entityId, item.entityId)
    } else if (ctx && notebook?.remoteId) {
      ctx.notebookServerIds.set(item.entityId, notebook.remoteId)
    }
  }

  return {
    entityType: item.entityType,
    entityId: item.entityId,
    operation: item.operation,
    payload,
    clientMutationId: item.clientMutationId,
  }
}

export async function ackNotebookPushResult(
  item: SyncOutboxItem,
  result: PushResult,
  options?: { notify?: boolean },
): Promise<void> {
  if (result?.status !== 'synced' || !result.remoteItem) {
    throw new Error(result?.error || '学习本同步未确认')
  }
  await serializeNotebookWrite(async () => {
    const table = item.entityType === 'notebook' ? 'learning_notebooks' : 'learning_notebook_items'
    const local = await localDb.get<any>(table, item.entityId)
    if (!local) return
    const remote = result.remoteItem
    const state = table === 'learning_notebook_items' && local.lastMutationId === item.id && !remote.superseded
      ? Object.fromEntries(['masteryStatus', 'reviewCount', 'intervalDays', 'easeFactor', 'lapseCount', 'lastReviewedAt', 'nextReviewAt'].filter(key => remote[key] !== undefined).map(key => [key, remote[key]])) : {}
    await localDb.put(table, { ...local, ...state, remoteId: remote.id, remoteUpdatedAt: remote.updatedAt, remoteVersion: remote.version,
      ...(remote.superseded ? { deletedAt: remote.deletedAt } : {}),
      syncStatus: local.lastMutationId === item.id ? 'synced' : local.syncStatus })
    if (remote.expressionItem) await learningContentRepository.saveRemoteExpressionEntry(remote.expressionItem)
  })
  if (options?.notify !== false) notifyLearningLibraryChanged()
}

export async function ackNotebookPushResults(
  writes: Array<{ item: SyncOutboxItem; result: PushResult }>,
): Promise<void> {
  for (const { item, result } of writes) {
    await ackNotebookPushResult(item, result, { notify: false })
  }
  if (writes.length > 0) notifyLearningLibraryChanged()
}

/**
 * Build a dependency-safe batch of notebook mutations for one /sync/push call.
 * Preserves input order; skips items whose deps are not yet satisfied.
 */
export async function selectNotebookPushBatch(
  pending: SyncOutboxItem[],
  batchSize = 100,
  alreadySyncedIds?: Iterable<string>,
): Promise<{ batch: SyncOutboxItem[]; prepared: NotebookPushItem[] }> {
  const notebookPending = pending
    .filter((item) => item.entityType === 'notebook' || item.entityType === 'notebook_item')
    .sort((a, b) =>
      Number(b.entityType === 'notebook') - Number(a.entityType === 'notebook')
      || a.createdAt.localeCompare(b.createdAt),
    )

  const ctx: NotebookBatchContext = {
    syncedIds: new Set(alreadySyncedIds ?? []),
    batchIds: new Set(),
    batchOrder: [],
    notebookServerIds: new Map(),
  }

  // Seed known remote notebook ids from local storage for items already synced.
  for (const notebook of await localDb.list<any>('learning_notebooks')) {
    if (notebook?.remoteId) ctx.notebookServerIds.set(notebook.id, notebook.remoteId)
  }

  const batch: SyncOutboxItem[] = []
  const prepared: NotebookPushItem[] = []

  for (const item of notebookPending) {
    if (batch.length >= batchSize) break
    ctx.batchOrder = [...batch, item]
    ctx.batchIds = new Set(ctx.batchOrder.map((row) => row.id))
    const pushItem = await prepareNotebookPushItem(item, ctx)
    if (!pushItem) continue
    batch.push(item)
    prepared.push(pushItem)
    if (item.entityType === 'notebook' && !ctx.notebookServerIds.has(item.entityId)) {
      ctx.notebookServerIds.set(item.entityId, item.entityId)
    }
  }

  return { batch, prepared }
}

export async function replayNotebookMutation(item: SyncOutboxItem) {
  const prepared = await prepareNotebookPushItem(item)
  if (!prepared) throw new Error('前置操作尚未同步')
  const { results } = await syncApi.push([prepared])
  await ackNotebookPushResult(item, results[0])
  return true
}

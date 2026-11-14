import { localDb } from './unified-storage'
import { syncApi } from './sync-api'
import type { SyncOutboxItem } from './sync-outbox'
import { learningContentRepository, notifyLearningLibraryChanged } from './learning-content.repository'
import { serializeNotebookWrite } from './notebook-mutations'

export async function replayNotebookMutation(item: SyncOutboxItem) {
  const payload = { ...(item.payload as any) }
  if (payload.predecessor) {
    const previous = await localDb.get<SyncOutboxItem>('outbox', payload.predecessor)
    if (previous && previous.status !== 'synced') throw new Error('前置操作尚未同步')
  }
  if (item.entityType === 'notebook_item') {
    const notebook = await localDb.get<any>('learning_notebooks', payload.notebookId)
    if (!notebook?.remoteId) throw new Error('学习本尚未同步')
    payload.notebookId = notebook.remoteId
  } else {
    const notebook = await localDb.get<any>('learning_notebooks', item.entityId)
    payload.remoteId = notebook?.remoteId ?? undefined
  }
  const { results } = await syncApi.push([{ ...item, payload }])
  const result = results[0]
  if (result?.status !== 'synced' || !result.remoteItem) throw new Error(result?.error || '学习本同步未确认')
  await serializeNotebookWrite(async () => {
    const table = item.entityType === 'notebook' ? 'learning_notebooks' : 'learning_notebook_items'
    const local = await localDb.get<any>(table, item.entityId)
    if (!local) return
    const remote = result.remoteItem
    // Keep the stable local identity and any operation created during this request.
    const state = table === 'learning_notebook_items' && local.lastMutationId === item.id && !remote.superseded
      ? Object.fromEntries(['masteryStatus', 'reviewCount', 'intervalDays', 'easeFactor', 'lapseCount', 'lastReviewedAt', 'nextReviewAt'].filter(key => remote[key] !== undefined).map(key => [key, remote[key]])) : {}
    await localDb.put(table, { ...local, ...state, remoteId: remote.id, remoteUpdatedAt: remote.updatedAt, remoteVersion: remote.version,
      ...(remote.superseded ? { deletedAt: remote.deletedAt } : {}),
      syncStatus: local.lastMutationId === item.id ? 'synced' : local.syncStatus })
    if (remote.expressionItem) await learningContentRepository.saveRemoteExpressionEntry(remote.expressionItem)
  })
  notifyLearningLibraryChanged()
  return true
}

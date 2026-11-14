import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import { localDb, type LocalWrite } from './unified-storage'
import { createId } from './utils'
import { notifyLearningLibraryChanged } from './learning-content.repository'

// Serialize read/modify/write sequences as well as the SQLite transaction itself.
let writes = Promise.resolve()
export function serializeNotebookWrite<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.then(work, work)
  writes = next.then(() => undefined, () => undefined)
  return next
}
export function notebookMutation(entityType: 'notebook' | 'notebook_item', row: any, payload: any) {
  const now = new Date().toISOString()
  const id = createId('notebook-mutation')
  return {
    id, entityType, entityId: row.id, operation: 'snapshot', payload: {
      ...payload, ownerId: getCurrentSessionSnapshot()?.user?.id, baseUpdatedAt: row.remoteUpdatedAt ?? null, baseVersion: row.remoteVersion ?? null, predecessor: row.lastMutationId ?? null,
    },
    clientMutationId: id, revision: 1, createdAt: now, updatedAt: now,
    nextRetryAt: now, retryCount: 0, status: 'pending',
  }
}
export async function commitNotebookMutation(writes: LocalWrite[]) {
  await localDb.commitLocalWrites(writes)
  notifyLearningLibraryChanged()
}

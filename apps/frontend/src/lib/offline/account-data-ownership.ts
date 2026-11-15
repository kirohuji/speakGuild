import { localDb } from './unified-storage'
import { offlineStorageService } from './offline-storage.service'
import { createId } from './utils'

const OWNER_KEY = 'offline-account:owner'
const TRANSITION_KEY = 'offline-account:transition'

export class AccountDataIsolationError extends Error {
  constructor(cause: unknown) {
    super('本地数据归属确认或清理未完成，请重试。原有数据不会交给其他账号使用。', { cause })
    this.name = 'AccountDataIsolationError'
  }
}

let preparation = Promise.resolve()
function serializeAccountData<T>(work: () => Promise<T>): Promise<T> {
  const next = preparation.then(work, work)
  preparation = next.then(() => undefined, () => undefined)
  return next
}
/** Caller must pause sync and block business pages until this completes. */
export function prepareAccountData(userId: string, legacy: { ownerId: string | null; cachedUserId: string | null }, clear: () => Promise<void>): Promise<{ reused: boolean; archiveId?: string }> {
  return serializeAccountData(async () => {
    try {
      const durableOwner = await localDb.get<{ value: string }>('kv', OWNER_KEY)
      const owner = durableOwner?.value || legacy.ownerId
      let transition = await localDb.get<any>('kv', TRANSITION_KEY)
      let reused = !transition && owner === userId
      if (!transition && !owner) {
        const state = await offlineStorageService.inspectUserData()
        // Old sessions are corroborated with explicit owners when available.
        reused = state.hasData && state.ownerIds.every(id => id === userId)
          && (legacy.cachedUserId === userId || state.ownerIds.length > 0)
        if (state.hasData && !reused) transition = { id: TRANSITION_KEY, archiveId: createId('legacy-account'), targetUserId: userId }
      } else if (!transition && owner !== userId) {
        transition = { id: TRANSITION_KEY, targetUserId: userId }
      }
      if (transition) {
        // Persist before touching data; an interrupted/failed clear must be retried.
        await localDb.put('kv', transition)
        if (transition.archiveId) await offlineStorageService.archiveUserData(transition.archiveId)
        await clear()
      }
      await localDb.commitLocalWrites([
        { table: 'kv', value: { id: OWNER_KEY, value: userId } },
        { table: 'kv', deleteId: TRANSITION_KEY },
      ])
      return { reused, archiveId: transition?.archiveId }
    } catch (error) { throw new AccountDataIsolationError(error) }
  })
}

export async function clearAccountDataForLogout(clear: () => Promise<void>) {
  return serializeAccountData(async () => {
    try {
      await localDb.put('kv', { id: TRANSITION_KEY, targetUserId: null })
      await clear()
      await localDb.commitLocalWrites([
        { table: 'kv', deleteId: OWNER_KEY }, { table: 'kv', deleteId: TRANSITION_KEY },
      ])
    } catch (error) { throw new AccountDataIsolationError(error) }
  })
}

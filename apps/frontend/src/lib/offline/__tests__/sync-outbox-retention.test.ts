import { describe, expect, it } from 'vitest'
import { statisticsDb } from './statistics-sqlite.fixture'
describe('outbox retention and indexed retry scheduling', () => {
  it('retains expired failures while removing old acknowledgements', async () => {
    const { store } = await statisticsDb()
    await store.put('outbox', { id: 'failed', entityType: 'daily_practice', status: 'failed', updatedAt: '2020-01-01', lastError: 'Network Error' })
    await store.put('outbox', { id: 'synced', entityType: 'daily_practice', status: 'synced', updatedAt: '2020-01-01', syncedAt: '2020-01-01' })
    await store.pruneSyncedOutbox('2099-01-01')
    expect(await store.get('outbox', 'failed')).not.toBeNull()
    expect(await store.get('outbox', 'synced')).toBeNull()
  })
  it('returns only a bounded batch of retries that are due', async () => {
    const { store } = await statisticsDb()
    await store.putMany('outbox', Array.from({ length: 150 }, (_, i) => ({ id: String(i), entityType: 'learning_activity', status: 'failed', nextRetryAt: i < 120 ? '2026-01-01' : '2099-01-01' })))
    expect(await store.listDueOutbox('2026-11-14', 100)).toHaveLength(100)
  })
})

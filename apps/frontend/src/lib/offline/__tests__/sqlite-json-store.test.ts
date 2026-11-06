import { describe, expect, it, vi } from 'vitest'
import { createSqliteJsonStore, type SqliteJsonExecutor } from '../sqlite/sqlite-json-store'

function executor(overrides: Partial<SqliteJsonExecutor> = {}): SqliteJsonExecutor {
  return {
    label: 'test-sqlite',
    queryRows: vi.fn(async () => []),
    run: vi.fn(async () => undefined),
    execute: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('sqlite-json-store write failures', () => {
  it('propagates delete failures to lifecycle callers', async () => {
    const failure = new Error('disk full')
    const store = createSqliteJsonStore(executor({ run: vi.fn(async () => { throw failure }) }))
    await expect(store.delete('downloaded_packs', 'pack-1')).rejects.toBe(failure)
  })

  it('propagates indexed delete failures', async () => {
    const failure = new Error('database locked')
    const store = createSqliteJsonStore(executor({ run: vi.fn(async () => { throw failure }) }))
    await expect(store.deleteByIndex('asset_refs', 'pack_id', 'pack-1')).rejects.toBe(failure)
  })

  it('uses an indexed DELETE instead of hydrating the table', async () => {
    const run = vi.fn(async () => undefined)
    const queryRows = vi.fn(async () => [])
    const store = createSqliteJsonStore(executor({ run, queryRows }))
    await store.deleteByIndex('daily_practice_items', 'pack_id', 'pack-1')
    expect(queryRows).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledWith(
      'DELETE FROM "daily_practice_items" WHERE pack_id = ?',
      ['pack-1'],
    )
  })

  it('stores learning-pack audit fields as indexed columns', async () => {
    const run = vi.fn(async () => undefined)
    const store = createSqliteJsonStore(executor({ run }))
    await store.put('pack_events', {
      id: 'event-1',
      packId: 'pack-1',
      action: 'update',
      version: 3,
      previousVersion: 2,
      updateMode: 'delta',
      occurredAt: '2026-11-06T00:00:00.000Z',
    })

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('pack_id, action, version, previous_version, occurred_at'),
      expect.arrayContaining(['event-1', 'pack-1', 'update', 3, 2, '2026-11-06T00:00:00.000Z']),
    )
  })
})

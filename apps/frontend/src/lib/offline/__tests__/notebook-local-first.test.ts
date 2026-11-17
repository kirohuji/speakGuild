import { beforeEach, describe, expect, it, vi } from 'vitest'
import { statisticsDb } from './statistics-sqlite.fixture'

const dependencies = vi.hoisted(() => ({ db: null as any, push: vi.fn() }))
vi.mock('../sync-api', () => ({ syncApi: { push: dependencies.push } }))
vi.mock('../unified-storage', () => ({ localDb: new Proxy({}, { get: (_, key) => dependencies.db[key] }) }))
vi.mock('@/providers/auth-session', () => ({ getCurrentSessionSnapshot: () => ({ user: { id: 'user-a' } }) }))
vi.mock('../learning-content.repository', () => ({
  notifyLearningLibraryChanged: vi.fn(), createPayload: (e: any) => ({ word: e.original }),
  learningContentRepository: { hydrateExpressionSnapshots: async (entries: any[]) => entries, saveRemoteExpressionEntry: vi.fn() },
}))
vi.mock('../favorite-audio-pin.service', () => ({
  favoriteAudioPinService: {
    pinExpressionAudio: vi.fn(async () => undefined),
    unpinExpressionAudio: vi.fn(async () => undefined),
    ensurePinned: vi.fn(async () => undefined),
    pinMany: vi.fn(async () => undefined),
  },
  favoriteAudioPackId: (id: string) => `favorite:${id}`,
  isFavoriteAudioPackId: (id?: string | null) => String(id ?? '').startsWith('favorite:'),
  collectPlaybackUrls: () => [],
}))
import {
  replayNotebookMutation,
  findPulledNotebook,
  selectNotebookPushBatch,
  ackNotebookPushResults,
  prepareNotebookPushItem,
  rebaseConflictedNotebookMutations,
  isNotebookVersionConflict,
} from '../notebook-sync'
import { learningNotebookRepository as notebooks } from '../learning-notebook.repository'
import { syncOutbox } from '../sync-outbox'

const entry = { id: 'word:hello', kind: 'word', type: 'word', original: 'hello', createdAt: '2026-11-01', updatedAt: '2026-11-01' } as any
beforeEach(async () => { dependencies.db = (await statisticsDb()).store })

describe('local notebook mutations', () => {
  it('initializes one empty system book locally across concurrent list loads', async () => {
    const results = await Promise.all([notebooks.listCached(), notebooks.listCached(), notebooks.refresh()])
    const book = results[0].items[0]
    expect(book.kind).toBe('uncategorized')
    expect(book.counts.total).toBe(0)
    expect(results.every(result => result.items.length === 1 && result.items[0].id === book.id)).toBe(true)
    expect(await dependencies.db.list('outbox')).toHaveLength(1)
    await expect(notebooks.remove(book.id)).rejects.toThrow('系统学习本')
    await notebooks.addEntry(entry, [])
    expect((await notebooks.listCached()).items[0].counts.word).toBe(1)
  })
  it('reuses the downloaded system book and matches a local system book to its server identity', async () => {
    const local = (await notebooks.listCached()).items[0]
    expect((await findPulledNotebook({ id: 'remote-system', kind: 'uncategorized' })).id).toBe(local.id)
    await dependencies.db.put('learning_notebooks', { ...local, remoteId: 'remote-system', syncStatus: 'synced' })
    expect((await findPulledNotebook({ id: 'remote-system', kind: 'uncategorized' })).id).toBe(local.id)
    expect(await findPulledNotebook({ id: 'custom-server', kind: 'custom' })).toBeNull()
    const before = (await dependencies.db.list('outbox')).length
    expect((await notebooks.listCached()).items).toHaveLength(1)
    expect(await dependencies.db.list('outbox')).toHaveLength(before)
  })

  it('creates, collects, reviews, removes and rejoins entirely in SQLite', async () => {
    const book = await notebooks.create('Offline')
    await notebooks.addEntry(entry, [book.id])
    expect((await notebooks.listCached()).items.find(n => n.kind === 'custom')!.counts.word).toBe(1)
    let page = await notebooks.listCachedExpressionPage({ notebookId: book.id, type: 'word', limit: 30 })
    expect(page.total).toBe(1)
    const id = page.items[0].notebookItemId
    await notebooks.updateCachedNotebookItemStatus(id, 'mastered')
    expect((await notebooks.listCachedExpressionPage({ notebookId: book.id, type: 'word', reviewState: 'mastered', limit: 30 })).total).toBe(1)
    await notebooks.removeCachedNotebookItem(id)
    expect((await notebooks.listCached()).items.find(n => n.kind === 'custom')!.counts.total).toBe(0)
    expect((await notebooks.listCachedExpressionPage({ notebookId: book.id, type: 'word', limit: 30 })).total).toBe(0)
    await notebooks.addEntry(entry, [book.id])
    expect((await notebooks.listCached()).items.find(n => n.kind === 'custom')!.counts.total).toBe(1)
    const queue = await dependencies.db.list('outbox')
    expect(queue).toHaveLength(6)
    expect(new Set(queue.map((op: any) => op.clientMutationId)).size).toBe(6)
  })
  it('keeps shared content when deleting one notebook', async () => {
    const first = await notebooks.create('First'), second = await notebooks.create('Second')
    await notebooks.addEntry(entry, [first.id, second.id])
    await notebooks.remove(first.id)
    expect((await notebooks.listCached()).items.filter(n => n.kind === 'custom')).toHaveLength(1)
    expect((await notebooks.listCached()).items.find(n => n.kind === 'custom')!.counts.total).toBe(1)
    expect((await notebooks.listCachedExpressionPage({ notebookId: first.id, type: 'word', limit: 30 })).total).toBe(0)
    expect(await dependencies.db.get('expression_entries', entry.id)).not.toBeNull()
  })
  it('does not lose links when adding the same item to another book', async () => {
    const first = await notebooks.create('First'), second = await notebooks.create('Second')
    await notebooks.addEntry(entry, [first.id])
    await notebooks.addEntry(entry, [second.id])
    await notebooks.addEntry(entry, [first.id])
    expect((await notebooks.listCached()).items.filter(n => n.kind === 'custom').map(b => b.counts.total)).toEqual([1, 1])
    expect(await dependencies.db.list('outbox')).toHaveLength(5)
  })
  it('rolls back the notebook if its queue write fails', async () => {
    const fixture = await statisticsDb(); dependencies.db = fixture.store; fixture.failOutbox(true)
    await expect(notebooks.create('No space')).rejects.toThrow('disk full')
    expect(await dependencies.db.list('learning_notebooks')).toEqual([])
    expect(await dependencies.db.list('outbox')).toEqual([])
  })
})

describe('shared statistics and detail rules', () => {
  it('deduplicates before filtering, excludes orphan content and honors pending removal', async () => {
    const db = dependencies.db
    await db.put('learning_notebooks', { id: 'book', name: 'Book' })
    await db.put('expression_entries', entry)
    await db.putMany('learning_notebook_items', [
      { id: 'remote', notebookId: 'book', expressionEntryId: entry.id, masteryStatus: 'learning', syncStatus: 'synced' },
      { id: 'local:new', notebookId: 'book', expressionEntryId: entry.id, masteryStatus: 'mastered', syncStatus: 'pending' },
      { id: 'orphan', notebookId: 'book', expressionEntryId: 'missing', masteryStatus: 'learning' },
    ])
    expect(await db.notebookCounts()).toEqual([{ notebookId: 'book', kind: 'word', count: 1 }])
    expect((await db.listNotebookExpressionPage({ notebookId: 'book', kind: 'word', reviewState: 'learning', limit: 30 })).total).toBe(0)
    const pending = await db.get('learning_notebook_items', 'local:new')
    await db.put('learning_notebook_items', { ...pending, deletedAt: new Date().toISOString() })
    expect(await db.notebookCounts()).toEqual([])
    expect(await db.activeNotebookItems()).toEqual([])
    expect((await db.listNotebookExpressionPage({ notebookId: 'book', kind: 'word', limit: 30 })).total).toBe(0)
  })
})

describe('notebook replay', () => {
  it('keeps collected content attached when the server acknowledges its existing system book', async () => {
    const book = (await notebooks.listCached()).items[0]
    await notebooks.addEntry(entry, [])
    const operation = (await dependencies.db.list('outbox')).find((op: any) => op.entityType === 'notebook')
    dependencies.push.mockResolvedValueOnce({ results: [{ status: 'synced', remoteItem: {
      id: 'existing-server-system', kind: 'uncategorized', updatedAt: '2026-11-15T01:00:00Z', version: 1,
    } }] })
    await replayNotebookMutation(operation)
    expect((await notebooks.listCached()).items.map(n => n.id)).toEqual([book.id])
    expect((await dependencies.db.get('learning_notebooks', book.id)).remoteId).toBe('existing-server-system')
    expect((await notebooks.listCachedExpressionPage({ notebookId: book.id, type: 'word', limit: 30 })).total).toBe(1)
    expect((await notebooks.listCached()).items[0].counts.word).toBe(1)
  })
  it('keeps a newer local rename when an earlier push completes', async () => {
    const book = await notebooks.create('First')
    const operation = (await dependencies.db.list('outbox'))[0]
    dependencies.push.mockImplementationOnce(async () => {
      await notebooks.rename(book.id, 'Newer')
      return { results: [{ status: 'synced', remoteItem: { id: 'server-book', updatedAt: '2026-11-14T01:00:00Z', version: 0 } }] }
    })
    await replayNotebookMutation(operation)
    const local = await dependencies.db.get('learning_notebooks', book.id)
    expect(local.name).toBe('Newer')
    expect(local.syncStatus).toBe('pending')
    expect(local.remoteId).toBe('server-book')
    expect(local.lastMutationId).not.toBe(operation.id)
  })
  it('does not upload a child before its notebook exists remotely', async () => {
    const book = await notebooks.create('First')
    await notebooks.addEntry(entry, [book.id])
    const child = (await dependencies.db.list('outbox')).find((op: any) => op.entityType === 'notebook_item')
    dependencies.push.mockClear()
    await expect(replayNotebookMutation(child)).rejects.toThrow('学习本尚未同步')
    expect(dependencies.push).not.toHaveBeenCalled()
  })
  it('retains an operation when the server rejects a conflict', async () => {
    await notebooks.create('First')
    const operation = (await dependencies.db.list('outbox'))[0]
    dependencies.push.mockResolvedValueOnce({ results: [{ status: 'failed', error: '其他设备已修改' }] })
    await expect(replayNotebookMutation(operation)).rejects.toThrow('其他设备已修改')
    expect((await dependencies.db.get('outbox', operation.id)).status).toBe('pending')
  })

  it('rebases a conflicted mutation onto a fresher remote base', async () => {
    const book = await notebooks.create('First')
    const operation = (await dependencies.db.list('outbox'))[0]
    expect(isNotebookVersionConflict('其他设备已修改此数据，本地修改已保留')).toBe(true)
    await dependencies.db.put('outbox', {
      ...operation,
      status: 'failed',
      lastError: '其他设备已修改此数据，本地修改已保留',
      payload: { ...operation.payload, baseVersion: 1, baseUpdatedAt: '2026-11-01T00:00:00.000Z', predecessor: 'prev' },
    })
    await dependencies.db.put('learning_notebooks', {
      ...(await dependencies.db.get('learning_notebooks', book.id)),
      remoteVersion: 3,
      remoteUpdatedAt: '2026-11-17T00:00:00.000Z',
    })
    expect(await rebaseConflictedNotebookMutations()).toBe(1)
    const rebased = await dependencies.db.get('outbox', operation.id)
    expect(rebased.status).toBe('pending')
    expect(rebased.lastError).toBeUndefined()
    expect(rebased.payload.predecessor).toBeNull()
    expect(rebased.payload.baseVersion).toBe(3)
    expect(rebased.payload.baseUpdatedAt).toBe('2026-11-17T00:00:00.000Z')
  })
})

describe('notebook batch push', () => {
  it('packs create + join into one prepared push batch', async () => {
    const book = await notebooks.create('Offline')
    await notebooks.addEntry(entry, [book.id])
    const pending = await dependencies.db.list('outbox')
    const { batch, prepared } = await selectNotebookPushBatch(pending)
    expect(batch.map((item: any) => item.entityType)).toEqual(['notebook', 'notebook_item'])
    expect(prepared).toHaveLength(2)
    expect(prepared[0].entityType).toBe('notebook')
    expect(prepared[1].payload.notebookId).toBe(book.id)
  })

  it('packs many status updates into a single push call', async () => {
    const book = await notebooks.create('Offline')
    await dependencies.db.put('learning_notebooks', {
      ...(await dependencies.db.get('learning_notebooks', book.id)),
      remoteId: book.id,
      syncStatus: 'synced',
    })
    for (const op of await dependencies.db.list('outbox')) {
      await dependencies.db.put('outbox', { ...op, status: 'synced' })
    }

    const itemIds: string[] = []
    for (const word of ['alpha', 'beta', 'gamma', 'delta']) {
      const wordEntry = { ...entry, id: `word:${word}`, original: word }
      await dependencies.db.put('expression_entries', wordEntry)
      await notebooks.addEntry(wordEntry as any, [book.id])
      const links = await dependencies.db.findByIndex('learning_notebook_items', 'notebook_id', book.id)
      const link = links.find((row: any) => row.expressionEntryId === wordEntry.id && !row.deletedAt)
      itemIds.push(link.id)
    }
    for (const id of itemIds) {
      await notebooks.updateCachedNotebookItemStatus(id, 'reviewing')
    }

    const pending = (await dependencies.db.list('outbox')).filter((op: any) => op.status === 'pending')
    const { batch, prepared } = await selectNotebookPushBatch(pending)
    expect(prepared.length).toBe(batch.length)
    expect(prepared.filter((item) => item.payload?.intent === 'status')).toHaveLength(4)

    dependencies.push.mockClear()
    dependencies.push.mockResolvedValueOnce({
      results: batch.map((item: any) => ({
        status: 'synced',
        clientMutationId: item.clientMutationId,
        remoteItem: {
          id: `remote-${item.entityId}`,
          updatedAt: '2026-11-17T01:00:00Z',
          version: 1,
          masteryStatus: item.payload?.masteryStatus ?? 'learning',
        },
      })),
    })
    const { results } = await dependencies.push(prepared)
    expect(dependencies.push).toHaveBeenCalledTimes(1)
    expect(dependencies.push.mock.calls[0][0]).toHaveLength(prepared.length)
    await ackNotebookPushResults(batch.map((item: any, i: number) => ({ item, result: results[i] })))
    for (const item of batch) {
      await syncOutbox.markSynced(item.id, item)
    }
    expect((await dependencies.db.list('outbox')).filter((op: any) => op.status === 'pending')).toHaveLength(0)
  })

  it('allows an in-batch predecessor without a prior synced row', async () => {
    const book = await notebooks.create('Offline')
    await notebooks.addEntry(entry, [book.id])
    const pending = await dependencies.db.list('outbox')
    const child = pending.find((op: any) => op.entityType === 'notebook_item')!
    // Alone, child still cannot prepare.
    await expect(prepareNotebookPushItem(child)).rejects.toThrow('学习本尚未同步')
    // Inside a batch that already includes the notebook create, it can.
    const { prepared } = await selectNotebookPushBatch(pending)
    expect(prepared.some((item) => item.entityType === 'notebook_item')).toBe(true)
  })
})

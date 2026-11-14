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
import { replayNotebookMutation } from '../notebook-sync'
import { learningNotebookRepository as notebooks } from '../learning-notebook.repository'

const entry = { id: 'word:hello', kind: 'word', type: 'word', original: 'hello', createdAt: '2026-11-01', updatedAt: '2026-11-01' } as any
beforeEach(async () => { dependencies.db = (await statisticsDb()).store })

describe('local notebook mutations', () => {
  it('creates, collects, reviews, removes and rejoins entirely in SQLite', async () => {
    const book = await notebooks.create('Offline')
    await notebooks.addEntry(entry, [book.id])
    expect((await notebooks.listCached()).items[0].counts.word).toBe(1)
    let page = await notebooks.listCachedExpressionPage({ notebookId: book.id, type: 'word', limit: 30 })
    expect(page.total).toBe(1)
    const id = page.items[0].notebookItemId
    await notebooks.updateCachedNotebookItemStatus(id, 'mastered')
    expect((await notebooks.listCachedExpressionPage({ notebookId: book.id, type: 'word', reviewState: 'mastered', limit: 30 })).total).toBe(1)
    await notebooks.removeCachedNotebookItem(id)
    expect((await notebooks.listCached()).items[0].counts.total).toBe(0)
    expect((await notebooks.listCachedExpressionPage({ notebookId: book.id, type: 'word', limit: 30 })).total).toBe(0)
    await notebooks.addEntry(entry, [book.id])
    expect((await notebooks.listCached()).items[0].counts.total).toBe(1)
    const queue = await dependencies.db.list('outbox')
    expect(queue).toHaveLength(5)
    expect(new Set(queue.map((op: any) => op.clientMutationId)).size).toBe(5)
  })
  it('keeps shared content when deleting one notebook', async () => {
    const first = await notebooks.create('First'), second = await notebooks.create('Second')
    await notebooks.addEntry(entry, [first.id, second.id])
    await notebooks.remove(first.id)
    expect((await notebooks.listCached()).items).toHaveLength(1)
    expect((await notebooks.listCached()).items[0].counts.total).toBe(1)
    expect((await notebooks.listCachedExpressionPage({ notebookId: first.id, type: 'word', limit: 30 })).total).toBe(0)
    expect(await dependencies.db.get('expression_entries', entry.id)).not.toBeNull()
  })
  it('does not lose links when adding the same item to another book', async () => {
    const first = await notebooks.create('First'), second = await notebooks.create('Second')
    await notebooks.addEntry(entry, [first.id])
    await notebooks.addEntry(entry, [second.id])
    await notebooks.addEntry(entry, [first.id])
    expect((await notebooks.listCached()).items.map(b => b.counts.total)).toEqual([1, 1])
    expect(await dependencies.db.list('outbox')).toHaveLength(4)
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
})

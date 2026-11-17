import { describe, expect, it, vi } from 'vitest'
import { applyNotebookMutation } from '../../../../../backend/src/modules/sync/notebook-sync'
import { SyncService } from '../../../../../backend/src/modules/sync/sync.service'

function transaction() {
  const receipts = new Map<string, any>()
  let notebook: any = null
  const tx: any = {
    notebookSyncReceipt: {
      findUnique: vi.fn(async ({ where }: any) => receipts.get(where.userId_clientMutationId.clientMutationId) ?? null),
      create: vi.fn(async ({ data }: any) => { receipts.set(data.clientMutationId, data); return data }),
    },
    learningNotebook: {
      findFirst: vi.fn(async ({ where }: any) => notebook?.userId === where.userId && (!where.id || notebook.id === where.id) ? notebook : null),
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: any) => notebook = { ...data, version: 0, updatedAt: new Date('2026-11-14T01:00:00Z') }),
      update: vi.fn(async ({ data }: any) => notebook = { ...notebook, ...data, version: notebook.version + 1, updatedAt: new Date('2026-11-14T02:00:00Z') }),
    },
    learningNotebookItem: { updateMany: vi.fn(async () => ({ count: 0 })) },
  }
  return { tx, receipts, setNotebook: (value: any) => { notebook = value } }
}
const create = { entityType: 'notebook', entityId: 'local-book', clientMutationId: 'create', payload: { name: 'Offline', kind: 'custom', deleted: false, ownerId: 'a' } }

describe('server notebook acknowledgements', () => {
  it('binds an offline initialized system book to the existing user system book', async () => {
    const { tx, setNotebook } = transaction()
    setNotebook({ id: 'server-system', userId: 'a', name: '未分类', kind: 'uncategorized', version: 0, updatedAt: new Date() })
    const result = await applyNotebookMutation(tx, 'a', { ...create, payload: { ...create.payload, name: '未分类', kind: 'uncategorized' } })
    expect(result.remoteItem.id).toBe('server-system')
    expect(tx.learningNotebook.create).not.toHaveBeenCalled()
  })
  it('returns a durable receipt on retry without creating twice', async () => {
    const { tx } = transaction()
    const result = await applyNotebookMutation(tx, 'a', create)
    expect(await applyNotebookMutation(tx, 'a', create)).toEqual(result)
    expect(tx.learningNotebook.create).toHaveBeenCalledTimes(1)
  })
  it('chains a rename to its acknowledged predecessor', async () => {
    const { tx } = transaction()
    await applyNotebookMutation(tx, 'a', create)
    const result = await applyNotebookMutation(tx, 'a', { ...create, clientMutationId: 'rename', payload: { name: 'Renamed', deleted: false, predecessor: 'create' } })
    expect(result.remoteItem.name).toBe('Renamed')
    expect(result.remoteItem.version).toBe(1)
  })
  it('rejects another account and missing predecessors', async () => {
    const { tx } = transaction()
    await expect(applyNotebookMutation(tx, 'b', create)).rejects.toThrow('Account changed')
    await expect(applyNotebookMutation(tx, 'a', { ...create, payload: { ...create.payload, predecessor: 'missing' } })).rejects.toThrow('前置操作尚未同步')
  })
  it('preserves conflicts instead of applying stale changes', async () => {
    const { tx, setNotebook } = transaction()
    await applyNotebookMutation(tx, 'a', create)
    setNotebook({ id: 'local-book', userId: 'a', name: 'Other device', version: 4, updatedAt: new Date('2026-11-14T03:00:00Z') })
    await expect(applyNotebookMutation(tx, 'a', { ...create, clientMutationId: 'rename', payload: { name: 'Mine', deleted: false, predecessor: 'create' } })).rejects.toThrow('其他设备已修改')
    expect(tx.learningNotebook.update).not.toHaveBeenCalled()
  })
  it('does not resurrect a deleted notebook', async () => {
    const { tx, setNotebook } = transaction()
    setNotebook({ id: 'local-book', userId: 'a', version: 2, updatedAt: new Date(), deletedAt: new Date() })
    await expect(applyNotebookMutation(tx, 'a', create)).rejects.toThrow('学习本已在其他设备删除')
  })
  it('preserves mastery when collecting an already active association from another device', async () => {
    const { tx, setNotebook } = transaction()
    setNotebook({ id: 'book', userId: 'a', version: 0, updatedAt: new Date() })
    tx.expressionItem = { findFirst: vi.fn(async () => ({ id: 'expression', deletedAt: null })) }
    tx.learningNotebookItem.findUnique = vi.fn(async () => ({ masteryStatus: 'mastered', version: 0, updatedAt: new Date() }))
    tx.learningNotebookItem.upsert = vi.fn(async ({ update }: any) => ({ id: 'association', updatedAt: new Date(), ...update }))
    const result = await applyNotebookMutation(tx, 'a', { entityType: 'notebook_item', entityId: 'local-association', clientMutationId: 'collect', payload: {
      notebookId: 'book', deleted: false, intent: 'join', masteryStatus: 'learning', entry: { kind: 'word', text: 'hello' },
    } })
    expect(result.remoteItem.masteryStatus).toBe('mastered')
  })
  it('acknowledges superseded child operations after a notebook deletion', async () => {
    const { tx, setNotebook } = transaction()
    setNotebook({ id: 'local-book', userId: 'a', version: 2, updatedAt: new Date(), deletedAt: new Date() })
    const result = await applyNotebookMutation(tx, 'a', { entityType: 'notebook_item', entityId: 'item', clientMutationId: 'join', payload: { notebookId: 'local-book', deleted: false } })
    expect(result.remoteItem.superseded).toBe(true)
  })
})

describe('server batch push ordering', () => {
  it('applies notebook create then item status in one push via predecessor receipts', async () => {
    const { tx } = transaction()
    tx.expressionItem = {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'expression-1', ...data, deletedAt: null })),
      update: vi.fn(async ({ data }: any) => ({ id: 'expression-1', ...data })),
    }
    tx.learningNotebookItem.findUnique = vi.fn(async () => null)
    tx.learningNotebookItem.upsert = vi.fn(async ({ create }: any) => ({
      id: 'association-1',
      updatedAt: new Date('2026-11-17T01:00:00Z'),
      version: 0,
      ...create,
      expressionItem: { id: 'expression-1', type: 'word', original: 'hello' },
    }))

    const createResult = await applyNotebookMutation(tx, 'a', create)
    expect(createResult.remoteItem.id).toBe('local-book')

    const status = await applyNotebookMutation(tx, 'a', {
      entityType: 'notebook_item',
      entityId: 'local-item',
      clientMutationId: 'status-1',
      payload: {
        notebookId: 'local-book',
        deleted: false,
        intent: 'status',
        masteryStatus: 'reviewing',
        predecessor: 'create',
        entry: { kind: 'word', text: 'hello' },
      },
    })
    expect(status.remoteItem.masteryStatus).toBe('reviewing')
    expect(tx.notebookSyncReceipt.create).toHaveBeenCalledTimes(2)
  })

  it('handles my_unit complete and check_in through SyncService.push', async () => {
    const upsert = vi.fn(async () => ({ id: 'progress' }))
    const checkIn = vi.fn(async () => ({
      date: '2026-11-17',
      earned: 10,
      points: 100,
      isMakeup: false,
      status: { today: '2026-11-17', checkedIn: true },
    }))
    const service = new SyncService(
      { userSceneProgress: { upsert } } as any,
      { checkIn } as any,
    )
    const result = await service.push('user-1', [
      { entityType: 'my_unit', entityId: 'scene-1', operation: 'complete', payload: {}, clientMutationId: 'c1' },
      {
        entityType: 'check_in',
        entityId: '2026-11-17',
        operation: 'create',
        payload: { ownerId: 'user-1', date: '2026-11-17', occurredAt: '2026-11-17T01:00:00Z', timeZone: 'Asia/Shanghai' },
        clientMutationId: 'c2',
      },
    ])
    expect(result.results.map((row) => row.status)).toEqual(['synced', 'synced'])
    expect(upsert).toHaveBeenCalled()
    expect(checkIn).toHaveBeenCalled()
    expect(result.results[1].remoteItem.earned).toBe(10)
  })
})

it('paginates more notebooks than one pull page without skipping', async () => {
  const updatedAt = new Date('2026-11-14T01:00:00Z')
  const data = Array.from({ length: 101 }, (_, index) => ({ id: String(index).padStart(4, '0'), updatedAt }))
  const findMany = vi.fn(async ({ where, take }: any) => {
    if (where.OR?.[0]?.deletedAt) return []
    return data.filter(row => row.updatedAt > where.OR[0].updatedAt.gt ||
      row.updatedAt.getTime() === where.OR[1].updatedAt.getTime() && row.id > where.OR[1].id.gt).slice(0, take)
  })
  const service = new SyncService({ learningNotebook: { findMany } } as any)
  const first = await service.pull('a', {}, ['learningNotebooks'])
  expect(first.changed.learningNotebooks).toHaveLength(100)
  expect(first.hasMore.learningNotebooks).toBe(true)
  const next = await service.pull('a', first.cursors as any, ['learningNotebooks'])
  expect(next.changed.learningNotebooks).toHaveLength(1)
  expect(next.changed.learningNotebooks[0].id).toBe('0100')
  expect(next.hasMore.learningNotebooks).toBe(false)
  expect(findMany.mock.calls.every(([args]: any) => args.where.userId === 'a')).toBe(true)
})

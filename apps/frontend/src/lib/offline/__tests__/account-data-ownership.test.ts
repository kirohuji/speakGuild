import { beforeEach, expect, it, vi } from 'vitest'
import { statisticsDb } from './statistics-sqlite.fixture'
const state = vi.hoisted(() => ({ db: null as any, native: false, directories: new Set<string>() }))
vi.mock('../unified-storage', () => ({ localDb: new Proxy({}, { get: (_, key) => state.db[key] }) }))
vi.mock('@/lib/native', () => ({ isNative: () => state.native }))
vi.mock('../learning-pack.service', () => ({ learningPackService: {} }))
vi.mock('../deferred-pack-asset.service', () => ({ deferredPackAssetService: {} }))
vi.mock('@/lib/local-ai/warmup-embedding-cache.repository', () => ({ warmupEmbeddingCacheRepository: {} }))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Data: 'DATA' }, Filesystem: {
  readdir: vi.fn(async () => ({ files: [...state.directories].map(name => ({ name })) })),
  mkdir: vi.fn(async () => {}),
  rename: vi.fn(async ({ from, to }) => { state.directories.delete(from); state.directories.add(to) }),
  rmdir: vi.fn(async ({ path }) => { state.directories.delete(path) }),
} }))
import { prepareAccountData, clearAccountDataForLogout, AccountDataIsolationError } from '../account-data-ownership'
import { offlineStorageService } from '../offline-storage.service'
import { Filesystem } from '@capacitor/filesystem'
beforeEach(async () => { state.db = (await statisticsDb()).store; state.native = false; state.directories.clear() })
const legacy = { ownerId: null, cachedUserId: null }
const clear = () => offlineStorageService.clearUserData()
const row = { id: 'old-book', kind: 'uncategorized', name: '未分类' }

it('initializes empty storage and durably recognizes the owner if the legacy marker is lost', async () => {
  const clean = vi.fn(clear)
  expect(await prepareAccountData('a', legacy, clean)).toMatchObject({ reused: false })
  await state.db.put('learning_notebooks', row)
  expect(await prepareAccountData('a', legacy, clean)).toMatchObject({ reused: true })
  expect(clean).not.toHaveBeenCalled()
  expect(await state.db.get('learning_notebooks', row.id)).not.toBeNull()
})
it('migrates old same-account data without deleting content or queued operations', async () => {
  await state.db.put('learning_notebooks', row)
  await state.db.put('outbox', { id: 'pending', payload: { ownerId: 'a' } })
  const clean = vi.fn(clear)
  expect(await prepareAccountData('a', { ...legacy, cachedUserId: 'a' }, clean)).toMatchObject({ reused: true })
  expect(clean).not.toHaveBeenCalled()
  expect(await state.db.get('outbox', 'pending')).not.toBeNull()
})
it('uses an unambiguous persisted profile as legacy ownership evidence', async () => {
  await state.db.put('learning_notebooks', row)
  await state.db.put('kv', { id: 'user_profile:a' })
  expect(await prepareAccountData('a', legacy, clear)).toMatchObject({ reused: true })
  expect(await state.db.get('learning_notebooks', row.id)).not.toBeNull()
})
it('quarantines unknown legacy data and recordings before initializing another account', async () => {
  state.native = true; state.directories.add('user-recordings')
  await state.db.put('learning_notebooks', row)
  await state.db.put('kv', { id: 'user-recording:voice', path: 'user-recordings/voice.m4a' })
  const result = await prepareAccountData('b', legacy, clear)
  expect(result.archiveId).toBeTruthy()
  const backup = await state.db.get('kv', `offline-account-archive:${result.archiveId}`)
  expect(backup.tables.learning_notebooks[0]).toMatchObject({ id: row.id, notebook_kind: row.kind })
  expect(JSON.parse(backup.tables.learning_notebooks[0].data).name).toBe(row.name)
  expect(backup.kv).toContainEqual(expect.objectContaining({ id: 'user-recording:voice' }))
  expect(backup.ready).toBe(true)
  expect(state.directories.has(backup.recordingsDirectory)).toBe(true)
  expect(await state.db.list('learning_notebooks')).toEqual([])
  expect((await state.db.get('kv', 'offline-account:owner')).value).toBe('b')
})
it('does not trust the cached session when legacy queued data contradicts it', async () => {
  await state.db.put('outbox', { id: 'a-write', payload: { ownerId: 'a' } })
  const result = await prepareAccountData('b', { ...legacy, cachedUserId: 'b' }, clear)
  expect(result.reused).toBe(false); expect(result.archiveId).toBeTruthy()
  expect(await state.db.list('outbox')).toEqual([])
})
it('blocks account activation on a failed clear and resumes the journal even for the former owner', async () => {
  await prepareAccountData('a', legacy, clear)
  await state.db.put('learning_notebooks', row)
  await expect(prepareAccountData('b', legacy, async () => { throw new Error('disk busy') })).rejects.toBeInstanceOf(AccountDataIsolationError)
  expect((await state.db.get('kv', 'offline-account:owner')).value).toBe('a')
  expect(await state.db.get('kv', 'offline-account:transition')).not.toBeNull()
  const clean = vi.fn(clear)
  await prepareAccountData('a', legacy, clean)
  expect(clean).toHaveBeenCalledOnce()
  expect(await state.db.get('kv', 'offline-account:transition')).toBeNull()
})
it('retains the original quarantine snapshot if cleanup fails halfway through', async () => {
  await state.db.put('learning_notebooks', row)
  await expect(prepareAccountData('b', legacy, async () => {
    await state.db.clear('learning_notebooks'); throw new Error('interrupted')
  })).rejects.toBeInstanceOf(AccountDataIsolationError)
  const pending = await state.db.get('kv', 'offline-account:transition')
  await prepareAccountData('b', legacy, clear)
  expect((await state.db.get('kv', `offline-account-archive:${pending.archiveId}`)).tables.learning_notebooks[0]).toMatchObject({ id: row.id, notebook_kind: row.kind })
})
it('keeps a failed logout journal and removes ownership only after successful cleanup', async () => {
  await prepareAccountData('a', legacy, clear)
  await expect(clearAccountDataForLogout(async () => { throw new Error('disk busy') })).rejects.toBeInstanceOf(AccountDataIsolationError)
  expect((await state.db.get('kv', 'offline-account:owner')).value).toBe('a')
  await clearAccountDataForLogout(clear)
  expect(await state.db.get('kv', 'offline-account:owner')).toBeNull()
  expect(await state.db.get('kv', 'offline-account:transition')).toBeNull()
})
it('does not clear unidentified data if moving its recordings into quarantine fails', async () => {
  state.native = true; state.directories.add('user-recordings')
  await state.db.put('learning_notebooks', row)
  vi.mocked(Filesystem.rename).mockRejectedValueOnce(new Error('no space'))
  const clean = vi.fn(clear)
  await expect(prepareAccountData('b', legacy, clean)).rejects.toBeInstanceOf(AccountDataIsolationError)
  expect(clean).not.toHaveBeenCalled()
  expect(await state.db.get('learning_notebooks', row.id)).not.toBeNull()
  await prepareAccountData('b', legacy, clean)
  expect(clean).toHaveBeenCalledOnce()
})

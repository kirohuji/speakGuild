import { beforeEach, describe, expect, it, vi } from 'vitest'
import { statisticsDb } from './statistics-sqlite.fixture'
const state = vi.hoisted(() => ({ db: null as any, owner: 'a', native: false, disk: new Map<string, string>(), upload: vi.fn(), reference: vi.fn() }))
vi.mock('../unified-storage', () => ({ localDb: new Proxy({}, { get: (_, key) => state.db[key] }) }))
vi.mock('@/providers/auth-session', () => ({ getCurrentSessionSnapshot: () => ({ user: { id: state.owner } }) }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => state.native, convertFileSrc: (url: string) => 'capacitor://localhost/' + url } }))
vi.mock('@/lib/native', () => ({ isNative: () => false }))
vi.mock('@/features/file-assets/api', () => ({ uploadFileToCosAndComplete: state.upload, createFileReference: state.reference }))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Data: 'DATA' }, Filesystem: {
  writeFile: vi.fn(async ({ path, data }: any) => { state.disk.set(path, data) }),
  readFile: vi.fn(async ({ path }: any) => ({ data: state.disk.get(path) })),
  stat: vi.fn(async ({ path }: any) => { if (!state.disk.has(path)) throw new Error('missing'); return { size: state.disk.get(path)!.length } }),
  getUri: vi.fn(async ({ path }: any) => ({ uri: 'file:///' + path })),
  deleteFile: vi.fn(async ({ path }: any) => { state.disk.delete(path) }),
} }))
import { saveUserRecording, resolveLocalRecording, uploadUserRecording, prepareRecordingPayload } from '../user-recordings'
beforeEach(async () => { state.db = (await statisticsDb()).store; state.owner = 'a'; state.native = false; state.disk.clear(); state.upload.mockReset(); state.reference.mockReset(); state.reference.mockResolvedValue(undefined) })

it('persists audio bytes and an upload operation before returning, without network', async () => {
  const reference = await saveUserRecording(new Blob(['voice'], { type: 'audio/webm' }), 'answer.webm')
  expect(reference).toMatch(/^user-recording:\/\//)
  expect(await resolveLocalRecording(reference)).toBe('data:audio/webm;base64,dm9pY2U=')
  expect((await state.db.list('outbox'))[0].status).toBe('pending')
  expect(state.upload).not.toHaveBeenCalled()
})
it('keeps failed uploads and the local recording for a later retry', async () => {
  const reference = await saveUserRecording(new Blob(['voice']))
  state.upload.mockRejectedValueOnce(new Error('offline'))
  await expect(uploadUserRecording(reference)).rejects.toThrow('offline')
  expect((await state.db.list('outbox'))[0].status).toBe('pending')
  expect(await resolveLocalRecording(reference)).toContain('base64,dm9pY2U=')
  state.upload.mockResolvedValueOnce({ id: 'asset-1' })
  expect(await uploadUserRecording(reference)).toBe('asset://asset-1')
  expect(state.reference).toHaveBeenCalledWith('asset-1', 'practice_recording', expect.stringMatching(/^user-recording:/))
  expect((await state.db.list('outbox'))[0].status).toBe('synced')
})
it('does not acknowledge an upload when creating its server reference fails', async () => {
  const reference = await saveUserRecording(new Blob(['voice']))
  state.upload.mockResolvedValue({ id: 'asset-1' }); state.reference.mockRejectedValue(new Error('unbound'))
  await expect(uploadUserRecording(reference)).rejects.toThrow('unbound')
  expect((await state.db.list('outbox'))[0].status).toBe('pending')
})
it('resolves nested and JSON-encoded audio dependencies before record submission', async () => {
  const reference = await saveUserRecording(new Blob(['voice']))
  state.upload.mockResolvedValue({ id: 'asset-1' })
  const payload = await prepareRecordingPayload({ warmupRecord: { items: [{ audioUrl: reference, userAnswer: JSON.stringify({ 0: reference }) }] } })
  expect(payload.warmupRecord.items[0]).toEqual({ audioUrl: 'asset://asset-1', userAnswer: '{"0":"asset://asset-1"}' })
  expect(state.upload).toHaveBeenCalledOnce()
})
it('refuses temporary blob references and recordings belonging to another account', async () => {
  const reference = await saveUserRecording(new Blob(['voice']))
  await expect(prepareRecordingPayload({ audioUrl: 'blob:expired' })).rejects.toThrow('临时录音')
  state.owner = 'b'
  await expect(uploadUserRecording(reference)).rejects.toThrow('本机不可用')
})
it('rolls back metadata if the upload queue cannot be written', async () => {
  const fixture = await statisticsDb(); state.db = fixture.store; fixture.failOutbox(true)
  await expect(saveUserRecording(new Blob(['voice']))).rejects.toThrow('disk full')
  expect((await state.db.list('kv')).filter((row: any) => row.id.startsWith('user-recording:'))).toEqual([])
})

it('stores iOS recordings in persistent app data and uploads from those bytes', async () => {
  state.native = true
  const reference = await saveUserRecording(new Blob(['voice'], { type: 'audio/mp4' }), 'answer.m4a')
  const rows = (await state.db.list('kv')).filter((row: any) => row.id.startsWith('user-recording:'))
  expect(rows[0].path).toMatch(/^user-recordings\/a\//)
  expect(rows[0].base64).toBeUndefined()
  expect(await resolveLocalRecording(reference)).toContain('user-recordings/a/')
  state.upload.mockResolvedValue({ id: 'asset-ios' })
  expect(await uploadUserRecording(reference)).toBe('asset://asset-ios')
  expect(await state.upload.mock.calls[0][0].file.text()).toBe('voice')
  expect(state.disk.size).toBe(1)
})

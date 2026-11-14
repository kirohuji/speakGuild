import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import { createFileReference, uploadFileToCosAndComplete } from '@/features/file-assets/api'
import { createFileAssetReference } from '@/lib/file-asset-reference'
import { localDb } from './unified-storage'
import { createId } from './utils'

export class RecordingDependencyError extends Error { constructor(cause: unknown) { super('录音尚未上传，练习记录已保留', { cause }); this.name = 'RecordingDependencyError' } }

export const LOCAL_RECORDING_SCHEME = 'user-recording://'
type Recording = {
  id: string; ownerId: string; filename: string; mimeType: string; path?: string; base64?: string
  remoteReference?: string; createdAt: string
}
const uploads = new Map<string, Promise<string>>()

async function base64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
function fromBase64(data: string, mimeType: string) {
  return new Blob([Uint8Array.from(atob(data), char => char.charCodeAt(0))], { type: mimeType })
}
async function metadata(reference: string): Promise<Recording> {
  const id = reference.slice(LOCAL_RECORDING_SCHEME.length)
  const row = await localDb.get<Recording>('kv', `user-recording:${id}`)
  if (!row || row.ownerId !== getCurrentSessionSnapshot()?.user?.id) throw new Error('录音在本机不可用')
  return row
}

/** The durable local identity is committed with its upload operation before returning. */
export async function saveUserRecording(blob: Blob, filename = 'recording.webm'): Promise<string> {
  if (!blob.size) throw new Error('录音内容为空')
  const ownerId = getCurrentSessionSnapshot()?.user?.id
  if (!ownerId) throw new Error('请先登录后保存录音')
  const id = createId('recording'), now = new Date().toISOString()
  const row: Recording = { id: `user-recording:${id}`, ownerId, filename, mimeType: blob.type || 'audio/webm', createdAt: now }
  const data = await base64(blob)
  if (Capacitor.isNativePlatform()) {
    row.path = `user-recordings/${encodeURIComponent(ownerId)}/${id}`
    await Filesystem.writeFile({ path: row.path, directory: Directory.Data, data, recursive: true })
  } else row.base64 = data
  const queueId = `recording-upload:${id}`
  try {
    await localDb.commitLocalWrites([
      { table: 'kv', value: row },
      { table: 'outbox', value: { id: queueId, entityType: 'user_recording', entityId: id, operation: 'create',
        payload: { reference: `${LOCAL_RECORDING_SCHEME}${id}` }, clientMutationId: queueId,
        revision: 1, status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, nextRetryAt: now } },
    ])
  } catch (error) {
    if (row.path) await Filesystem.deleteFile({ path: row.path, directory: Directory.Data }).catch(() => undefined)
    throw error
  }
  return `${LOCAL_RECORDING_SCHEME}${id}`
}

export async function resolveLocalRecording(reference: string): Promise<string> {
  if (!reference.startsWith(LOCAL_RECORDING_SCHEME)) return reference
  const row = await metadata(reference)
  if (row.path) {
    try {
      await Filesystem.stat({ path: row.path, directory: Directory.Data })
      const uri = await Filesystem.getUri({ path: row.path, directory: Directory.Data })
      return Capacitor.convertFileSrc(uri.uri)
    } catch { if (row.remoteReference) return row.remoteReference; throw new Error('本机录音文件缺失') }
  }
  if (row.base64) return `data:${row.mimeType};base64,${row.base64}`
  if (row.remoteReference) return row.remoteReference
  throw new Error('录音在本机不可用')
}

export async function uploadUserRecording(reference: string): Promise<string> {
  if (!reference.startsWith(LOCAL_RECORDING_SCHEME)) return reference
  const existing = uploads.get(reference)
  if (existing) return existing
  const work = (async () => {
    const row = await metadata(reference)
    if (!row.remoteReference) {
      let blob: Blob
      if (row.path) {
        const { data } = await Filesystem.readFile({ path: row.path, directory: Directory.Data })
        blob = data instanceof Blob ? data : fromBase64(data, row.mimeType)
      } else if (row.base64) blob = fromBase64(row.base64, row.mimeType)
      else throw new Error('录音文件缺失，待同步记录已保留')
      const asset = await uploadFileToCosAndComplete({ file: new File([blob], row.filename, { type: row.mimeType }), group: 'user_recording' })
      if (getCurrentSessionSnapshot()?.user?.id !== row.ownerId) throw new Error('录音所属账号已切换，上传状态已保留')
      // A recording is not delivered until its server reference protects it from orphan cleanup.
      await createFileReference(asset.id, 'practice_recording', row.id)
      row.remoteReference = createFileAssetReference(asset.id)
      await localDb.put('kv', row)
    }
    const id = reference.slice(LOCAL_RECORDING_SCHEME.length)
    await localDb.patchOutbox(`recording-upload:${id}`, 1, 'synced')
    return row.remoteReference!
  })()
  uploads.set(reference, work)
  try { return await work } finally { uploads.delete(reference) }
}

/** Resolve recording dependencies before submitting any record; never upload a local-only URI. */
export async function prepareRecordingPayload<T>(payload: T): Promise<T> {
  if (typeof payload === 'string') {
    if (payload.startsWith(LOCAL_RECORDING_SCHEME)) {
      try { return await uploadUserRecording(payload) as T }
      catch (error) { throw new RecordingDependencyError(error) }
    }
    // Sentence decomposition historically encoded its per-level recording map as JSON text.
    if (payload.includes(LOCAL_RECORDING_SCHEME) && /^[\[{]/.test(payload)) {
      let parsed: unknown
      try { parsed = JSON.parse(payload) } catch { throw new Error('录音关联数据无法读取，已保留待同步操作') }
      return JSON.stringify(await prepareRecordingPayload(parsed)) as T
    }
    if (payload.startsWith('blob:')) throw new Error('记录仍引用临时录音，已保留待同步操作')
    return payload
  }
  if (Array.isArray(payload)) return await Promise.all(payload.map(prepareRecordingPayload)) as T
  if (payload && typeof payload === 'object') return Object.fromEntries(await Promise.all(Object.entries(payload).map(async ([key, value]) => [key, await prepareRecordingPayload(value)]))) as T
  return payload
}

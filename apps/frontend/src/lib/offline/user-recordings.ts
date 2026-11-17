import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import {
  createFileReference,
  createFileAssetReference,
  uploadBatchRecordingsZip,
  uploadFileToCosAndComplete,
} from '@/features/file-assets/api'
import { digestSync } from '@/lib/offline/sha256'
import { localDb } from './unified-storage'
import { createId } from './utils'
import type { SyncOutboxItem } from './sync-outbox'

export class RecordingDependencyError extends Error { constructor(cause: unknown) { super('录音尚未上传，练习记录已保留', { cause }); this.name = 'RecordingDependencyError' } }

export const LOCAL_RECORDING_SCHEME = 'user-recording://'
type Recording = {
  id: string; ownerId: string; filename: string; mimeType: string; path?: string; base64?: string
  remoteReference?: string; createdAt: string
}
const uploads = new Map<string, Promise<string>>()

const BATCH_MAX_FILES = 20
const BATCH_MAX_BYTES = 40 * 1024 * 1024

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

async function readRecordingBlob(row: Recording): Promise<Blob> {
  if (row.path) {
    const { data } = await Filesystem.readFile({ path: row.path, directory: Directory.Data })
    return data instanceof Blob ? data : fromBase64(data, row.mimeType)
  }
  if (row.base64) return fromBase64(row.base64, row.mimeType)
  throw new Error('录音文件缺失，待同步记录已保留')
}

function extensionFor(filename: string, mimeType: string) {
  const fromName = filename.includes('.') ? filename.split('.').pop() : ''
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName.toLowerCase()
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  return 'webm'
}

/** Collect unique local recording ids from a nested payload. */
export function collectLocalRecordingIds(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.startsWith(LOCAL_RECORDING_SCHEME)) {
      into.add(value.slice(LOCAL_RECORDING_SCHEME.length))
    } else if (value.includes(LOCAL_RECORDING_SCHEME) && /^[\[{]/.test(value)) {
      try { collectLocalRecordingIds(JSON.parse(value), into) } catch { /* ignore */ }
    }
    return into
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLocalRecordingIds(item, into)
    return into
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectLocalRecordingIds(child, into)
  }
  return into
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

/**
 * Drop a durable local recording that was never attached to a submitted answer.
 * Safe no-op for non-local references or missing rows.
 */
export async function discardUserRecording(reference: string | null | undefined): Promise<void> {
  if (!reference?.startsWith(LOCAL_RECORDING_SCHEME)) return
  const id = reference.slice(LOCAL_RECORDING_SCHEME.length)
  const row = await localDb.get<Recording>('kv', `user-recording:${id}`)
  if (row?.path) {
    await Filesystem.deleteFile({ path: row.path, directory: Directory.Data }).catch(() => undefined)
  }
  await localDb.commitLocalWrites([
    { table: 'kv', deleteId: `user-recording:${id}` },
    { table: 'outbox', deleteId: `recording-upload:${id}` },
  ])
  uploads.delete(reference)
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
      const blob = await readRecordingBlob(row)
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

type PackEntry = {
  localId: string
  reference: string
  row: Recording
  blob: Blob
  sha256: string
  pathInZip: string
}

async function listPendingRecordingIds(): Promise<string[]> {
  const ids = new Set<string>()
  const outbox = await localDb.list<SyncOutboxItem>('outbox')
  for (const item of outbox) {
    if (item.status !== 'pending' && item.status !== 'failed') continue
    if (item.entityType === 'user_recording') {
      const reference = (item.payload as { reference?: string } | undefined)?.reference
      if (reference?.startsWith(LOCAL_RECORDING_SCHEME)) {
        ids.add(reference.slice(LOCAL_RECORDING_SCHEME.length))
      } else if (item.entityId) {
        ids.add(item.entityId)
      }
      continue
    }
    if (['daily_practice', 'practice_turn', 'topic_submission'].includes(item.entityType)) {
      collectLocalRecordingIds(item.payload, ids)
    }
  }
  return [...ids]
}

async function buildRecordingPack(localIds: string[]): Promise<PackEntry[]> {
  const ownerId = getCurrentSessionSnapshot()?.user?.id
  if (!ownerId) return []
  const entries: PackEntry[] = []
  for (const localId of localIds) {
    const reference = `${LOCAL_RECORDING_SCHEME}${localId}`
    try {
      const row = await metadata(reference)
      if (row.remoteReference) {
        await localDb.patchOutbox(`recording-upload:${localId}`, 1, 'synced')
        continue
      }
      const blob = await readRecordingBlob(row)
      const sha256 = digestSync(await blob.arrayBuffer())
      const ext = extensionFor(row.filename, row.mimeType)
      entries.push({
        localId,
        reference,
        row,
        blob,
        sha256,
        pathInZip: `files/${localId}.${ext}`,
      })
    } catch {
      // Leave for single-upload fallback / RecordingDependencyError on dependents.
    }
  }
  return entries
}

async function packAndUploadChunk(chunk: PackEntry[]): Promise<number> {
  if (chunk.length === 0) return 0
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  const manifest = {
    entries: chunk.map((entry) => ({
      localId: entry.localId,
      path: entry.pathInZip,
      filename: entry.row.filename,
      mimeType: entry.row.mimeType,
      sha256: entry.sha256,
      bizId: entry.row.id,
    })),
  }
  await writer.add('manifest.json', new BlobReader(new Blob([JSON.stringify(manifest)], { type: 'application/json' })))
  for (const entry of chunk) {
    await writer.add(entry.pathInZip, new BlobReader(entry.blob))
  }
  const zip = await writer.close()
  const { results } = await uploadBatchRecordingsZip(zip)
  let synced = 0
  const byId = new Map(results.map((row) => [row.localId, row]))
  for (const entry of chunk) {
    const result = byId.get(entry.localId)
    if (result?.status !== 'synced' || !result.assetId) continue
    if (getCurrentSessionSnapshot()?.user?.id !== entry.row.ownerId) {
      throw new Error('录音所属账号已切换，上传状态已保留')
    }
    entry.row.remoteReference = createFileAssetReference(result.assetId)
    await localDb.put('kv', entry.row)
    await localDb.patchOutbox(`recording-upload:${entry.localId}`, 1, 'synced')
    synced += 1
  }
  return synced
}

/**
 * Pre-flush: pack pending local recordings into zip chunks and upload once per chunk.
 * Returns how many recordings were acknowledged. Failures leave rows pending for single-file fallback.
 */
export async function uploadPendingRecordingsZip(): Promise<{ attempted: number; synced: number }> {
  const localIds = await listPendingRecordingIds()
  if (localIds.length === 0) return { attempted: 0, synced: 0 }
  const pack = await buildRecordingPack(localIds)
  if (pack.length === 0) return { attempted: 0, synced: 0 }

  let synced = 0
  let chunk: PackEntry[] = []
  let chunkBytes = 0

  const flushChunk = async () => {
    if (chunk.length === 0) return
    try {
      synced += await packAndUploadChunk(chunk)
    } catch {
      // Fall back to per-file upload during replayItem / prepareRecordingPayload.
    }
    chunk = []
    chunkBytes = 0
  }

  for (const entry of pack) {
    const nextBytes = chunkBytes + entry.blob.size
    if (chunk.length >= BATCH_MAX_FILES || (chunk.length > 0 && nextBytes > BATCH_MAX_BYTES)) {
      await flushChunk()
    }
    chunk.push(entry)
    chunkBytes += entry.blob.size
  }
  await flushChunk()
  return { attempted: pack.length, synced }
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

import { assetCacheService, type AssetRef } from './asset-cache.service'
import { deferredLookupKeys, deferredPackAssetService, learningPackZipPath, type DeferredPackAsset } from './deferred-pack-asset.service'
import { digestBuffer } from './sha256-worker.service'
import { learningApi } from '@/features/learning/api/learning-api'
import { readStoredTopicDetail, readStoredUnitDetail, writePackProjection } from './learning-pack-read-model'
import { localDb } from './unified-storage'
import { packAuditService, type PackAuditAction } from './pack-audit.service'
import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry } from '@zip.js/zip.js'
import { learningContentRepository } from './learning-content.repository'
import { Capacitor } from '@capacitor/core'
import { FileTransfer } from '@capacitor/file-transfer'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Network } from '@capacitor/network'
import { getBearerToken } from '@/features/auth/client'
import { createFileAssetReference, fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import write_blob from 'capacitor-blob-writer'
import { createLogger } from './logger'

const logger = createLogger('learning-pack')

function learningPackDownloadUrl(unitId: string) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu'
  return new URL(`${base.replace(/\/$/, '')}/learning/units/${encodeURIComponent(unitId)}/download-pack`, window.location.origin).toString()
}

export interface LearningPackManifest {
  packId: string
  version: number
  title: string
  /** Only practice-mode packs supply Today practice items. */
  packageType?: string
  contentMode?: string
  updatedAt: string
  units: string[]
  topics: string[]
  vocabularies: string[]
  chunks: string[]
  sentencePatterns: string[]
  storyEpisodes: string[]
  inkScripts: string[]
  assets: AssetRef[]
  files?: Record<string, string>
  formatVersion?: number
  failedAssets?: Array<{ url: string; reason: string }>
}

export interface InstalledLearningPack {
  id: string
  packId: string
  version: number
  title: string
  manifest: LearningPackManifest
  status: 'installing' | 'installed' | 'failed'
  installedAt: string | null
  updatedAt: string
  lastError?: string
}

export interface LearningPackInstallProgress {
  label?: string
  current?: number
  total?: number
  currentItem?: string
}

export type LearningPackInstallProgressHandler = (
  step: string,
  progress: number,
  detail?: LearningPackInstallProgress,
) => void

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Learning pack download cancelled', 'AbortError')
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}

function pushUrlAsset(assets: AssetRef[], url?: string | null, role?: AssetRef['role']) {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return
  if (assets.some((asset) => asset.url === url)) return
  assets.push({ url, role })
}

function debugError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return error
}

function debugErrorMessage(error: unknown) {
  const detail = debugError(error)
  return typeof detail === 'string' ? detail : JSON.stringify(detail)
}

function createTimer(_scope?: string) {
  return {
    lap(_label: string, _extra?: Record<string, unknown>) {},
    done(_extra?: Record<string, unknown>) {},
  }
}

function summarizeZipEntries(entries: Map<string, Entry>) {
  const paths = [...entries.keys()]
  return {
    count: paths.length,
    hasPackManifest: entries.has('pack-manifest.json'),
    hasChecksums: entries.has('checksums.json'),
    hasScene: entries.has('content/scene.json'),
    topicCount: paths.filter((path) => path.startsWith('content/topics/') && path.endsWith('.json')).length,
    inkCount: paths.filter((path) => path.startsWith('content/inks/') && path.endsWith('.json')).length,
    assetCount: paths.filter(isAssetPath).length,
    firstPaths: paths.slice(0, 30),
  }
}

async function persistUnitContent(unitDetail: any, topicDetails: any[]) {
  let inkCount = 0
  for (const topicDetail of topicDetails) {
    if (!topicDetail?.inkScript) continue
    await localDb.put('ink_scripts', {
      id: topicDetail.inkScript.id,
      topicId: topicDetail.topic.id,
      unitId: unitDetail.id,
      ...topicDetail.inkScript,
      updatedAt: new Date().toISOString(),
    })
    inkCount++
  }
  await writePackProjection(unitDetail, topicDetails)
  logger.info(`  SQLite: ${topicDetails.length} 个 topic, ${inkCount} 个 ink_script，文档和流水线分行存放`)
}

/**
 * Compute SHA-256 digest of a buffer.
 *
 * Always use the project's pure-JS implementation. Capacitor live reload can
 * run from HTTP, where Web Crypto is unavailable; a single implementation also
 * guarantees identical hashes in development and production.
 */
async function digest(buffer: ArrayBuffer): Promise<string> {
  return digestBuffer(buffer)
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'file'
}

function isAssetPath(path: string) {
  return normalizeZipPath(path).startsWith('assets/')
}

/** Preserve the persisted asset:// URL (including a possible suffix) that UI playback uses. */
function collectContentAssetUrls(value: unknown, output = new Map<string, string>()): Map<string, string> {
  if (typeof value === 'string') {
    const id = fileAssetIdFromUrl(value)
    if (id && !output.has(id)) output.set(id, value)
    return output
  }
  if (Array.isArray(value)) {
    for (const item of value) collectContentAssetUrls(item, output)
    return output
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectContentAssetUrls(item, output)
  }
  return output
}

interface DownloadedUnitZip {
  blob: Blob
  /** Native FileTransfer destination, promoted by rename once the manifest is trusted. */
  temporaryPath?: string
}

async function retainPackZip(packId: string, version: number, zip: DownloadedUnitZip) {
  const directory = `learning-packs/${packId}`
  const partial = `${directory}/${version}.zip.partial`
  const target = learningPackZipPath(packId, version)
  const previous = `${directory}/${version}.zip.previous`

  // A failed same-version reinstall must never remove the only source archive
  // of already-installed deferred pronunciations. Repair an interrupted prior
  // exchange before starting a new one.
  const targetExists = await Filesystem.stat({ path: target, directory: Directory.Data }).then(() => true).catch(() => false)
  const previousExists = await Filesystem.stat({ path: previous, directory: Directory.Data }).then(() => true).catch(() => false)
  if (!targetExists && previousExists) {
    await Filesystem.rename({ from: previous, to: target, directory: Directory.Data })
  } else if (targetExists && previousExists) {
    await Filesystem.deleteFile({ path: previous, directory: Directory.Data }).catch(() => undefined)
  }

  // Both download paths first produce a same-directory partial file.
  await Filesystem.deleteFile({ path: partial, directory: Directory.Data }).catch(() => undefined)
  if (zip.temporaryPath) {
    await Filesystem.rename({ from: zip.temporaryPath, to: partial, directory: Directory.Data })
  } else {
    await write_blob({ path: partial, directory: Directory.Data, blob: zip.blob, recursive: true })
  }

  const hasCurrent = await Filesystem.stat({ path: target, directory: Directory.Data }).then(() => true).catch(() => false)
  if (hasCurrent) await Filesystem.rename({ from: target, to: previous, directory: Directory.Data })
  try {
    await Filesystem.rename({ from: partial, to: target, directory: Directory.Data })
  } catch (error) {
    if (hasCurrent) await Filesystem.rename({ from: previous, to: target, directory: Directory.Data }).catch(() => undefined)
    throw error
  }
  if (hasCurrent) await Filesystem.deleteFile({ path: previous, directory: Directory.Data }).catch(() => undefined)
}

async function removePartialPackZips(packId: string) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const listing = await Filesystem.readdir({ path: `learning-packs/${packId}`, directory: Directory.Data }) as any
    await Promise.all((listing.files ?? [])
      .filter((file: any) => String(file.name ?? '').endsWith('.partial'))
      .map((file: any) => Filesystem.deleteFile({
        path: `learning-packs/${packId}/${file.name}`,
        directory: Directory.Data,
      }).catch(() => undefined)))
  } catch {
    // No retained archive directory yet.
  }
}

async function restoreReferencedPreviousPackZips(packId: string) {
  if (!Capacitor.isNativePlatform()) return
  const deferred = await localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'pack_id', packId)
  for (const version of new Set(deferred.filter((asset) => asset.status === 'deferred').map((asset) => asset.sourceZipVersion))) {
    const target = learningPackZipPath(packId, version)
    const previous = `learning-packs/${packId}/${version}.zip.previous`
    const targetExists = await Filesystem.stat({ path: target, directory: Directory.Data }).then(() => true).catch(() => false)
    if (targetExists) continue
    const previousExists = await Filesystem.stat({ path: previous, directory: Directory.Data }).then(() => true).catch(() => false)
    if (previousExists) await Filesystem.rename({ from: previous, to: target, directory: Directory.Data }).catch(() => undefined)
  }
}

async function pruneUnreferencedPackZips(packId: string) {
  if (!Capacitor.isNativePlatform()) return
  const [pack, deferred] = await Promise.all([
    localDb.get<InstalledLearningPack>('downloaded_packs', packId),
    localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'pack_id', packId),
  ])
  const retainedVersions = new Set<number>([
    ...(pack?.status === 'installed' ? [pack.version] : []),
    ...deferred.filter((asset) => asset.status === 'deferred').map((asset) => asset.sourceZipVersion),
  ])
  try {
    const listing = await Filesystem.readdir({ path: `learning-packs/${packId}`, directory: Directory.Data }) as any
    await Promise.all((listing.files ?? []).map(async (file: any) => {
      const name = String(file.name ?? '')
      const versionMatch = name.match(/^(\d+)\.zip$/)
      const previousMatch = name.match(/^(\d+)\.zip\.previous$/)
      // A failed restore leaves the only copy under .previous. Keep it while
      // deferred rows still reference that version and the official zip is absent.
      if (previousMatch && retainedVersions.has(Number(previousMatch[1]))) {
        const officialExists = await Filesystem.stat({
          path: learningPackZipPath(packId, Number(previousMatch[1])),
          directory: Directory.Data,
        }).then(() => true).catch(() => false)
        if (!officialExists) return
      }
      if (name.endsWith('.partial') || previousMatch || (versionMatch && !retainedVersions.has(Number(versionMatch[1])))) {
        await Filesystem.deleteFile({ path: `learning-packs/${packId}/${name}`, directory: Directory.Data }).catch(() => undefined)
      }
    }))
  } catch {
    // Nothing to prune.
  }
}

async function cleanupObsoletePackAssetRefs(packId: string, manifest: LearningPackManifest) {
  const declared = new Set((manifest.assets ?? []).map((asset) => asset.sha256).filter(Boolean))
  const refs = await localDb.findByIndex<any>('asset_refs', 'pack_id', packId)
  for (const ref of refs) {
    if (declared.has(ref.sha256)) continue
    await localDb.delete('asset_refs', ref.id)
    const remaining = await localDb.findByIndex<any>('asset_refs', 'sha256', ref.sha256)
    if (remaining.length === 0) await assetCacheService.remove(ref.sha256).catch(() => undefined)
  }
}

/** 从文件路径或 URL 提取扩展名 */
function extensionFrom(urlOrPath: string, mimeType?: string | null) {
  const match = urlOrPath.match(/\.([a-z0-9]{2,5})$/i)
  if (match) return match[1].toLowerCase()
  if (mimeType?.includes('png')) return 'png'
  if (mimeType?.includes('jpeg') || mimeType?.includes('jpg')) return 'jpg'
  if (mimeType?.includes('webp')) return 'webp'
  if (mimeType?.includes('mpeg')) return 'mp3'
  return 'bin'
}

async function readEntryText(entry: Entry) {
  const readable = entry as Entry & { getData?: (writer: TextWriter) => Promise<string> }
  if (!readable.getData) throw new Error(`Zip entry is not readable: ${entry.filename}`)
  return readable.getData(new TextWriter())
}

async function readEntryBuffer(entry: Entry) {
  const readable = entry as Entry & { getData?: (writer: BlobWriter) => Promise<Blob> }
  if (!readable.getData) throw new Error(`Zip entry is not readable: ${entry.filename}`)
  const blob = await readable.getData(new BlobWriter())
  return blob.arrayBuffer()
}

async function readJsonEntry<T = any>(entries: Map<string, Entry>, path: string): Promise<T> {
  const entry = entries.get(path)
  if (!entry) throw new Error(`Pack is missing ${path}`)
  return JSON.parse(await readEntryText(entry)) as T
}

async function verifyEntry(path: string, buffer: ArrayBuffer, checksums?: Record<string, string>) {
  const expected = checksums?.[path]
  if (!expected) return

  const actual = await digest(buffer)
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Pack file checksum mismatch: ${path}`)
  }
}

async function readPackContentFromEntries(
  entries: Map<string, Entry>,
  manifest: LearningPackManifest,
  checksums?: Record<string, string>,
) {
  const sceneEntry = entries.get('content/scene.json')
  let unitDetail: any
  if (sceneEntry) {
    const sceneText = await readEntryText(sceneEntry)
    await verifyEntry('content/scene.json', new TextEncoder().encode(sceneText).buffer, checksums)
    unitDetail = JSON.parse(sceneText)
  } else {
    unitDetail = await readStoredUnitDetail(manifest.packId)
  }
  if (!unitDetail) throw new Error('Delta pack cannot reconstruct content/scene.json')

  const topicDetails: any[] = []
  for (const topicId of manifest.topics ?? []) {
    const path = `content/topics/${safeFilePart(topicId)}.json`
    const topicEntry = entries.get(path)
    if (topicEntry) {
      const text = await readEntryText(topicEntry)
      await verifyEntry(path, new TextEncoder().encode(text).buffer, checksums)
      topicDetails.push(JSON.parse(text))
      continue
    }

    const cachedDetail = await readStoredTopicDetail(topicId)
    if (!cachedDetail) throw new Error(`Delta pack cannot reconstruct topic content: ${topicId}`)
    topicDetails.push(cachedDetail)
  }

  return { unitDetail, topicDetails }
}

async function persistInstalledRecord(manifest: LearningPackManifest): Promise<InstalledLearningPack> {
  const now = new Date().toISOString()
  const installed: InstalledLearningPack = {
    id: manifest.packId,
    packId: manifest.packId,
    version: manifest.version,
    title: manifest.title,
    manifest,
    status: 'installed',
    installedAt: now,
    updatedAt: now,
  }
  logger.info('persist installed downloaded_packs input', {
    packId: installed.packId,
    version: installed.version,
    manifestVersion: installed.manifest?.version,
    title: installed.title,
    status: installed.status,
    installedAt: installed.installedAt,
  })
  await localDb.put('downloaded_packs', installed)
  const saved = await localDb.get<InstalledLearningPack>('downloaded_packs', manifest.packId)
  logger.info('persist installed downloaded_packs saved', {
    packId: saved?.packId,
    version: saved?.version,
    manifestVersion: saved?.manifest?.version,
    title: saved?.title,
    status: saved?.status,
    installedAt: saved?.installedAt,
    updatedAt: saved?.updatedAt,
  })
  return installed
}

async function recordPackAudit(input: {
  packId: string
  action: PackAuditAction
  version: number | null
  previousVersion: number | null
  title?: string
  updateMode?: 'full' | 'delta'
}): Promise<void> {
  try {
    await packAuditService.record(input)
    await packAuditService.cleanup()
  } catch (error) {
    // Auditing must never turn a completed package operation into a failure.
    logger.warn('learning-pack audit write failed', { ...input, error: debugError(error) })
  }
}

type PackOperationKind = 'install' | 'update' | 'uninstall'

interface PackStateSnapshot {
  pack: InstalledLearningPack | null
  unitDetails: any[]
  inkScripts: any[]
  contentRefs: any[]
  vocabularies: any[]
  chunks: any[]
  patterns: any[]
  assetRefs: any[]
  deferredAssets: DeferredPackAsset[]
}

interface PackOperationJournal {
  id: string
  packId: string
  kind: PackOperationKind
  phase: 'prepared' | 'committing'
  snapshot: PackStateSnapshot
  createdAt: string
  updatedAt: string
}

function operationJournalId(packId: string) {
  return `learning-pack-operation:${packId}`
}

const PACK_GC_ID_PREFIX = 'learning-pack-gc:'

type PackGcJobStatus = 'pending' | 'running'

interface PackGcJob {
  id: string
  packId: string
  filesToRemove: string[]
  version?: number
  title?: string
  createdAt: string
  status: PackGcJobStatus
}

function packGcJobId(packId: string) {
  return `${PACK_GC_ID_PREFIX}${packId}`
}

async function listPackGcJobs(): Promise<PackGcJob[]> {
  return (await localDb.list<PackGcJob>('kv'))
    .filter((item) => typeof item?.id === 'string' && item.id.startsWith(PACK_GC_ID_PREFIX))
}

async function putPackGcJob(job: PackGcJob): Promise<void> {
  await localDb.put('kv', job)
}

async function deletePackGcJob(packId: string): Promise<void> {
  await localDb.delete('kv', packGcJobId(packId))
}

async function getPackGcJob(packId: string): Promise<PackGcJob | null> {
  return (await localDb.get<PackGcJob>('kv', packGcJobId(packId))) ?? null
}

let packGcDrainPromise: Promise<void> | null = null

async function runPackGcJob(job: PackGcJob): Promise<void> {
  const timer = createTimer(`learning-pack:gc:${job.packId}`)
  logger.info(`[gc:${job.packId}] start`, {
    files: job.filesToRemove.length,
    status: job.status,
    title: job.title,
    version: job.version,
  })
  await putPackGcJob({ ...job, status: 'running' })

  await deferredPackAssetService.discardPack(job.packId)
  let deletedFiles = 0
  for (const shaBatch of chunkArray([...new Set(job.filesToRemove)], 8)) {
    const results = await Promise.allSettled(shaBatch.map((sha256) => assetCacheService.remove(sha256)))
    for (const result of results) {
      if (result.status === 'fulfilled') deletedFiles++
      else logger.warn('asset garbage collection failed', result.reason)
    }
  }
  if (Capacitor.isNativePlatform()) {
    await Filesystem.rmdir({
      path: `learning-packs/${job.packId}`,
      directory: Directory.Data,
      recursive: true,
    }).catch(() => undefined)
  }
  timer.lap('delete asset files', { deletedFiles, queued: job.filesToRemove.length })

  await finishPackOperation(job.packId)
  await deletePackGcJob(job.packId)
  await recordPackAudit({
    packId: job.packId,
    action: 'uninstall',
    version: job.version ?? null,
    previousVersion: job.version ?? null,
    title: job.title,
  })
  timer.done({ packId: job.packId, title: job.title, version: job.version })
  logger.info(`🗑️ 已完成后台 GC: ${job.packId}`)
}

/** Ensure prior uninstall GC finished before reusing the same packId directory. */
async function awaitPackGcBeforeInstall(packId: string): Promise<void> {
  const hasBlockingState = async () => {
    const job = await getPackGcJob(packId)
    if (job) return true
    const journal = await localDb.get<PackOperationJournal>('kv', operationJournalId(packId))
    return Boolean(journal && journal.kind === 'uninstall' && journal.phase === 'committing')
  }

  if (!(await hasBlockingState())) return

  logger.info(`[install:${packId}] waiting for pending pack GC`)
  await drainPackGcQueueInternal()
  if (await hasBlockingState()) {
    // Force one more pass in case a job was enqueued mid-drain.
    await drainPackGcQueueInternal()
  }
  if (await hasBlockingState()) {
    throw new Error('正在清理旧学习包数据，请稍后再试')
  }
}

async function drainPackGcQueueInternal(): Promise<void> {
  if (packGcDrainPromise) return packGcDrainPromise
  packGcDrainPromise = (async () => {
    try {
      // Loop until empty so jobs enqueued while a drain is running still finish.
      for (;;) {
        const jobs = await listPackGcJobs()
        if (jobs.length === 0) return
        logger.info(`[gc] draining ${jobs.length} pack GC job(s)`)
        let hadFailure = false
        for (const job of jobs) {
          try {
            await runPackGcJob(job)
          } catch (error) {
            hadFailure = true
            logger.warn(`[gc:${job.packId}] failed; will retry later`, debugError(error))
            await putPackGcJob({ ...job, status: 'pending' }).catch(() => undefined)
          }
        }
        if (hadFailure) return
      }
    } finally {
      packGcDrainPromise = null
    }
  })()
  return packGcDrainPromise
}

let packAssetMaterializePromise: Promise<void> | null = null

async function hasDeferredPackAssets(packId?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  if (packId) {
    const rows = await localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'pack_id', packId)
    return rows.some((row) => row.status === 'deferred')
  }
  const rows = await localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'status', 'deferred')
  return rows.length > 0
}

async function drainPackAssetMaterializeQueueInternal(packId?: string): Promise<void> {
  // Wait out an in-flight drain, then start another pass if new deferred rows
  // were enqueued while it was already finishing (install raced with recover).
  if (packAssetMaterializePromise) await packAssetMaterializePromise
  if (!(await hasDeferredPackAssets(packId))) return
  if (packAssetMaterializePromise) return drainPackAssetMaterializeQueueInternal(packId)

  packAssetMaterializePromise = (async () => {
    try {
      // Never extract into a pack directory that GC still owns.
      await drainPackGcQueueInternal()
      if (!Capacitor.isNativePlatform()) return
      logger.info('[materialize] draining deferred pack assets', { packId: packId ?? 'all' })
      await deferredPackAssetService.materializePending(packId)
    } catch (error) {
      logger.warn('[materialize] drain failed; will retry later', debugError(error))
    } finally {
      packAssetMaterializePromise = null
    }
  })()
  await packAssetMaterializePromise
  if (await hasDeferredPackAssets(packId)) {
    await drainPackAssetMaterializeQueueInternal(packId)
  }
}

async function snapshotPackState(packId: string): Promise<PackStateSnapshot> {
  const [pack, indexedDetails, rootDetail, inkScripts, contentRefs, assetRefs, deferredAssets] = await Promise.all([
    localDb.get<InstalledLearningPack>('downloaded_packs', packId),
    localDb.findByIndex<any>('downloaded_unit_details', 'unit_id', packId),
    localDb.get<any>('downloaded_unit_details', packId),
    localDb.findByIndex<any>('ink_scripts', 'unit_id', packId),
    localDb.findByIndex<any>('offline_content_refs', 'pack_id', packId),
    localDb.findByIndex<any>('asset_refs', 'pack_id', packId),
    localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'pack_id', packId),
  ])
  const unitDetails = [...indexedDetails]
  if (rootDetail && !unitDetails.some((item) => item.id === rootDetail.id)) unitDetails.push(rootDetail)

  const idsByKind = {
    vocab: [...new Set(contentRefs.filter((ref) => ref.kind === 'vocab').map((ref) => String(ref.contentId)))],
    chunk: [...new Set(contentRefs.filter((ref) => ref.kind === 'chunk').map((ref) => String(ref.contentId)))],
    pattern: [...new Set(contentRefs.filter((ref) => ref.kind === 'pattern').map((ref) => String(ref.contentId)))],
  }
  const [vocabularies, chunks, patterns] = await Promise.all([
    Promise.all(idsByKind.vocab.map((id) => localDb.get<any>('offline_vocabularies', id))).then((items) => items.filter(Boolean)),
    Promise.all(idsByKind.chunk.map((id) => localDb.get<any>('offline_chunks', id))).then((items) => items.filter(Boolean)),
    Promise.all(idsByKind.pattern.map((id) => localDb.get<any>('offline_patterns', id))).then((items) => items.filter(Boolean)),
  ])
  return { pack, unitDetails, inkScripts, contentRefs, vocabularies, chunks, patterns, assetRefs, deferredAssets }
}

async function beginPackOperation(packId: string, kind: PackOperationKind): Promise<void> {
  const id = operationJournalId(packId)
  const existing = await localDb.get<PackOperationJournal>('kv', id)
  if (existing) await restorePackOperation(existing)
  const now = new Date().toISOString()
  await localDb.put<PackOperationJournal>('kv', {
    id,
    packId,
    kind,
    phase: 'prepared',
    snapshot: await snapshotPackState(packId),
    createdAt: now,
    updatedAt: now,
  })
}

async function markPackOperationCommitting(packId: string): Promise<void> {
  const id = operationJournalId(packId)
  const journal = await localDb.get<PackOperationJournal>('kv', id)
  if (journal) await localDb.put('kv', { ...journal, phase: 'committing', updatedAt: new Date().toISOString() })
}

async function restorePackOperation(journal: PackOperationJournal): Promise<void> {
  const { packId, snapshot } = journal
  await learningContentRepository.removePackContentIndex(packId)
  await localDb.deleteByIndex('downloaded_unit_details', 'unit_id', packId)
  await localDb.delete('downloaded_unit_details', packId)
  await localDb.deleteByIndex('ink_scripts', 'unit_id', packId)
  await localDb.deleteByIndex('asset_refs', 'pack_id', packId)
  await localDb.deleteByIndex('deferred_pack_assets', 'pack_id', packId)
  await localDb.delete('downloaded_packs', packId)

  if (snapshot.vocabularies.length > 0) await localDb.putMany('offline_vocabularies', snapshot.vocabularies)
  if (snapshot.chunks.length > 0) await localDb.putMany('offline_chunks', snapshot.chunks)
  if (snapshot.patterns.length > 0) await localDb.putMany('offline_patterns', snapshot.patterns)
  if (snapshot.contentRefs.length > 0) await localDb.putMany('offline_content_refs', snapshot.contentRefs)
  if (snapshot.unitDetails.length > 0) await localDb.putMany('downloaded_unit_details', snapshot.unitDetails)
  if (snapshot.inkScripts.length > 0) await localDb.putMany('ink_scripts', snapshot.inkScripts)
  if (snapshot.assetRefs.length > 0) await localDb.putMany('asset_refs', snapshot.assetRefs)
  if (snapshot.deferredAssets.length > 0) await localDb.putMany('deferred_pack_assets', snapshot.deferredAssets)
  if (snapshot.pack) await localDb.put('downloaded_packs', snapshot.pack)
  await restoreReferencedPreviousPackZips(packId)
  await pruneUnreferencedPackZips(packId)
  await localDb.delete('kv', journal.id)
}

async function finishPackOperation(packId: string): Promise<void> {
  await localDb.delete('kv', operationJournalId(packId))
}

export const learningPackService = {
  async recoverInterruptedOperations(): Promise<void> {
    const journals = (await localDb.list<PackOperationJournal>('kv'))
      .filter((item) => item.id?.startsWith('learning-pack-operation:'))
    for (const journal of journals) {
      const current = await localDb.get<InstalledLearningPack>('downloaded_packs', journal.packId)
      const committed = journal.phase === 'committing' && (
        (journal.kind === 'uninstall' && !current)
        || (journal.kind !== 'uninstall'
          && current?.status === 'installed'
          && (!journal.snapshot.pack
            || current.version !== journal.snapshot.pack.version
            || current.updatedAt !== journal.snapshot.pack.updatedAt))
      )
      if (committed) {
        await restoreReferencedPreviousPackZips(journal.packId)
        if (journal.kind === 'uninstall') {
          // Metadata already committed; ensure a durable GC job exists so
          // drainPackGcQueue can finish file cleanup + journal removal.
          const existingJob = await getPackGcJob(journal.packId)
          if (!existingJob) {
            const now = new Date().toISOString()
            await putPackGcJob({
              id: packGcJobId(journal.packId),
              packId: journal.packId,
              filesToRemove: [],
              version: journal.snapshot.pack?.version,
              title: journal.snapshot.pack?.title,
              createdAt: now,
              status: 'pending',
            })
          }
          continue
        }
        await finishPackOperation(journal.packId)
      } else {
        await removePartialPackZips(journal.packId)
        await restorePackOperation(journal)
      }
    }
    // An exchange can finish just before a journal is created/removed. Repair
    // retained sources for every installed pack as part of normal startup too.
    for (const pack of await localDb.list<InstalledLearningPack>('downloaded_packs')) {
      await restoreReferencedPreviousPackZips(pack.packId)
      await pruneUnreferencedPackZips(pack.packId)
    }
    await drainPackGcQueueInternal()
    void drainPackAssetMaterializeQueueInternal()
  },

  /** Drain persisted pack file GC jobs (safe to call repeatedly). */
  drainPackGcQueue(): Promise<void> {
    return drainPackGcQueueInternal()
  },

  /** Drain deferred pack asset materialization (safe to call repeatedly). */
  drainPackAssetMaterializeQueue(packId?: string): Promise<void> {
    return drainPackAssetMaterializeQueueInternal(packId)
  },

  async buildManifestFromUnit(unitId: string): Promise<{ manifest: LearningPackManifest; unitDetail: any; topicDetails: any[] }> {
    return learningApi.getOfflineManifest(unitId) as any
  },

  async downloadUnitZip(
    unitId: string,
    onProgress?: LearningPackInstallProgressHandler,
    signal?: AbortSignal,
  ): Promise<DownloadedUnitZip> {
    const connectionType = Capacitor.isNativePlatform()
      ? await Network.getStatus().then((status) => status.connectionType).catch(() => 'unknown')
      : 'unknown'
    // Wi-Fi keeps the proven API/XHR downloader. Only cellular uses native
    // FileTransfer because its progress and long-lived disk write are more
    // reliable there.
    if (!Capacitor.isNativePlatform() || connectionType !== 'cellular') {
      const buffer = await learningApi.downloadPack(unitId, signal, (loaded, total) => {
        const percent = total && total > 0
          ? 5 + (loaded / total) * 10
          : Math.min(14, 5 + Math.log10(Math.max(loaded, 1)) * 1.5)
        onProgress?.('downloading', percent, { label: '下载学习包' })
      })
      return { blob: new Blob([buffer], { type: 'application/zip' }) }
    }

    throwIfAborted(signal)
    const url = learningPackDownloadUrl(unitId)
    const temporaryPath = `learning-packs/${unitId}/download-${Date.now()}.zip.partial`
    await Filesystem.mkdir({ path: `learning-packs/${unitId}`, directory: Directory.Data, recursive: true }).catch(() => undefined)
    const target = await Filesystem.getUri({
      path: temporaryPath,
      directory: Directory.Data,
    })
    const listener = await FileTransfer.addListener('progress', (progress) => {
      if (progress.url !== url) return
      const total = progress.contentLength || 0
      const percent = total > 0 ? 5 + (progress.bytes / total) * 10 : 5
      onProgress?.('downloading', percent, { label: '下载学习包' })
    })

    try {
      await FileTransfer.downloadFile({
        url,
        path: target.uri,
        headers: getBearerToken() ? { Authorization: `Bearer ${getBearerToken()}` } : undefined,
        progress: true,
        connectTimeout: 60_000,
        readTimeout: 10 * 60_000,
      })
      throwIfAborted(signal)
      // Do not use Filesystem.readFile here: native bridge returns base64,
      // which transiently inflates a large pack into a second JS string.
      // Capacitor's local scheme streams the temporary file as a Blob instead.
      const response = await fetch(Capacitor.convertFileSrc(target.uri))
      if (!response.ok) throw new Error(`Unable to read downloaded pack (${response.status})`)
      return { blob: await response.blob(), temporaryPath }
    } catch (error) {
      await Filesystem.deleteFile({ path: temporaryPath, directory: Directory.Data }).catch(() => undefined)
      throw error
    } finally {
      await listener.remove()
    }
  },

  async installUnit(unitId: string, onProgress?: LearningPackInstallProgressHandler, signal?: AbortSignal): Promise<InstalledLearningPack> {
    logger.info('installUnit start zip-only mode', {
      unitId,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
    })
    await awaitPackGcBeforeInstall(unitId)
    throwIfAborted(signal)
    const previous = await localDb.get<InstalledLearningPack>('downloaded_packs', unitId)
    await beginPackOperation(unitId, previous ? 'update' : 'install')
    try {
      const installed = await this.installUnitFromZip(unitId, onProgress, signal)
      await finishPackOperation(unitId)
      if (Capacitor.isNativePlatform() && previous && previous.version !== installed.version) {
        // Full replacement removes every prior deferred row before inserting
        // the new generation, so the old complete archive is no longer a
        // source for playback once the new pack has committed.
        await deferredPackAssetService.discardPack(unitId)
        await Filesystem.deleteFile({
          path: learningPackZipPath(unitId, previous.version),
          directory: Directory.Data,
        }).catch(() => undefined)
      }
      await recordPackAudit({
        packId: unitId,
        action: previous ? 'update' : 'install',
        version: installed.version,
        previousVersion: previous?.version ?? null,
        title: installed.title,
        updateMode: previous ? 'full' : undefined,
      })
      // Native packs are installed with deferred asset rows; materialize off the UI path.
      void drainPackAssetMaterializeQueueInternal(unitId)
      return installed
    } catch (error) {
      logger.error('install failed, rolling back partial data', { unitId, error: debugError(error) })
      await this.rollbackInstall(unitId)
      throw error
    }
  },

  /** 清理安装失败残留的 SQLite 数据，避免下次重试被误判为"已存在" */
  async rollbackInstall(packId: string): Promise<void> {
    try {
      const journal = await localDb.get<PackOperationJournal>('kv', operationJournalId(packId))
      if (journal) {
        await restorePackOperation(journal)
        return
      }
      await learningContentRepository.removePackContentIndex(packId)
      await localDb.deleteByIndex('ink_scripts', 'unit_id', packId)
      await localDb.deleteByIndex('downloaded_unit_details', 'unit_id', packId)
      await localDb.delete('downloaded_unit_details', packId)
      await localDb.delete('downloaded_packs', packId)
      // 清理本次安装写入的 asset_refs（不去重计数，简单全部清除）
      await localDb.deleteByIndex('asset_refs', 'pack_id', packId)
      await deferredPackAssetService.withPackLock(packId, () => localDb.deleteByIndex('deferred_pack_assets', 'pack_id', packId))
      logger.info(`🧹 已回滚残留数据: ${packId}`)
    } catch (rollbackErr) {
      logger.warn(`回滚清理异常: ${packId}`, rollbackErr)
    }
  },

  /**
   * 从已解析的 zip entries 读取并校验 pack-manifest / checksums / scene / topics。
   * 纯读取，无副作用；供全量安装复用，独立可测。
   */
  async parsePackContent(
    entries: Map<string, Entry>,
    checksums: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ unitDetail: any; topicDetails: any[] }> {
    // ④ 场景数据
    const sceneEntry = entries.get('content/scene.json')
    if (!sceneEntry) {
      throw new Error('Pack is missing content/scene.json')
    }
    const sceneText = await readEntryText(sceneEntry)
    await verifyEntry('content/scene.json', new TextEncoder().encode(sceneText).buffer, checksums)
    const unitDetail = JSON.parse(sceneText)

    // ⑤ 话题数据
    const topicDetails: any[] = []
    for (const [path, entry] of entries) {
      throwIfAborted(signal)
      if (!path.startsWith('content/topics/') || !path.endsWith('.json')) continue
      const text = await readEntryText(entry)
      await verifyEntry(path, new TextEncoder().encode(text).buffer, checksums)
      topicDetails.push(JSON.parse(text))
    }
    return { unitDetail, topicDetails }
  },

  async installUnitFromZip(unitId: string, onProgress?: LearningPackInstallProgressHandler, signal?: AbortSignal): Promise<InstalledLearningPack> {
    const report = (step: string, progress: number, detail?: LearningPackInstallProgress) => {
      throwIfAborted(signal)
      onProgress?.(step, Math.min(99, Math.round(progress)), detail)
    }
    const startTime = performance.now()
    logger.info('⏳ ① 下载 zip...')
    report('downloading', 5, { label: '下载学习包' })
    const downloadedZip = await this.downloadUnitZip(unitId, onProgress, signal)
    throwIfAborted(signal)
    const zipSizeMB = (downloadedZip.blob.size / 1024 / 1024).toFixed(1)
    logger.info(`✅ ① zip 下载完成: ${zipSizeMB} MB (${downloadedZip.blob.size} bytes)`)
    report('parsing', 15, { label: '解析压缩包' })

    logger.info('⏳ ② 解析 zip 条目...')
    const reader = new ZipReader(new BlobReader(downloadedZip.blob))
    try {
      const entryList = await reader.getEntries()
      throwIfAborted(signal)
      const entries = new Map<string, Entry>()
      let fileCount = 0
      let dirCount = 0
      for (const entry of entryList) {
        if (entry.directory) { dirCount++; continue }
        fileCount++
        entries.set(normalizeZipPath(entry.filename), entry)
      }
      logger.info(`✅ ② zip 解析完成: ${fileCount} 个文件, ${dirCount} 个目录`)
      logger.info('zip entries summary', summarizeZipEntries(entries))
      report('reading_manifest', 20, { label: '读取清单' })

      logger.info('⏳ ③ 读取 manifest + checksums...')
      const manifest = await readJsonEntry<LearningPackManifest>(entries, 'pack-manifest.json')
      if (manifest.packId !== unitId) {
        throw new Error(`Pack manifest identity mismatch: ${manifest.packId} !== ${unitId}`)
      }
      const checksums = await readJsonEntry<Record<string, string>>(entries, 'checksums.json').catch(() => manifest.files ?? {})
      logger.info('zip pack-manifest.json parsed', {
        packId: manifest.packId,
        version: manifest.version,
        title: manifest.title,
        updatedAt: manifest.updatedAt,
        topicCount: manifest.topics?.length,
        assetCount: manifest.assets?.length,
        checksumCount: Object.keys(checksums).length,
      })

      // Native packs retain their original archive as the source for deferred
      // vocabulary pronunciations. The archive is versioned so an interrupted
      // update can still restore the previous generation.
      if (Capacitor.isNativePlatform()) {
        await retainPackZip(manifest.packId, manifest.version, downloadedZip)
      }

      // ④⑤ 读取并校验 scene + topics（独立 helper，便于测试）
      report('reading_topics', 25, { label: '读取话题内容' })
      const { unitDetail, topicDetails } = await this.parsePackContent(entries, checksums, signal)
      const contentUrlsByFileAssetId = collectContentAssetUrls([unitDetail, ...topicDetails])
      logger.info(`✅ ④⑤ scene + ${topicDetails.length} 个话题读取完成`)
      report('persisting_content', 30, { label: '写入学习内容' })

      const now = new Date().toISOString()
      logger.info('⏳ ⑥ 写入 downloaded_packs 记录...')
      const installingRecord: InstalledLearningPack = {
        id: manifest.packId,
        packId: manifest.packId,
        version: manifest.version,
        title: manifest.title,
        manifest,
        status: 'installing',
        installedAt: null,
        updatedAt: now,
      }
      logger.info('persist installing downloaded_packs input', {
        packId: installingRecord.packId,
        version: installingRecord.version,
        manifestVersion: installingRecord.manifest?.version,
        title: installingRecord.title,
        status: installingRecord.status,
        installedAt: installingRecord.installedAt,
      })
      await localDb.put<InstalledLearningPack>('downloaded_packs', installingRecord)
      const savedInstalling = await localDb.get<InstalledLearningPack>('downloaded_packs', manifest.packId)
      logger.info('persist installing downloaded_packs saved', {
        packId: savedInstalling?.packId,
        version: savedInstalling?.version,
        manifestVersion: savedInstalling?.manifest?.version,
        title: savedInstalling?.title,
        status: savedInstalling?.status,
        installedAt: savedInstalling?.installedAt,
        updatedAt: savedInstalling?.updatedAt,
      })

      logger.info('⏳ ⑦ 持久化单元内容到 SQLite...')
      try {
        await persistUnitContent(unitDetail, topicDetails)
      } catch (error) {
        logger.error('persist unit content failed', {
          unitId: unitDetail?.id,
          topicCount: topicDetails.length,
          error: debugError(error),
        })
        throw error
      }
      logger.info('✅ ⑦ 单元内容写入完成')
      report('indexing', 35, { label: '建立内容索引' })

      logger.info('⏳ ⑧ 写入内容索引表...')
      try {
        await learningContentRepository.savePackContentIndex(manifest.packId, unitDetail.id ?? unitId, unitDetail, topicDetails)
      } catch (error) {
        logger.error('save content index failed', {
          packId: manifest.packId,
          unitId: unitDetail?.id ?? unitId,
          topicCount: topicDetails.length,
          error: debugError(error),
        })
        throw error
      }
      logger.info('✅ ⑧ 索引表写入完成')

      const manifestAssets = manifest.assets ?? []
      let assetOk = 0
      let assetDeduped = 0
      let assetDeferred = 0

      if (Capacitor.isNativePlatform()) {
        // Native: index every asset as deferred (or reuse a ready shared file),
        // mark installed immediately, and materialize from the retained zip later.
        report('extracting_assets', 55, {
          label: '索引离线资源',
          current: 0,
          total: manifestAssets.length,
        })
        logger.info(`⏳ ⑨ Native 延迟物化索引 (${manifestAssets.length} 个资源)...`)

        for (let i = 0; i < manifestAssets.length; i++) {
          const asset = manifestAssets[i]
          if (!asset.path) throw new Error(`Pack asset is missing path at index ${i}`)
          if (!asset.sha256) throw new Error(`Pack asset is missing sha256: ${asset.path}`)
          if (!entries.get(normalizeZipPath(asset.path))) {
            throw new Error(`Pack asset file is missing: ${asset.path}`)
          }
        }

        const declaredAssetShas = manifestAssets
          .map((asset) => asset.sha256)
          .filter((sha256): sha256 is string => Boolean(sha256))
        const allRefsList = await localDb.findByIndexIn<any>('asset_refs', 'sha256', declaredAssetShas)
        const refsBySha256 = new Map<string, any>()
        for (const ref of allRefsList) {
          if (ref.sha256) refsBySha256.set(ref.sha256, ref)
        }

        const assetRefsToWrite: any[] = []
        const aliasJobs: Array<{ sha256: string; asset: AssetRef }> = []
        const deferredRows: DeferredPackAsset[] = []
        const seenLookup = new Set<string>()
        const readyShaCache = new Map<string, boolean>()
        const nowIso = new Date().toISOString()

        for (const asset of manifestAssets) {
          throwIfAborted(signal)
          const sha256 = asset.sha256!
          const contentUrl = asset.fileAssetId
            ? (contentUrlsByFileAssetId.get(asset.fileAssetId) ?? createFileAssetReference(asset.fileAssetId))
            : asset.url
          let ready = readyShaCache.get(sha256)
          if (ready === undefined) {
            ready = Boolean(refsBySha256.get(sha256)) && await assetCacheService.isReady(sha256)
            readyShaCache.set(sha256, ready)
          }

          if (ready) {
            const existingRef = refsBySha256.get(sha256)
            const ext = existingRef?.ext ?? extensionFrom(asset.path ?? asset.url, asset.mimeType)
            assetRefsToWrite.push({
              id: `${manifest.packId}:${sha256}`,
              sha256,
              packId: manifest.packId,
              logicalPath: asset.path ?? asset.url ?? '',
              ext,
              updatedAt: nowIso,
              data: JSON.stringify({ role: asset.role }),
            })
            aliasJobs.push({ sha256, asset: { ...asset, sha256, url: contentUrl || asset.url } })
            assetDeduped++
            assetOk++
            continue
          }

          const lookupKey = deferredLookupKeys(contentUrl || asset.url || '', asset.fileAssetId)[0]
          if (!lookupKey) {
            throw new Error(`Pack asset is missing lookup identity: ${asset.path}`)
          }
          if (!seenLookup.has(lookupKey)) {
            seenLookup.add(lookupKey)
            deferredRows.push({
              id: `${manifest.packId}:${manifest.version}:${lookupKey}`,
              packId: manifest.packId,
              lookupKey,
              fileAssetId: asset.fileAssetId ?? null,
              sourceZipVersion: manifest.version,
              contentUrl: contentUrl || asset.url,
              signedUrl: asset.url,
              zipPath: asset.path!,
              sha256,
              mimeType: asset.mimeType,
              size: asset.size,
              role: asset.role ?? 'asset',
              status: 'deferred',
              createdAt: nowIso,
              updatedAt: nowIso,
            })
            assetDeferred++
          }
          assetOk++
        }

        await deferredPackAssetService.withPackLock(manifest.packId, async () => {
          await localDb.deleteByIndex('deferred_pack_assets', 'pack_id', manifest.packId)
          if (deferredRows.length > 0) await localDb.putMany('deferred_pack_assets', deferredRows)
        })
        if (assetRefsToWrite.length > 0) await localDb.putMany('asset_refs', assetRefsToWrite)
        await Promise.all(aliasJobs.map(({ sha256, asset }) => assetCacheService.addAliases(sha256, asset)))

        report('extracting_assets', 90, {
          label: '索引离线资源',
          current: manifestAssets.length,
          total: manifestAssets.length,
        })
        logger.info(`✅ ⑨ Native 资源索引完成: ${assetOk} 项 (${assetDeduped} 复用, ${assetDeferred} 延迟物化)`)
      } else {
        // Web: keep eager extract — there is no retained zip for deferred materialize.
        const eagerAssets = manifestAssets
        report('extracting_assets', 40, { label: '提取离线资源', current: 0, total: eagerAssets.length })
        logger.info(`⏳ ⑨ 提取资源文件 (${eagerAssets.length} 个)...`)
        const totalAssets = eagerAssets.length

        const declaredAssetShas = eagerAssets
          .map((asset) => asset.sha256)
          .filter((sha256): sha256 is string => Boolean(sha256))
        const allRefsList = await localDb.findByIndexIn<any>('asset_refs', 'sha256', declaredAssetShas)
        const refsBySha256 = new Map<string, any>()
        for (const ref of allRefsList) {
          if (ref.sha256) refsBySha256.set(ref.sha256, ref)
        }
        logger.info(`asset_refs 预加载: ${refsBySha256.size} 条`)

        const ASSET_CONCURRENCY = 20
        const assetTasks: Array<{
          asset: any
          entry: ReturnType<typeof entries.get>
          index: number
        }> = []

        for (let i = 0; i < totalAssets; i++) {
          const asset = eagerAssets[i]
          if (!asset.path) throw new Error(`Pack asset is missing path at index ${i}`)
          const entry = entries.get(normalizeZipPath(asset.path))
          if (!entry) throw new Error(`Pack asset file is missing: ${asset.path}`)
          assetTasks.push({ asset, entry, index: i })
        }
        const progressForAssetRead = (done: number, label: string, currentItem?: string) => {
          const total = Math.max(assetTasks.length, 1)
          const pct = 40 + (done / total) * 35
          report('extracting_assets', pct, {
            label,
            current: Math.min(done, assetTasks.length),
            total: assetTasks.length,
            currentItem,
          })
        }
        const progressForAssetWrite = (done: number, totalToWrite: number, currentItem?: string) => {
          const total = Math.max(totalToWrite, 1)
          const pct = 75 + (done / total) * 20
          report('extracting_assets', pct, {
            label: '写入本地资源',
            current: Math.min(done, totalToWrite),
            total: totalToWrite,
            currentItem,
          })
        }

        type AssetResult =
          | { ok: true; asset: any; sha256: string; buffer: ArrayBuffer | null; index: number; staged?: boolean }
          | { ok: false; asset: any; error: string; index: number }

        const assetResults: AssetResult[] = []
        const scheduledAssetShas = new Set<string>()
        for (let i = 0; i < assetTasks.length; i += ASSET_CONCURRENCY) {
          throwIfAborted(signal)
          const batch = assetTasks.slice(i, i + ASSET_CONCURRENCY)
          progressForAssetRead(i, '读取资源文件', batch[0]?.asset?.path ?? batch[0]?.asset?.url)
          const batchResults = await Promise.all(
            batch.map(async ({ asset, entry, index }): Promise<AssetResult> => {
              try {
                const buffer = await readEntryBuffer(entry!)
                const actualSha256 = await digest(buffer)
                if (asset.sha256 && actualSha256.toLowerCase() !== asset.sha256.toLowerCase()) {
                  return { ok: false, asset, error: `SHA-256 mismatch: expected ${asset.sha256}, got ${actualSha256}`, index }
                }
                return { ok: true, asset, sha256: actualSha256, buffer, index }
              } catch (e) {
                return { ok: false, asset, error: debugErrorMessage(e), index }
              }
            }),
          )
          const failedBatch = batchResults.filter((result): result is Extract<AssetResult, { ok: false }> => !result.ok)
          if (failedBatch.length > 0) {
            throw new Error(`Pack asset validation failed: ${failedBatch.map((item) => `${item.asset.path}: ${item.error}`).join('; ')}`)
          }

          await Promise.all(batchResults.map(async (result) => {
            if (!result.ok || !result.buffer) return
            const existingRef = refsBySha256.get(result.sha256)
            const ready = scheduledAssetShas.has(result.sha256)
              || (Boolean(existingRef) && await assetCacheService.isReady(result.sha256))
            if (!ready) {
              scheduledAssetShas.add(result.sha256)
              await assetCacheService.saveFromBufferWithSha256(
                { ...result.asset, sha256: result.sha256 },
                result.buffer,
                result.sha256,
              )
              result.staged = true
              refsBySha256.set(result.sha256, {
                sha256: result.sha256,
                ext: extensionFrom(result.asset.path ?? result.asset.url, result.asset.mimeType),
              })
            }
            result.buffer = null
          }))
          assetResults.push(...batchResults)
          progressForAssetRead(assetResults.length, '校验资源文件', batch[batch.length - 1]?.asset?.path ?? batch[batch.length - 1]?.asset?.url)
        }

        const failedAssets = assetResults.filter((result): result is Extract<AssetResult, { ok: false }> => !result.ok)
        if (failedAssets.length > 0) {
          throw new Error(`Pack asset validation failed: ${failedAssets.map((item) => `${item.asset.path}: ${item.error}`).join('; ')}`)
        }

        const assetRefsToWrite: any[] = []
        const filesToSave: Array<{ asset: any; sha256: string; buffer: ArrayBuffer }> = []
        let assetFail = 0

        for (const result of assetResults) {
          if (result.ok === false) {
            assetFail++
            logger.warn('asset extract failed', { path: result.asset.path, error: result.error })
            continue
          }

          const { asset, sha256: actualSha256, buffer } = result
          const existingRef = refsBySha256.get(actualSha256)
          const alreadyInPool = Boolean(result.staged) || scheduledAssetShas.has(actualSha256)
            || (Boolean(existingRef) && await assetCacheService.isReady(actualSha256))

          if (!alreadyInPool && buffer) {
            filesToSave.push({ asset, sha256: actualSha256, buffer })
            scheduledAssetShas.add(actualSha256)
          } else if (!result.staged) {
            assetDeduped++
          }

          const ext = existingRef?.ext ?? extensionFrom(asset.path ?? asset.url, asset.mimeType)
          const nowIso = new Date().toISOString()
          assetRefsToWrite.push({
            id: `${manifest.packId}:${actualSha256}`,
            sha256: actualSha256,
            packId: manifest.packId,
            logicalPath: asset.path ?? asset.url ?? '',
            ext,
            updatedAt: nowIso,
            data: JSON.stringify({ role: asset.role }),
          })

          if (!alreadyInPool) {
            refsBySha256.set(actualSha256, { sha256: actualSha256, ext })
          }
          assetOk++
        }

        let savedFiles = 0
        progressForAssetWrite(0, filesToSave.length, filesToSave[0]?.asset?.path ?? filesToSave[0]?.asset?.url)
        for (const fileBatch of chunkArray(filesToSave, 2)) {
          await Promise.all(fileBatch.map(async ({ asset, sha256, buffer }) => {
            progressForAssetWrite(savedFiles, filesToSave.length, asset.path ?? asset.url)
            const saved = await assetCacheService.saveFromBufferWithSha256({ ...asset, sha256 }, buffer, sha256)
            savedFiles++
            progressForAssetWrite(savedFiles, filesToSave.length, asset.path ?? asset.url)
            return saved
          }))
        }
        if (assetRefsToWrite.length > 0) {
          await localDb.putMany('asset_refs', assetRefsToWrite)
        }

        await Promise.all(assetResults
          .filter((result): result is Extract<AssetResult, { ok: true }> => result.ok)
          .filter((result) => !result.staged)
          .map((result) => assetCacheService.addAliases(result.sha256, {
            ...result.asset,
            sha256: result.sha256,
          })))

        logger.info(`✅ ⑨ 资源提取完成: ${assetOk} 成功 (${assetDeduped} 去重复用), ${assetFail} 失败`)
      }

      report('finishing', 99, { label: '完成安装' })

      await markPackOperationCommitting(unitId)
      const result = await persistInstalledRecord(manifest)
      await cleanupObsoletePackAssetRefs(manifest.packId, manifest)
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      logger.info(`🎉 安装完成! 耗时 ${elapsed}s`, {
        packId: manifest.packId,
        version: manifest.version,
        topics: topicDetails.length,
        assets: assetOk,
        deferred: assetDeferred,
      })
      return result
    } finally {
      await reader.close()
      if (downloadedZip.temporaryPath) {
        await Filesystem.deleteFile({ path: downloadedZip.temporaryPath, directory: Directory.Data }).catch(() => undefined)
      }
    }
  },

  /** V2: 安装 delta 增量包 */
  async installDelta(packId: string, fromVersion: number, toVersion: number, signal?: AbortSignal): Promise<InstalledLearningPack> {
    await beginPackOperation(packId, 'update')
    try {
      const installed = await this.installDeltaUnsafe(packId, fromVersion, toVersion, signal)
      await finishPackOperation(packId)
      await recordPackAudit({
        packId,
        action: 'update',
        version: installed.version,
        previousVersion: fromVersion,
        title: installed.title,
        updateMode: 'delta',
      })
      return installed
    } catch (error) {
      const journal = await localDb.get<PackOperationJournal>('kv', operationJournalId(packId))
      if (journal) await restorePackOperation(journal)
      throw error
    }
  },

  async installDeltaUnsafe(packId: string, fromVersion: number, toVersion: number, signal?: AbortSignal): Promise<InstalledLearningPack> {
    const startTime = performance.now()
    logger.info(`📦 开始安装增量包 v${fromVersion} → v${toVersion}`, { packId })

    const deltaBuffer = await learningApi.downloadDelta(packId, fromVersion, toVersion, signal)
    throwIfAborted(signal)
    const deltaSizeMB = (deltaBuffer.byteLength / 1024 / 1024).toFixed(1)
    logger.info(`✅ delta 下载完成: ${deltaSizeMB} MB`)

    const reader = new ZipReader(new BlobReader(new Blob([deltaBuffer], { type: 'application/zip' })))
    try {
      const entryList = await reader.getEntries()
      const entries = new Map<string, Entry>()
      for (const entry of entryList) {
        if (!entry.directory) entries.set(normalizeZipPath(entry.filename), entry)
      }

      const deltaManifest = await readJsonEntry<any>(entries, 'delta-manifest.json')
      if (!deltaManifest) throw new Error('Delta pack is missing delta-manifest.json')
      if (deltaManifest.packId && deltaManifest.packId !== packId) {
        throw new Error(`Delta packId mismatch: ${deltaManifest.packId} !== ${packId}`)
      }
      if (Number(deltaManifest.fromVersion) !== fromVersion || Number(deltaManifest.toVersion) !== toVersion) {
        throw new Error(`Delta version mismatch: ${deltaManifest.fromVersion}→${deltaManifest.toVersion}`)
      }
      logger.info(`delta manifest: +${deltaManifest.added?.length ?? 0} / ~${deltaManifest.modified?.length ?? 0} / -${deltaManifest.removed?.length ?? 0}`)

      const targetManifest = entries.has('pack-manifest.json')
        ? await readJsonEntry<LearningPackManifest>(entries, 'pack-manifest.json')
        : deltaManifest.targetManifest as LearningPackManifest | undefined
      if (!targetManifest) throw new Error('Delta pack is missing target pack manifest')
      if (targetManifest.packId !== packId) {
        throw new Error(`Target manifest packId mismatch: ${targetManifest.packId} !== ${packId}`)
      }
      const checksums = entries.has('checksums.json')
        ? await readJsonEntry<Record<string, string>>(entries, 'checksums.json')
        : (deltaManifest.targetFiles ?? targetManifest.files ?? {})
      const obsoleteAssetRefs: any[] = []
      const targetAssetForPath = (path: string) => targetManifest.assets?.find(
        (asset) => normalizeZipPath(asset.path ?? '') === normalizeZipPath(path),
      )
      const deltaAssetRef = (path: string, sha256: string): AssetRef => {
        const manifestAsset = targetAssetForPath(path)
        return {
          ...manifestAsset,
          // Aliases must match persisted content's asset:// identity, not the
          // target manifest's signed URL.
          url: manifestAsset?.fileAssetId
            ? createFileAssetReference(manifestAsset.fileAssetId)
            : (manifestAsset?.url ?? `cos://${sha256}`),
          path,
          sha256,
        }
      }

      // 1. 应用 content 文件，重建本地详情和索引
      const hasContentChanges = [...(deltaManifest.added ?? []), ...(deltaManifest.modified ?? []), ...(deltaManifest.removed ?? [])]
        .some((path) => normalizeZipPath(path).startsWith('content/'))
      if (hasContentChanges) {
        const { unitDetail, topicDetails } = await readPackContentFromEntries(entries, targetManifest, checksums)
        const topicIds = new Set(targetManifest.topics ?? [])
        const previousTopics = await localDb.findByIndex<any>('downloaded_unit_details', 'unit_id', packId)
        for (const item of previousTopics) {
          if (item.topicId && !topicIds.has(item.topicId)) await localDb.delete('downloaded_unit_details', item.id)
        }
        await localDb.deleteByIndex('ink_scripts', 'unit_id', packId)
        await learningContentRepository.removePackContentIndex(packId)
        await persistUnitContent(unitDetail, topicDetails)
        await learningContentRepository.savePackContentIndex(packId, unitDetail.id ?? packId, unitDetail, topicDetails)
        logger.info(`  content: ${topicDetails.length} topics re-indexed`)
      }

      // 2. 应用 added asset 文件
      for (const path of deltaManifest.added ?? []) {
        if (!isAssetPath(path)) continue
        const entry = entries.get(normalizeZipPath(path))
        if (!entry) throw new Error(`Delta asset file is missing: ${path}`)
        const buffer = await readEntryBuffer(entry)
        await verifyEntry(normalizeZipPath(path), buffer, checksums)
        const sha256 = await digest(buffer)

        const existingRefs = await localDb.findByIndex<any>('asset_refs', 'sha256', sha256)
        const assetRef = deltaAssetRef(path, sha256)
        if (!(await assetCacheService.isReady(sha256))) await assetCacheService.saveFromBufferWithSha256(assetRef, buffer, sha256)
        await assetCacheService.addAliases(sha256, assetRef)
        const ext = existingRefs[0]?.ext ?? extensionFrom(path, null)
        await localDb.put('asset_refs', {
          id: `${packId}:${sha256}`,
          sha256,
          packId,
          logicalPath: path,
          ext,
          updatedAt: new Date().toISOString(),
          data: '{}',
        })
      }
      logger.info(`  added: ${deltaManifest.added?.length ?? 0}`)

      // 3. 应用 modified asset 文件（替换旧 SHA256 → 新 SHA256）
      for (const path of deltaManifest.modified ?? []) {
        if (!isAssetPath(path)) continue
        const entry = entries.get(normalizeZipPath(path))
        if (!entry) throw new Error(`Delta asset file is missing: ${path}`)
        const buffer = await readEntryBuffer(entry)
        await verifyEntry(normalizeZipPath(path), buffer, checksums)
        const newSha256 = await digest(buffer)

        // Keep the previous file until the new resource and pack version are
        // both durable. Interrupted updates may leak cache, but never break the
        // currently installed generation.
        const packRefs = await localDb.findByIndex<any>('asset_refs', 'pack_id', packId)
        const oldRefs = packRefs.filter((r: any) => r.logicalPath === path)

        const assetRef = deltaAssetRef(path, newSha256)
        if (!(await assetCacheService.isReady(newSha256))) await assetCacheService.saveFromBufferWithSha256(assetRef, buffer, newSha256)
        await assetCacheService.addAliases(newSha256, assetRef)
        const ext = extensionFrom(path, null)
        await localDb.put('asset_refs', {
          id: `${packId}:${newSha256}`,
          sha256: newSha256,
          packId,
          logicalPath: path,
          ext,
          updatedAt: new Date().toISOString(),
          data: '{}',
        })
        obsoleteAssetRefs.push(...oldRefs.filter((ref: any) => ref.sha256 !== newSha256))
      }
      logger.info(`  modified: ${deltaManifest.modified?.length ?? 0}`)

      // 4. 应用 removed asset 文件
      for (const path of deltaManifest.removed ?? []) {
        if (!isAssetPath(path)) continue
        const packRefs = await localDb.findByIndex<any>('asset_refs', 'pack_id', packId)
        const oldRefs = packRefs.filter((r: any) => r.logicalPath === path)
        obsoleteAssetRefs.push(...oldRefs)
      }
      logger.info(`  removed: ${deltaManifest.removed?.length ?? 0}`)

      // Delta packs keep unchanged pronunciations deferred against their old
      // complete ZIP. Changed/deleted entries were materialized above, so their
      // stale deferred source must not keep an obsolete ZIP alive.
      const changedAssetPaths = new Set([
        ...(deltaManifest.added ?? []),
        ...(deltaManifest.modified ?? []),
        ...(deltaManifest.removed ?? []),
      ].map(normalizeZipPath))
      const deferredRows = await localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'pack_id', packId)
      await deferredPackAssetService.withPackLock(packId, async () => {
        await Promise.all(deferredRows
          .filter((row) => changedAssetPaths.has(normalizeZipPath(row.zipPath)))
          .map((row) => localDb.delete('deferred_pack_assets', row.id)))
      })

      // 5. 更新 pack 记录
      await markPackOperationCommitting(packId)
      const pack = await localDb.get<InstalledLearningPack>('downloaded_packs', packId)
      if (pack) {
        await localDb.put('downloaded_packs', {
          ...pack,
          version: toVersion,
          title: targetManifest.title,
          manifest: targetManifest,
          status: 'installed',
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      await pruneUnreferencedPackZips(packId)

      // Garbage collection is intentionally last. A failure here only leaves
      // extra cache files and can be retried; it cannot corrupt the new pack.
      for (const oldRef of obsoleteAssetRefs) {
        try {
          await localDb.delete('asset_refs', oldRef.id)
          const remaining = await localDb.findByIndex<any>('asset_refs', 'sha256', oldRef.sha256)
          if (remaining.length === 0) await assetCacheService.remove(oldRef.sha256)
        } catch (error) {
          logger.warn('delta asset garbage collection failed', { packId, sha256: oldRef.sha256, error })
        }
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      logger.info(`🎉 增量安装完成! 耗时 ${elapsed}s`)
      return (await localDb.get<InstalledLearningPack>('downloaded_packs', packId))!
    } finally {
      await reader.close()
    }
  },

  /**
   * Fast path: remove pack from SQLite indexes and enqueue file GC.
   * UI can treat the pack as uninstalled as soon as this resolves.
   */
  async uninstallMetadata(packId: string): Promise<void> {
    const timer = createTimer(`learning-pack:uninstall-metadata:${packId}`)
    logger.info(`[uninstall:${packId}] metadata start`)
    const pack = await localDb.get<InstalledLearningPack>('downloaded_packs', packId)
    timer.lap('load pack record', { found: Boolean(pack) })
    if (!pack) {
      // Pack row already gone — still try to finish any leftover GC.
      void drainPackGcQueueInternal()
      return
    }
    await beginPackOperation(packId, 'uninstall')

    const myRefs = await localDb.findByIndex<any>('asset_refs', 'pack_id', packId)
    timer.lap('load asset refs', { packRefs: myRefs.length })

    const refCountBySha = new Map<string, number>()
    for (const shaBatch of chunkArray([...new Set(myRefs.map((ref) => String(ref.sha256)))], 8)) {
      const results = await Promise.all(shaBatch.map(async (sha256) => ({
        sha256,
        refs: await localDb.findByIndex<any>('asset_refs', 'sha256', sha256),
      })))
      for (const result of results) {
        const sharedCount = result.refs.filter((ref) => ref.packId !== packId).length
        if (sharedCount > 0) refCountBySha.set(result.sha256, sharedCount)
      }
    }
    timer.lap('compute shared asset refs', { sharedAssetCount: refCountBySha.size })

    let deletedFiles = 0
    let keptFiles = 0
    const filesToRemove: string[] = []
    for (const ref of myRefs) {
      if (!refCountBySha.has(ref.sha256)) {
        filesToRemove.push(ref.sha256)
        deletedFiles++
      } else {
        keptFiles++
      }
    }

    // Keep SQLite cleanup sequential. The web adapter is much happier when
    // large deletes do not compete on the same connection.
    try {
      await deferredPackAssetService.withPackLock(packId, () => localDb.deleteByIndex('deferred_pack_assets', 'pack_id', packId))
      await localDb.deleteByIndex('asset_refs', 'pack_id', packId)
      timer.lap('delete asset refs', { deletedRefs: myRefs.length })
      await learningContentRepository.removePackContentIndex(packId)
      timer.lap('remove content index')
      await localDb.deleteByIndex('ink_scripts', 'unit_id', packId)
      timer.lap('delete ink scripts')
      await localDb.deleteByIndex('downloaded_unit_details', 'unit_id', packId)
      timer.lap('delete topic unit details')
      await localDb.delete('downloaded_unit_details', packId)
      timer.lap('delete root unit detail')
      await localDb.delete('downloaded_packs', packId)
      timer.lap('delete downloaded pack record')
    } catch (error) {
      logger.warn(`关联数据清理异常: ${packId}`, error)
      const journal = await localDb.get<PackOperationJournal>('kv', operationJournalId(packId))
      if (journal) await restorePackOperation(journal)
      throw error
    }

    // After SQLite no longer advertises the pack, enqueue durable file GC and
    // return. Physical deletes run in drainPackGcQueue (crash-safe).
    await markPackOperationCommitting(packId)
    const now = new Date().toISOString()
    await putPackGcJob({
      id: packGcJobId(packId),
      packId,
      filesToRemove: [...new Set(filesToRemove)],
      version: pack.version,
      title: pack.title,
      createdAt: now,
      status: 'pending',
    })
    timer.lap('enqueue gc job', { deletedFiles, keptFiles })
    logger.info(`🗑️ 已标记卸载: ${packId} (${pack.title} v${pack.version}); GC queued (${deletedFiles} files, ${keptFiles} retained)`)
    timer.done({ packId, title: pack.title, version: pack.version })
  },

  /** Compatible uninstall: metadata fast path + background file GC. */
  async uninstall(packId: string): Promise<void> {
    await this.uninstallMetadata(packId)
    void drainPackGcQueueInternal()
  },

  listInstalled(): Promise<InstalledLearningPack[]> {
    return localDb.list<InstalledLearningPack>('downloaded_packs')
  },

  async isInstalled(packId: string): Promise<boolean> {
    const pack = await localDb.get<InstalledLearningPack>('downloaded_packs', packId)
    return pack?.status === 'installed'
  },

  /** 🔍 调试用：打印所有离线存储状态 */
  async dumpStatus(): Promise<void> {
    const packs = await localDb.list<InstalledLearningPack>('downloaded_packs')
    const unitDetails = await localDb.list<any>('downloaded_unit_details')
    const inkScripts = await localDb.list<any>('ink_scripts')
    const localAssets = await localDb.list<any>('local_assets')
    const assetRefs = await localDb.list<any>('asset_refs')
    const vocabCount = await localDb.count('offline_vocabularies')
    const chunkCount = await localDb.count('offline_chunks')
    const patternCount = await localDb.count('offline_patterns')
    const refCount = await localDb.count('offline_content_refs')

    console.group('📦 [learning-pack] 离线存储状态总览')
    console.log('downloaded_packs:', packs.length, packs.map(p => `${p.title} v${p.version} [${p.status}]`))
    console.log('downloaded_unit_details:', unitDetails.length)
    console.log('ink_scripts:', inkScripts.length)
    console.log('local_assets:', localAssets.length, localAssets.filter((a: any) => a.status === 'ready').length, 'ready')
    console.log('asset_refs:', assetRefs.length)
    // 按 sha256 分组统计引用计数
    const sha256Counts = new Map<string, number>()
    for (const ref of assetRefs) {
      sha256Counts.set(ref.sha256, (sha256Counts.get(ref.sha256) ?? 0) + 1)
    }
    const sharedFiles = [...sha256Counts.values()].filter(c => c > 1).length
    if (sharedFiles > 0) console.log(`  └─ 其中 ${sharedFiles} 个文件被多个包共享 (总去重节省: 计算中...)`)
    console.log('offline_vocabularies:', vocabCount)
    console.log('offline_chunks:', chunkCount)
    console.log('offline_patterns:', patternCount)
    console.log('offline_content_refs:', refCount)
    console.groupEnd()
  },
}

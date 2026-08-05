import { assetCacheService, digestSync, type AssetRef } from './asset-cache.service'
import { learningApi } from '@/features/learning/api/learning-api'
import { buildAggregatedUnitContent, learningRepository } from './learning.repository'
import { localDb } from './unified-storage'
import { practiceRepository } from './practice.repository'
import { syncOutbox } from './sync-outbox'
import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry } from '@zip.js/zip.js'
import { learningContentRepository } from './learning-content.repository'
import { Capacitor } from '@capacitor/core'
import { createLogger } from './logger'

const logger = createLogger('learning-pack')

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

function pushUrlAsset(assets: AssetRef[], url?: string | null, role?: AssetRef['role']) {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return
  if (assets.some((asset) => asset.url === url)) return
  assets.push({ url, role })
}

function collectUnitAssets(unitDetail: any): AssetRef[] {
  const assets: AssetRef[] = []
  // Scene background + cover
  pushUrlAsset(assets, unitDetail?.scene?.backgroundUrl, 'background')
  pushUrlAsset(assets, unitDetail?.scene?.coverImage, 'cover')
  // Characters (sprites + avatars)
  for (const character of unitDetail?.scene?.characters ?? []) {
    pushUrlAsset(assets, character.avatarUrl, 'thumbnail')
    pushUrlAsset(assets, character.spriteBaseUrl, 'sprite')
    const expressions = character.expressions && typeof character.expressions === 'object'
      ? Object.values(character.expressions)
      : []
    for (const value of expressions) {
      if (typeof value === 'string') pushUrlAsset(assets, value, 'sprite')
      else if (value && typeof value === 'object') {
        pushUrlAsset(assets, (value as any).spriteUrl, 'sprite')
        pushUrlAsset(assets, (value as any).avatarUrl, 'thumbnail')
      }
    }
  }
  return assets
}

/** Merge unit-level shared data (scene) into each topic detail */
function mergeTopicDetail(topicDetail: any, unitDetail: any) {
  if (!topicDetail || !unitDetail) return topicDetail
  return {
    ...topicDetail,
    // scene is shared at unit level
    scene: unitDetail.scene ?? topicDetail.scene,
    // topic metadata, vocabularies, activeChunks are already per-topic — no merge needed
  }
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

function createTimer(scope: string) {
  const startedAt = performance.now()
  let lastAt = startedAt
  return {
    lap(label: string, extra?: Record<string, unknown>) {
      const now = performance.now()
      const elapsed = now - lastAt
      const total = now - startedAt
      lastAt = now
      console.log(`[${scope}] ${label}: ${elapsed.toFixed(1)}ms (total ${total.toFixed(1)}ms)`, extra ?? '')
    },
    done(extra?: Record<string, unknown>) {
      const total = performance.now() - startedAt
      console.log(`[${scope}] done: ${total.toFixed(1)}ms`, extra ?? '')
    },
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
  const mergedTopicDetails: Array<{ topicId: string; detail: any }> = []
  for (const topicDetail of topicDetails) {
    if (topicDetail?.inkScript) {
      await localDb.put('ink_scripts', {
        id: topicDetail.inkScript.id,
        topicId: topicDetail.topic.id,
        unitId: unitDetail.id,
        ...topicDetail.inkScript,
        updatedAt: new Date().toISOString(),
      })
      inkCount++
    }
    // Merge unit-level shared data into the stored topic detail
    const merged = mergeTopicDetail(topicDetail, unitDetail)
    mergedTopicDetails.push({ topicId: topicDetail.topic.id, detail: merged })
    await localDb.put('downloaded_unit_details', {
      id: `topic:${topicDetail.topic.id}`,
      unitId: unitDetail.id,
      topicId: topicDetail.topic.id,
      detail: merged,
      updatedAt: new Date().toISOString(),
    })
  }
  logger.info(`  SQLite: ${topicDetails.length} 个 topic, ${inkCount} 个 ink_script`)
  const aggregatedUnitDetail = buildAggregatedUnitContent(unitDetail, mergedTopicDetails)
  await localDb.put('downloaded_unit_details', {
    id: unitDetail.id,
    ...aggregatedUnitDetail,
    downloadedAt: new Date().toISOString(),
  })
  logger.info(`  SQLite: downloaded_unit_details/${unitDetail.id} (unit view)`)
}

/**
 * Compute SHA-256 digest of a buffer.
 *
 * Always use the project's pure-JS implementation. Capacitor live reload can
 * run from HTTP, where Web Crypto is unavailable; a single implementation also
 * guarantees identical hashes in development and production.
 */
async function digest(buffer: ArrayBuffer): Promise<string> {
  return digestSync(buffer)
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
    unitDetail = await localDb.get<any>('downloaded_unit_details', manifest.packId)
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

    const cached = await localDb.get<any>('downloaded_unit_details', `topic:${topicId}`)
    const cachedDetail = cached?.detail ?? cached
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
  const outboxItem = await syncOutbox.enqueue({
    entityType: 'learning_pack',
    entityId: manifest.packId,
    operation: 'create',
    payload: { packId: manifest.packId, version: manifest.version },
  })
  await syncOutbox.markSynced(outboxItem.id)
  return installed
}

/**
 * 从内容派生稳定版本号（djb2 哈希）。
 * 用于 getOfflineManifest 不可用时的降级路径：避免 Date.now() 每次调用都生成“新版本”，
 * 导致客户端无法判断是否需要更新。内容不变则版本不变。
 */
function stableContentVersion(unitDetail: any, topicDetails: any[]): number {
  const input = JSON.stringify({
    id: unitDetail.id,
    title: unitDetail.title,
    updatedAt: unitDetail.updatedAt ?? null,
    topics: (unitDetail.trainingTopics ?? []).map((t: any) => t.id),
    vocabs: (unitDetail.vocabularies ?? []).map((v: any) => v.id),
    chunks: (unitDetail.chunks ?? []).map((c: any) => c.id),
    patterns: (unitDetail.sentencePatterns ?? []).map((p: any) => p.pattern ?? p.id),
    storyEpisodes: (unitDetail.storyEpisodes ?? []).map((e: any) => e.id),
    topicCount: topicDetails.length,
  })
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return hash >>> 0
}

export const learningPackService = {
  async buildManifestFromUnit(unitId: string): Promise<{ manifest: LearningPackManifest; unitDetail: any; topicDetails: any[] }> {
    try {
      return await learningApi.getOfflineManifest(unitId) as any
    } catch {
      // Older backend deployments can still assemble a manifest from existing endpoints.
    }

    const unitDetail = await learningRepository.getUnitDetail(unitId)
    if (!unitDetail) throw new Error('Unit detail is not available')

    const topicDetails = []
    for (const topic of unitDetail.trainingTopics ?? []) {
      const detail = await practiceRepository.getTopicDetail(topic.id)
      if (detail) topicDetails.push(detail)
    }

    // Collect assets from unit-level where available, fall back to first topicDetail
    const assets: AssetRef[] = []
    if ((unitDetail as any).scene) {
      for (const asset of collectUnitAssets(unitDetail)) {
        pushUrlAsset(assets, asset.url, asset.role)
      }
    } else if (topicDetails.length > 0) {
      // Old fallback: scene data is in each topicDetail, collect from first one only
      const first = topicDetails[0]
      pushUrlAsset(assets, first?.scene?.backgroundUrl, 'background')
      for (const character of first?.scene?.characters ?? []) {
        pushUrlAsset(assets, character.avatarUrl, 'thumbnail')
        pushUrlAsset(assets, character.spriteBaseUrl, 'sprite')
        const expressions = character.expressions && typeof character.expressions === 'object'
          ? Object.values(character.expressions) : []
        for (const value of expressions) {
          if (typeof value === 'string') pushUrlAsset(assets, value, 'sprite')
          else if (value && typeof value === 'object') {
            pushUrlAsset(assets, (value as any).spriteUrl, 'sprite')
            pushUrlAsset(assets, (value as any).avatarUrl, 'thumbnail')
          }
        }
      }
    }

    return {
      unitDetail,
      topicDetails,
      manifest: {
        packId: unitDetail.id,
        version: stableContentVersion(unitDetail, topicDetails),
        title: unitDetail.title,
        packageType: unitDetail.packageType,
        contentMode: unitDetail.contentMode,
        updatedAt: new Date().toISOString(),
        units: [unitDetail.id],
        topics: (unitDetail.trainingTopics ?? []).map((topic: any) => topic.id),
        vocabularies: (unitDetail.vocabularies ?? []).map((item: any) => item.id),
        chunks: (unitDetail.chunks ?? []).map((item: any) => item.id),
        sentencePatterns: (unitDetail.sentencePatterns ?? []).map((item: any) => item.pattern),
        storyEpisodes: (unitDetail.storyEpisodes ?? []).map((episode: any) => episode.id),
        inkScripts: [
          ...topicDetails.map((detail: any) => detail.inkScript?.id),
          ...(unitDetail.offlineStoryEpisodePlayers ?? []).map((item: any) => item.inkScript?.id),
        ].filter(Boolean),
        assets,
      },
    }
  },

  async installUnit(unitId: string, onProgress?: LearningPackInstallProgressHandler, signal?: AbortSignal): Promise<InstalledLearningPack> {
    logger.info('installUnit start zip-only mode', {
      unitId,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
    })
    try {
      return await this.installUnitFromZip(unitId, onProgress, signal)
    } catch (error) {
      logger.error('install failed, rolling back partial data', { unitId, error: debugError(error) })
      await this.rollbackInstall(unitId)
      throw error
    }
  },

  /** 清理安装失败残留的 SQLite 数据，避免下次重试被误判为"已存在" */
  async rollbackInstall(packId: string): Promise<void> {
    try {
      await learningContentRepository.removePackContentIndex(packId)
      await localDb.deleteWhere<any>('ink_scripts', (item) => item.unitId === packId)
      await localDb.deleteWhere<any>('downloaded_unit_details', (item) => item.unitId === packId)
      await localDb.delete('downloaded_unit_details', packId)
      await localDb.delete('downloaded_packs', packId)
      // 清理本次安装写入的 asset_refs（不去重计数，简单全部清除）
      await localDb.deleteWhere<any>('asset_refs', (ref) => ref.packId === packId)
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
    const zipBuffer = await learningApi.downloadPack(unitId, signal)
    throwIfAborted(signal)
    const zipSizeMB = (zipBuffer.byteLength / 1024 / 1024).toFixed(1)
    logger.info(`✅ ① zip 下载完成: ${zipSizeMB} MB (${zipBuffer.byteLength} bytes)`)
    report('parsing', 15, { label: '解析压缩包' })

    logger.info('⏳ ② 解析 zip 条目...')
    const reader = new ZipReader(new BlobReader(new Blob([zipBuffer], { type: 'application/zip' })))
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

      // ④⑤ 读取并校验 scene + topics（独立 helper，便于测试）
      report('reading_topics', 25, { label: '读取话题内容' })
      const { unitDetail, topicDetails } = await this.parsePackContent(entries, checksums, signal)
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
      report('extracting_assets', 40, { label: '提取离线资源', current: 0, total: manifest.assets?.length ?? 0 })

      logger.info(`⏳ ⑨ 提取资源文件 (${manifest.assets?.length ?? 0} 个)...`)
      const totalAssets = manifest.assets?.length ?? 0

      // 一次性加载所有 asset_refs 到内存 Map，避免每个资产全表扫描
      const allRefsList = await localDb.list<any>('asset_refs')
      const refsBySha256 = new Map<string, any>()
      for (const ref of allRefsList) {
        if (ref.sha256) refsBySha256.set(ref.sha256, ref)
      }
      logger.info(`asset_refs 预加载: ${refsBySha256.size} 条`)

      // ── 阶段 A：并行读取 ZIP + 计算 SHA-256（CPU 密集型，可并行）──
      const ASSET_CONCURRENCY = 8
      const assetTasks: Array<{
        asset: any
        entry: ReturnType<typeof entries.get>
        index: number
      }> = []

      for (let i = 0; i < totalAssets; i++) {
        const asset = manifest.assets![i]
        if (!asset.path) continue
        const entry = entries.get(normalizeZipPath(asset.path))
        if (!entry) continue
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
        | { ok: true; asset: any; sha256: string; buffer: ArrayBuffer; index: number }
        | { ok: false; asset: any; error: string; index: number }

      const assetResults: AssetResult[] = []
      for (let i = 0; i < assetTasks.length; i += ASSET_CONCURRENCY) {
        throwIfAborted(signal)
        const batch = assetTasks.slice(i, i + ASSET_CONCURRENCY)
        progressForAssetRead(i, '读取资源文件', batch[0]?.asset?.path ?? batch[0]?.asset?.url)
        const batchResults = await Promise.all(
          batch.map(async ({ asset, entry, index }): Promise<AssetResult> => {
            try {
              const buffer = await readEntryBuffer(entry!)
              const actualSha256 = await digest(buffer)
              // digest() already falls back to the pure-JS implementation in
              // live-reload/non-secure contexts. Never turn integrity checking
              // off there: a bad hash must not become a reusable cache entry.
              if (asset.sha256 && actualSha256.toLowerCase() !== asset.sha256.toLowerCase()) {
                return { ok: false, asset, error: `SHA-256 mismatch: expected ${asset.sha256}, got ${actualSha256}`, index }
              }
              return { ok: true, asset, sha256: actualSha256, buffer, index }
            } catch (e) {
              return { ok: false, asset, error: debugErrorMessage(e), index }
            }
          }),
        )
        assetResults.push(...batchResults)
        progressForAssetRead(assetResults.length, '校验资源文件', batch[batch.length - 1]?.asset?.path ?? batch[batch.length - 1]?.asset?.url)
      }

      // ── 阶段 B：批量写入文件系统 + SQLite ──
      const assetRefsToWrite: any[] = []
      const filesToSave: Array<{ asset: any; sha256: string; buffer: ArrayBuffer }> = []
      const scheduledAssetShas = new Set<string>()
      let assetOk = 0
      let assetDeduped = 0
      let assetFail = 0

      for (const result of assetResults) {
        if (result.ok === false) {
          assetFail++
          logger.warn('asset extract failed', { path: result.asset.path, error: result.error })
          continue
        }

        const { asset, sha256: actualSha256, buffer } = result
        const existingRef = refsBySha256.get(actualSha256)
        // asset_refs is metadata, not proof that a file still exists. This
        // guards clear/interrupted-install recovery: stale refs must not cause
        // the installer to skip writing a missing local resource.
        const alreadyInPool = scheduledAssetShas.has(actualSha256)
          || (Boolean(existingRef) && await assetCacheService.isReady(actualSha256))

        if (existingRef && !alreadyInPool) {
          logger.warn('stale asset_ref recovered by re-saving file', {
            packId: manifest.packId,
            sha256: actualSha256,
            path: asset.path,
          })
        }

        if (!alreadyInPool) {
          filesToSave.push({ asset, sha256: actualSha256, buffer })
          scheduledAssetShas.add(actualSha256)
        } else {
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

      // 并行写文件 + 批量写 SQLite 引用
      let savedFiles = 0
      progressForAssetWrite(0, filesToSave.length, filesToSave[0]?.asset?.path ?? filesToSave[0]?.asset?.url)
      await Promise.all([
        ...filesToSave.map(async ({ asset, sha256, buffer }) => {
          progressForAssetWrite(savedFiles, filesToSave.length, asset.path ?? asset.url)
          const saved = await assetCacheService.saveFromBufferWithSha256({ ...asset, sha256 }, buffer, sha256)
          savedFiles++
          progressForAssetWrite(savedFiles, filesToSave.length, asset.path ?? asset.url)
          return saved
        }),
        assetRefsToWrite.length > 0
          ? localDb.putMany('asset_refs', assetRefsToWrite)
          : Promise.resolve(),
      ])

      // Several semantic references (thumbnail, sprite, Ink alias) can point
      // at one ZIP entry/SHA. The file is written once above; now persist every
      // reference alias so runtime lookup never depends on a signed URL.
      await Promise.all(assetResults
        .filter((result): result is Extract<AssetResult, { ok: true }> => result.ok)
        .map((result) => assetCacheService.addAliases(result.sha256, {
          ...result.asset,
          sha256: result.sha256,
        })))

      const assetSkip = totalAssets - assetTasks.length
      logger.info(`✅ ⑨ 资源提取完成: ${assetOk} 成功 (${assetDeduped} 去重复用), ${assetSkip} 跳过, ${assetFail} 失败`)
      report('finishing', 99, { label: '完成安装' })

      const result = await persistInstalledRecord(manifest)
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      logger.info(`🎉 安装完成! 耗时 ${elapsed}s`, {
        packId: manifest.packId,
        version: manifest.version,
        topics: topicDetails.length,
        assets: assetOk,
      })
      return result
    } finally {
      await reader.close()
    }
  },

  /** V2: 安装 delta 增量包 */
  async installDelta(packId: string, fromVersion: number, toVersion: number, signal?: AbortSignal): Promise<InstalledLearningPack> {
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

      // 1. 应用 content 文件，重建本地详情和索引
      const hasContentChanges = [...(deltaManifest.added ?? []), ...(deltaManifest.modified ?? []), ...(deltaManifest.removed ?? [])]
        .some((path) => normalizeZipPath(path).startsWith('content/'))
      if (hasContentChanges) {
        const { unitDetail, topicDetails } = await readPackContentFromEntries(entries, targetManifest, checksums)
        const topicIds = new Set(targetManifest.topics ?? [])
        await localDb.deleteWhere<any>('downloaded_unit_details', (item) => item.unitId === packId && item.topicId && !topicIds.has(item.topicId))
        await localDb.deleteWhere<any>('ink_scripts', (item) => item.unitId === packId)
        await learningContentRepository.removePackContentIndex(packId)
        await persistUnitContent(unitDetail, topicDetails)
        await learningContentRepository.savePackContentIndex(packId, unitDetail.id ?? packId, unitDetail, topicDetails)
        logger.info(`  content: ${topicDetails.length} topics re-indexed`)
      }

      // 2. 应用 added asset 文件
      for (const path of deltaManifest.added ?? []) {
        if (!isAssetPath(path)) continue
        const entry = entries.get(normalizeZipPath(path))
        if (!entry) continue
        const buffer = await readEntryBuffer(entry)
        await verifyEntry(normalizeZipPath(path), buffer, checksums)
        const sha256 = await digest(buffer)

        const existingRefs = await localDb.findByIndex<any>('asset_refs', 'sha256', sha256)
        if (existingRefs.length === 0) {
          const assetRef = {
            url: `cos://${sha256}`,
            path,
            sha256,
            mimeType: null,
            role: 'asset' as any,
          }
          await assetCacheService.saveFromBuffer(assetRef, buffer)
        }
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
        if (!entry) continue
        const buffer = await readEntryBuffer(entry)
        await verifyEntry(normalizeZipPath(path), buffer, checksums)
        const newSha256 = await digest(buffer)

        // 删除旧引用（同一 packId + logicalPath 的旧记录，走 pack_id 索引）
        const packRefs = await localDb.findByIndex<any>('asset_refs', 'pack_id', packId)
        const oldRefs = packRefs.filter((r: any) => r.logicalPath === path)
        for (const oldRef of oldRefs) {
          await localDb.delete('asset_refs', oldRef.id)
          // 检查是否还有其他包引用旧 SHA256
          const remaining = await localDb.findByIndex<any>('asset_refs', 'sha256', oldRef.sha256)
          if (remaining.length === 0) {
            await assetCacheService.remove(oldRef.sha256)
          }
        }

        const existingRefs = await localDb.findByIndex<any>('asset_refs', 'sha256', newSha256)
        if (existingRefs.length === 0) {
          await assetCacheService.saveFromBuffer({ url: `cos://${newSha256}`, path, sha256: newSha256, mimeType: null }, buffer)
        }
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
      }
      logger.info(`  modified: ${deltaManifest.modified?.length ?? 0}`)

      // 4. 应用 removed asset 文件
      for (const path of deltaManifest.removed ?? []) {
        if (!isAssetPath(path)) continue
        const packRefs = await localDb.findByIndex<any>('asset_refs', 'pack_id', packId)
        const oldRefs = packRefs.filter((r: any) => r.logicalPath === path)
        for (const oldRef of oldRefs) {
          await localDb.delete('asset_refs', oldRef.id)
          const remaining = await localDb.findByIndex<any>('asset_refs', 'sha256', oldRef.sha256)
          if (remaining.length === 0) {
            await assetCacheService.remove(oldRef.sha256)
          }
        }
      }
      logger.info(`  removed: ${deltaManifest.removed?.length ?? 0}`)

      // 5. 更新 pack 记录
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

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      logger.info(`🎉 增量安装完成! 耗时 ${elapsed}s`)
      return (await localDb.get<InstalledLearningPack>('downloaded_packs', packId))!
    } finally {
      await reader.close()
    }
  },

  async uninstall(packId: string): Promise<void> {
    const timer = createTimer(`learning-pack:uninstall:${packId}`)
    logger.info(`[uninstall:${packId}] start`)
    const pack = await localDb.get<InstalledLearningPack>('downloaded_packs', packId)
    timer.lap('load pack record', { found: Boolean(pack) })
    if (!pack) return

    // 清理 asset_refs（引用计数保护）
    const allRefs = await localDb.list<any>('asset_refs')
    const myRefs = allRefs.filter((r) => r.packId === packId)
    timer.lap('load asset refs', { totalRefs: allRefs.length, packRefs: myRefs.length })

    // 预计算每个 sha256 的总引用数（排除当前包，O(n) 一次扫描）
    const refCountBySha = new Map<string, number>()
    for (const r of allRefs) {
      if (r.packId !== packId) {
        refCountBySha.set(r.sha256, (refCountBySha.get(r.sha256) ?? 0) + 1)
      }
    }
    timer.lap('compute shared asset refs', { sharedAssetCount: refCountBySha.size })

    // 批量删除 asset_refs 记录
    await localDb.deleteWhere<any>('asset_refs', (ref) => ref.packId === packId)
    timer.lap('delete asset refs', { deletedRefs: myRefs.length })

    // 并行删除未被其他包引用的文件
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
    if (Capacitor.isNativePlatform()) {
      await Promise.all(filesToRemove.map((sha256) => assetCacheService.remove(sha256)))
    } else {
      const removeSet = new Set(filesToRemove)
      await localDb.deleteWhere<any>('local_assets', (asset) => removeSet.has(String(asset.id)))
    }
    timer.lap('delete asset files', { deletedFiles, keptFiles })
    logger.info(`🗑️ 资产清理: ${deletedFiles} 个文件删除, ${keptFiles} 个文件被其他包保留`)

    // Keep SQLite cleanup sequential. The web adapter is much happier when
    // large deletes do not compete on the same connection.
    try {
      await learningContentRepository.removePackContentIndex(packId)
      timer.lap('remove content index')
      await localDb.deleteWhere<any>('ink_scripts', (item) => item.unitId === packId)
      timer.lap('delete ink scripts')
      await localDb.deleteWhere<any>('downloaded_unit_details', (item) => item.unitId === packId)
      timer.lap('delete topic unit details')
      await localDb.delete('downloaded_unit_details', packId)
      timer.lap('delete root unit detail')
      await localDb.delete('downloaded_packs', packId)
      timer.lap('delete downloaded pack record')
    } catch (error) {
      logger.warn(`关联数据清理异常: ${packId}`, error)
    }

    logger.info(`🗑️ 已卸载: ${packId} (${pack.title} v${pack.version})`)
    try {
      const outboxItem = await syncOutbox.enqueue({
        entityType: 'learning_pack',
        entityId: packId,
        operation: 'delete',
        payload: { packId },
      })
      timer.lap('enqueue uninstall sync', { outboxId: outboxItem.id })
      await syncOutbox.markSynced(outboxItem.id)
      timer.lap('mark uninstall sync synced')
    } catch (error) {
      logger.warn(`同步出队异常: ${packId}`, error)
    }
    timer.done({ packId, title: pack.title, version: pack.version })
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

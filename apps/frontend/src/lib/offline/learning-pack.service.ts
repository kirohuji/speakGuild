import { assetCacheService, type AssetRef } from './asset-cache.service'
import { learningApi } from '@/features/learning/api/learning-api'
import { learningRepository } from './learning.repository'
import { localDb } from './unified-storage'
import { practiceRepository } from './practice.repository'
import { syncOutbox } from './sync-outbox'
import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry } from '@zip.js/zip.js'
import { learningContentRepository } from './learning-content.repository'

export interface LearningPackManifest {
  packId: string
  version: number
  title: string
  updatedAt: string
  units: string[]
  topics: string[]
  vocabularies: string[]
  chunks: string[]
  sentencePatterns: string[]
  scriptEpisodes: string[]
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

function pushUrlAsset(assets: AssetRef[], url?: string | null, role?: AssetRef['role']) {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return
  if (assets.some((asset) => asset.url === url)) return
  assets.push({ url, role })
}

function collectUnitAssets(unitDetail: any): AssetRef[] {
  const assets: AssetRef[] = []
  // Scene background
  pushUrlAsset(assets, unitDetail?.scene?.backgroundUrl, 'background')
  // Characters (sprites + avatars)
  for (const character of unitDetail?.scene?.characters ?? []) {
    pushUrlAsset(assets, character.avatarUrl, 'thumbnail')
    pushUrlAsset(assets, character.spriteBaseUrl, 'sprite')
    const expressions = character.expressions && typeof character.expressions === 'object'
      ? Object.values(character.expressions)
      : []
    for (const value of expressions) {
      if (typeof value === 'string') pushUrlAsset(assets, value, 'sprite')
    }
  }
  // Vocabulary audio
  for (const vocab of unitDetail?.vocabularies ?? []) {
    pushUrlAsset(assets, vocab.audioUsUrl, 'voice')
    pushUrlAsset(assets, vocab.audioUkUrl, 'voice')
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

async function persistUnitContent(unitDetail: any, topicDetails: any[]) {
  await localDb.put('downloaded_unit_details', {
    id: unitDetail.id,
    ...unitDetail,
    downloadedAt: new Date().toISOString(),
  })
  console.log(`[learning-pack]   SQLite: downloaded_unit_details/${unitDetail.id} (unit)`)

  let inkCount = 0
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
    await localDb.put('downloaded_unit_details', {
      id: `topic:${topicDetail.topic.id}`,
      unitId: unitDetail.id,
      topicId: topicDetail.topic.id,
      detail: merged,
      updatedAt: new Date().toISOString(),
    })
  }
  console.log(`[learning-pack]   SQLite: ${topicDetails.length} 个 topic, ${inkCount} 个 ink_script`)
}

async function digest(buffer: ArrayBuffer, algorithm = 'SHA-256'): Promise<string> {
  const hash = await crypto.subtle.digest(algorithm, buffer)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
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
  await localDb.put('downloaded_packs', installed)
  const outboxItem = await syncOutbox.enqueue({
    entityType: 'learning_pack',
    entityId: manifest.packId,
    operation: 'create',
    payload: { packId: manifest.packId, version: manifest.version },
  })
  await syncOutbox.markSynced(outboxItem.id)
  return installed
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
        }
      }
      // Vocab audio from unitDetail (deduplicated)
      for (const vocab of unitDetail.vocabularies ?? []) {
        pushUrlAsset(assets, vocab.audioUsUrl, 'voice')
        pushUrlAsset(assets, vocab.audioUkUrl, 'voice')
      }
    }

    return {
      unitDetail,
      topicDetails,
      manifest: {
        packId: unitDetail.id,
        version: Date.now(),
        title: unitDetail.title,
        updatedAt: new Date().toISOString(),
        units: [unitDetail.id],
        topics: (unitDetail.trainingTopics ?? []).map((topic: any) => topic.id),
        vocabularies: (unitDetail.vocabularies ?? []).map((item: any) => item.id),
        chunks: (unitDetail.chunks ?? []).map((item: any) => item.id),
        sentencePatterns: (unitDetail.sentencePatterns ?? []).map((item: any) => item.pattern),
        scriptEpisodes: unitDetail.firstEpisode ? [unitDetail.firstEpisode.id] : [],
        inkScripts: topicDetails.map((detail: any) => detail.inkScript?.id).filter(Boolean),
        assets,
      },
    }
  },

  async installUnit(unitId: string): Promise<InstalledLearningPack> {
    try {
      console.log('[learning-pack] 📦 开始安装学习包 (zip 模式)...', { unitId })
      return await this.installUnitFromZip(unitId)
    } catch (error) {
      console.warn('[learning-pack] ⚠️ zip 安装失败，回退到 manifest 模式:', error)
    }

    const { manifest, unitDetail, topicDetails } = await this.buildManifestFromUnit(unitId)
    await persistUnitContent(unitDetail, topicDetails)
    await learningContentRepository.savePackContentIndex(manifest.packId, unitDetail.id ?? manifest.packId, unitDetail, topicDetails)
    return this.install(manifest)
  },

  async installUnitFromZip(unitId: string): Promise<InstalledLearningPack> {
    const startTime = performance.now()
    console.log('[learning-pack] ⏳ ① 下载 zip...')
    const zipBuffer = await learningApi.downloadPack(unitId)
    const zipSizeMB = (zipBuffer.byteLength / 1024 / 1024).toFixed(1)
    console.log(`[learning-pack] ✅ ① zip 下载完成: ${zipSizeMB} MB (${zipBuffer.byteLength} bytes)`)

    console.log('[learning-pack] ⏳ ② 解析 zip 条目...')
    const reader = new ZipReader(new BlobReader(new Blob([zipBuffer], { type: 'application/zip' })))
    try {
      const entryList = await reader.getEntries()
      const entries = new Map<string, Entry>()
      let fileCount = 0
      let dirCount = 0
      for (const entry of entryList) {
        if (entry.directory) { dirCount++; continue }
        fileCount++
        entries.set(normalizeZipPath(entry.filename), entry)
      }
      console.log(`[learning-pack] ✅ ② zip 解析完成: ${fileCount} 个文件, ${dirCount} 个目录`)

      console.log('[learning-pack] ⏳ ③ 读取 manifest + checksums...')
      const manifest = await readJsonEntry<LearningPackManifest>(entries, 'pack-manifest.json')
      const checksums = await readJsonEntry<Record<string, string>>(entries, 'checksums.json').catch(() => manifest.files ?? {})
      console.log(`[learning-pack] ✅ ③ manifest: v${manifest.version}, ${manifest.assets?.length ?? 0} 个资源, checksums: ${Object.keys(checksums).length} 项`)

      console.log('[learning-pack] ⏳ ④ 读取场景数据...')
      const sceneEntry = entries.get('content/scene.json')
      if (!sceneEntry) throw new Error('Pack is missing content/scene.json')
      const sceneText = await readEntryText(sceneEntry)
      await verifyEntry('content/scene.json', new TextEncoder().encode(sceneText).buffer, checksums)
      const unitDetail = JSON.parse(sceneText)
      console.log(`[learning-pack] ✅ ④ scene.json: ${sceneText.length} 字符, SHA256 校验通过`)

      console.log('[learning-pack] ⏳ ⑤ 读取话题数据...')
      const topicDetails: any[] = []
      for (const [path, entry] of entries) {
        if (!path.startsWith('content/topics/') || !path.endsWith('.json')) continue
        const text = await readEntryText(entry)
        await verifyEntry(path, new TextEncoder().encode(text).buffer, checksums)
        topicDetails.push(JSON.parse(text))
      }
      console.log(`[learning-pack] ✅ ⑤ 话题: ${topicDetails.length} 个`)

      const now = new Date().toISOString()
      console.log('[learning-pack] ⏳ ⑥ 写入 downloaded_packs 记录...')
      await localDb.put<InstalledLearningPack>('downloaded_packs', {
        id: manifest.packId,
        packId: manifest.packId,
        version: manifest.version,
        title: manifest.title,
        manifest,
        status: 'installing',
        installedAt: null,
        updatedAt: now,
      })

      console.log('[learning-pack] ⏳ ⑦ 持久化单元内容到 SQLite...')
      await persistUnitContent(unitDetail, topicDetails)
      console.log('[learning-pack] ✅ ⑦ 单元内容写入完成')

      console.log('[learning-pack] ⏳ ⑧ 写入内容索引表...')
      await learningContentRepository.savePackContentIndex(manifest.packId, unitDetail.id ?? unitId, unitDetail, topicDetails)
      console.log('[learning-pack] ✅ ⑧ 索引表写入完成')

      console.log(`[learning-pack] ⏳ ⑨ 提取资源文件 (${manifest.assets?.length ?? 0} 个)...`)
      let assetOk = 0
      let assetSkip = 0
      let assetFail = 0
      let assetDeduped = 0  // SHA256 已存在，跳过移动
      for (const asset of manifest.assets ?? []) {
        if (!asset.path) { assetSkip++; continue }
        const entry = entries.get(normalizeZipPath(asset.path))
        if (!entry) { assetSkip++; continue }
        try {
          const buffer = await readEntryBuffer(entry)
          await verifyEntry(normalizeZipPath(asset.path), buffer, checksums)
          const actualSha256 = await digest(buffer)

          // 检查全局资产池是否已有此 SHA256
          const allRefs = await localDb.list<any>('asset_refs')
          const existingRefs = allRefs.filter((r) => r.sha256 === actualSha256)
          const alreadyInPool = existingRefs.length > 0

          if (!alreadyInPool) {
            await assetCacheService.saveFromBuffer({ ...asset, sha256: actualSha256 }, buffer)
          } else {
            assetDeduped++
          }

          // 写入引用记录（无论文件是否已存在都要记）
          const ext = existingRefs[0]?.ext ?? extensionFrom(asset.path ?? asset.url, asset.mimeType)
          const nowIso = new Date().toISOString()
          await localDb.put('asset_refs', {
            id: `${manifest.packId}:${actualSha256}`,
            sha256: actualSha256,
            packId: manifest.packId,
            logicalPath: asset.path ?? asset.url ?? '',
            ext,
            updatedAt: nowIso,
            data: JSON.stringify({ role: asset.role }),
          })
          assetOk++
        } catch (e) {
          assetFail++
          console.warn(`[learning-pack] ⚠️ 资源失败: ${asset.path}`, e)
        }
      }
      console.log(`[learning-pack] ✅ ⑨ 资源提取完成: ${assetOk} 成功 (${assetDeduped} 去重复用), ${assetSkip} 跳过, ${assetFail} 失败`)

      const result = await persistInstalledRecord(manifest)
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      console.log(`[learning-pack] 🎉 安装完成! 耗时 ${elapsed}s`, {
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
  async installDelta(packId: string, fromVersion: number, toVersion: number): Promise<InstalledLearningPack> {
    const startTime = performance.now()
    console.log(`[learning-pack] 📦 开始安装增量包 v${fromVersion} → v${toVersion}`, { packId })

    const deltaBuffer = await learningApi.downloadDelta(packId, fromVersion, toVersion)
    const deltaSizeMB = (deltaBuffer.byteLength / 1024 / 1024).toFixed(1)
    console.log(`[learning-pack] ✅ delta 下载完成: ${deltaSizeMB} MB`)

    const reader = new ZipReader(new BlobReader(new Blob([deltaBuffer], { type: 'application/zip' })))
    try {
      const entryList = await reader.getEntries()
      const entries = new Map<string, Entry>()
      for (const entry of entryList) {
        if (!entry.directory) entries.set(normalizeZipPath(entry.filename), entry)
      }

      const deltaManifest = await readJsonEntry<any>(entries, 'delta-manifest.json')
      if (!deltaManifest) throw new Error('Delta pack is missing delta-manifest.json')
      console.log(`[learning-pack] delta manifest: +${deltaManifest.added?.length ?? 0} / ~${deltaManifest.modified?.length ?? 0} / -${deltaManifest.removed?.length ?? 0}`)

      // 1. 应用 added 文件
      const allAssetRefs = await localDb.list<any>('asset_refs')
      for (const path of deltaManifest.added ?? []) {
        const entry = entries.get(normalizeZipPath(path))
        if (!entry) continue
        const buffer = await readEntryBuffer(entry)
        const sha256 = await digest(buffer)

        const existingRefs = allAssetRefs.filter((r: any) => r.sha256 === sha256)
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
      console.log(`[learning-pack]   added: ${deltaManifest.added?.length ?? 0}`)

      // 2. 应用 modified 文件（替换旧 SHA256 → 新 SHA256）
      for (const path of deltaManifest.modified ?? []) {
        const entry = entries.get(normalizeZipPath(path))
        if (!entry) continue
        const buffer = await readEntryBuffer(entry)
        const newSha256 = await digest(buffer)

        // 删除旧引用（同一 packId + logicalPath 的旧记录）
        const oldRefs = allAssetRefs.filter((r: any) => r.packId === packId && r.logicalPath === path)
        for (const oldRef of oldRefs) {
          await localDb.delete('asset_refs', oldRef.id)
          // 检查是否还有其他包引用旧 SHA256
          const remaining = allAssetRefs.filter((r: any) => r.sha256 === oldRef.sha256 && r.id !== oldRef.id)
          if (remaining.length === 0) {
            await assetCacheService.remove(oldRef.sha256)
          }
        }

        const existingRefs = allAssetRefs.filter((r: any) => r.sha256 === newSha256)
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
      console.log(`[learning-pack]   modified: ${deltaManifest.modified?.length ?? 0}`)

      // 3. 应用 removed 文件
      for (const path of deltaManifest.removed ?? []) {
        const oldRefs = allAssetRefs.filter((r: any) => r.packId === packId && r.logicalPath === path)
        for (const oldRef of oldRefs) {
          await localDb.delete('asset_refs', oldRef.id)
          const remaining = allAssetRefs.filter((r: any) => r.sha256 === oldRef.sha256 && r.id !== oldRef.id)
          if (remaining.length === 0) {
            await assetCacheService.remove(oldRef.sha256)
          }
        }
      }
      console.log(`[learning-pack]   removed: ${deltaManifest.removed?.length ?? 0}`)

      // 4. 更新 pack 记录
      const pack = await localDb.get<InstalledLearningPack>('downloaded_packs', packId)
      if (pack) {
        await localDb.put('downloaded_packs', {
          ...pack,
          version: toVersion,
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
      console.log(`[learning-pack] 🎉 增量安装完成! 耗时 ${elapsed}s`)
      return (await localDb.get<InstalledLearningPack>('downloaded_packs', packId))!
    } finally {
      await reader.close()
    }
  },

  async install(manifest: LearningPackManifest): Promise<InstalledLearningPack> {
    const now = new Date().toISOString()
    const record: InstalledLearningPack = {
      id: manifest.packId,
      packId: manifest.packId,
      version: manifest.version,
      title: manifest.title,
      manifest,
      status: 'installing',
      installedAt: null,
      updatedAt: now,
    }
    await localDb.put('downloaded_packs', record)

    try {
      for (const asset of manifest.assets) {
        await assetCacheService.download(asset)
      }
      const installed = {
        ...record,
        status: 'installed' as const,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await localDb.put('downloaded_packs', installed)
      const outboxItem = await syncOutbox.enqueue({
        entityType: 'learning_pack',
        entityId: manifest.packId,
        operation: 'create',
        payload: { packId: manifest.packId, version: manifest.version },
      })
      await syncOutbox.markSynced(outboxItem.id)
      return installed
    } catch (error) {
      const failed = {
        ...record,
        status: 'failed' as const,
        updatedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
      }
      await localDb.put('downloaded_packs', failed)
      return failed
    }
  },

  async uninstall(packId: string): Promise<void> {
    const pack = await localDb.get<InstalledLearningPack>('downloaded_packs', packId)
    if (!pack) return

    // 清理 asset_refs（引用计数保护）
    const allRefs = await localDb.list<any>('asset_refs')
    const myRefs = allRefs.filter((r) => r.packId === packId)
    let deletedFiles = 0
    let keptFiles = 0
    for (const ref of myRefs) {
      await localDb.delete('asset_refs', ref.id)
      // 检查是否还有其他包引用此 SHA256（排除刚删除的）
      const remainingRefs = allRefs.filter(
        (r) => r.sha256 === ref.sha256 && r.packId !== packId,
      )
      if (remainingRefs.length === 0) {
        await assetCacheService.remove(ref.sha256)
        deletedFiles++
      } else {
        keptFiles++
      }
    }
    console.log(`[learning-pack] 🗑️ 资产清理: ${deletedFiles} 个文件删除, ${keptFiles} 个文件被其他包保留`)

    await localDb.delete('downloaded_packs', packId)
    await localDb.delete('downloaded_unit_details', packId)
    await localDb.deleteWhere<any>('downloaded_unit_details', (item) => item.unitId === packId)
    await localDb.deleteWhere<any>('ink_scripts', (item) => item.unitId === packId)
    await learningContentRepository.removePackContentIndex(packId)
    console.log(`[learning-pack] 🗑️ 已卸载: ${packId} (${pack.title} v${pack.version})`)
    const outboxItem = await syncOutbox.enqueue({
      entityType: 'learning_pack',
      entityId: packId,
      operation: 'delete',
      payload: { packId },
    })
    await syncOutbox.markSynced(outboxItem.id)
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

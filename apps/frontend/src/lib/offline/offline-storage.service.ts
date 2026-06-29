import { Directory, Filesystem } from '@capacitor/filesystem'
import { isNative } from '@/lib/native'
import { localDb } from './unified-storage'
import type { InstalledLearningPack } from './learning-pack.service'
import { learningPackService } from './learning-pack.service'
import type { LocalAsset } from './asset-cache.service'
import type { TableName } from './sqlite/schema'
import { learningContentRepository } from './learning-content.repository'
import { practiceRepository } from './practice.repository'
import type { SyncOutboxItem } from './sync-outbox'

export type OfflineCacheCategory = 'packs' | 'assets' | 'dictionary' | 'expressions' | 'all'

export interface OfflineStorageStats {
  downloadedPackCount: number
  downloadedPackBytes: number
  offlineVocabularyCount: number
  offlineChunkCount: number
  offlinePatternCount: number
  localAssetCount: number
  localAssetBytes: number
  dictionaryEntryCount: number
  dictionaryBytes: number
  expressionEntryCount: number
  expressionBytes: number
  pendingOutboxCount: number
  totalCacheBytes: number
}

export interface OfflineStorageDetails {
  packs: Array<{
    packId: string
    title: string
    version: number
    manifestVersion: number
    status: InstalledLearningPack['status']
    installedAt: string | null
    updatedAt: string
    bytes: number
    topicCount: number
    vocabularyCount: number
    chunkCount: number
    patternCount: number
    assetCount: number
    lastError?: string
  }>
  outbox: SyncOutboxItem[]
}

function approximateJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return 0
  }
}

function sumJsonBytes(values: unknown[]): number {
  return values.reduce<number>((sum, value) => sum + approximateJsonBytes(value), 0)
}

async function clearTables(tableNames: TableName[]): Promise<void> {
  for (const tableName of tableNames) {
    await localDb.clear(tableName)
  }
}

async function clearAssetFiles(): Promise<void> {
  if (!isNative()) return

  try {
    await Filesystem.rmdir({ path: 'offline-assets', directory: Directory.Data, recursive: true })
  } catch {
    // Directory may not exist.
  }
}

export const offlineStorageService = {
  async getStats(): Promise<OfflineStorageStats> {
    const [
      packs,
      unitDetails,
      inkScripts,
      offlineVocabularies,
      offlineChunks,
      offlinePatterns,
      offlineContentRefs,
      assets,
      dictionaries,
      expressions,
      outbox,
    ] = await Promise.all([
      localDb.list<InstalledLearningPack>('downloaded_packs'),
      localDb.list<any>('downloaded_unit_details'),
      localDb.list<any>('ink_scripts'),
      localDb.list<any>('offline_vocabularies'),
      localDb.list<any>('offline_chunks'),
      localDb.list<any>('offline_patterns'),
      localDb.list<any>('offline_content_refs'),
      localDb.list<LocalAsset>('local_assets'),
      localDb.list<any>('dictionary_entries'),
      localDb.list<any>('expression_entries'),
      localDb.list<any>('outbox'),
    ])

    const installedPacks = packs.filter((pack) => pack.status === 'installed')
    const installedPackIds = new Set(installedPacks.map((pack) => pack.packId))
    const downloadedUnitDetails = unitDetails.filter((item) => {
      const id = String(item?.id ?? '')
      const unitId = String(item?.unitId ?? '')
      return installedPackIds.has(id) || installedPackIds.has(unitId)
    })
    const downloadedInkScripts = inkScripts.filter((item) => installedPackIds.has(String(item?.unitId ?? '')))
    const readyAssets = assets.filter((asset) => asset.status === 'ready')
    const downloadedContentRefs = offlineContentRefs.filter((item) => installedPackIds.has(String(item?.packId ?? '')))
    const downloadedContentIds = {
      vocab: new Set(downloadedContentRefs.filter((item) => item.kind === 'vocab').map((item) => String(item.contentId))),
      chunk: new Set(downloadedContentRefs.filter((item) => item.kind === 'chunk').map((item) => String(item.contentId))),
      pattern: new Set(downloadedContentRefs.filter((item) => item.kind === 'pattern').map((item) => String(item.contentId))),
    }
    const downloadedVocabularies = offlineVocabularies.filter((item) => downloadedContentIds.vocab.has(String(item.id)))
    const downloadedChunks = offlineChunks.filter((item) => downloadedContentIds.chunk.has(String(item.id)))
    const downloadedPatterns = offlinePatterns.filter((item) => downloadedContentIds.pattern.has(String(item.id)))

    const downloadedPackBytes = sumJsonBytes([
      ...installedPacks,
      ...downloadedUnitDetails,
      ...downloadedInkScripts,
      ...downloadedVocabularies,
      ...downloadedChunks,
      ...downloadedPatterns,
      ...downloadedContentRefs,
    ])
    const dictionaryBytes = sumJsonBytes(dictionaries)
    const expressionBytes = sumJsonBytes(expressions)
    const localAssetBytes = readyAssets.reduce((sum, asset) => sum + Number(asset.size ?? 0), 0)

    return {
      downloadedPackCount: installedPacks.length,
      offlineVocabularyCount: downloadedVocabularies.length,
      offlineChunkCount: downloadedChunks.length,
      offlinePatternCount: downloadedPatterns.length,
      localAssetCount: readyAssets.length,
      localAssetBytes,
      downloadedPackBytes,
      dictionaryEntryCount: dictionaries.length,
      dictionaryBytes,
      expressionEntryCount: expressions.length,
      expressionBytes,
      pendingOutboxCount: outbox.filter((item) => item.status === 'pending' || item.status === 'failed').length,
      totalCacheBytes: downloadedPackBytes + localAssetBytes + dictionaryBytes + expressionBytes,
    }
  },

  async getDetails(): Promise<OfflineStorageDetails> {
    const [packs, unitDetails, inkScripts, offlineVocabularies, offlineChunks, offlinePatterns, offlineContentRefs, outbox] = await Promise.all([
      localDb.list<InstalledLearningPack>('downloaded_packs'),
      localDb.list<any>('downloaded_unit_details'),
      localDb.list<any>('ink_scripts'),
      localDb.list<any>('offline_vocabularies'),
      localDb.list<any>('offline_chunks'),
      localDb.list<any>('offline_patterns'),
      localDb.list<any>('offline_content_refs'),
      localDb.list<SyncOutboxItem>('outbox'),
    ])

    const packDetails = packs
      .filter((pack) => pack.status === 'installed' || pack.status === 'failed' || pack.status === 'installing')
      .map((pack) => {
        const relatedUnitDetails = unitDetails.filter((item) => {
          const id = String(item?.id ?? '')
          const unitId = String(item?.unitId ?? '')
          return id === pack.packId || unitId === pack.packId
        })
        const relatedInkScripts = inkScripts.filter((item) => String(item?.unitId ?? '') === pack.packId)
        const relatedRefs = offlineContentRefs.filter((item) => String(item?.packId ?? '') === pack.packId)
        const vocabIds = new Set(relatedRefs.filter((item) => item.kind === 'vocab').map((item) => String(item.contentId)))
        const chunkIds = new Set(relatedRefs.filter((item) => item.kind === 'chunk').map((item) => String(item.contentId)))
        const patternIds = new Set(relatedRefs.filter((item) => item.kind === 'pattern').map((item) => String(item.contentId)))
        const relatedVocabularies = offlineVocabularies.filter((item) => vocabIds.has(String(item.id)))
        const relatedChunks = offlineChunks.filter((item) => chunkIds.has(String(item.id)))
        const relatedPatterns = offlinePatterns.filter((item) => patternIds.has(String(item.id)))
        return {
          packId: pack.packId,
          title: pack.title,
          version: pack.version,
          manifestVersion: pack.manifest?.version ?? pack.version,
          status: pack.status,
          installedAt: pack.installedAt,
          updatedAt: pack.updatedAt,
          bytes: sumJsonBytes([
            pack,
            ...relatedUnitDetails,
            ...relatedInkScripts,
            ...relatedVocabularies,
            ...relatedChunks,
            ...relatedPatterns,
            ...relatedRefs,
          ]),
          topicCount: pack.manifest?.topics?.length ?? relatedUnitDetails.filter((item) => item?.topicId).length,
          vocabularyCount: vocabIds.size || pack.manifest?.vocabularies?.length || 0,
          chunkCount: chunkIds.size || pack.manifest?.chunks?.length || 0,
          patternCount: patternIds.size || pack.manifest?.sentencePatterns?.length || 0,
          assetCount: pack.manifest?.assets?.length ?? 0,
          lastError: pack.lastError,
        }
      })
      .sort((a, b) => (b.installedAt ?? b.updatedAt).localeCompare(a.installedAt ?? a.updatedAt))

    return {
      packs: packDetails,
      outbox: outbox
        .filter((item) => item.status === 'pending' || item.status === 'failed' || item.status === 'syncing')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }
  },

  async clearPack(packId: string): Promise<void> {
    await learningPackService.uninstall(packId)
  },

  async clearCategory(category: OfflineCacheCategory): Promise<void> {
    if (category === 'all') {
      await this.clearCategory('packs')
      await this.clearCategory('assets')
      await this.clearCategory('dictionary')
      await this.clearCategory('expressions')
      await practiceRepository.clearPracticeRecordsCache()
      return
    }

    if (category === 'packs') {
      await clearTables(['downloaded_packs', 'downloaded_unit_details', 'ink_scripts'])
      await clearTables(['offline_vocabularies', 'offline_chunks', 'offline_patterns', 'offline_content_refs'])
      return
    }

    if (category === 'assets') {
      await localDb.clear('local_assets')
      await clearAssetFiles()
      return
    }

    if (category === 'dictionary') {
      await localDb.clear('dictionary_entries')
      return
    }

    if (category === 'expressions') {
      await localDb.clear('expression_entries')
      await learningContentRepository.clearExpressionCacheMarkers()
    }
  },

  async clearCache(): Promise<void> {
    await this.clearCategory('all')
  },
}

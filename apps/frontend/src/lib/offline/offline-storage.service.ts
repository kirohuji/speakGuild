import { Directory, Filesystem } from '@capacitor/filesystem'
import { isNative } from '@/lib/native'
import { localDb } from './unified-storage'
import type { InstalledLearningPack } from './learning-pack.service'
import type { LocalAsset } from './asset-cache.service'
import type { TableName } from './sqlite/schema'

export type OfflineCacheCategory = 'packs' | 'assets' | 'dictionary' | 'expressions' | 'all'

export interface OfflineStorageStats {
  downloadedPackCount: number
  downloadedPackBytes: number
  localAssetCount: number
  localAssetBytes: number
  dictionaryEntryCount: number
  dictionaryBytes: number
  expressionEntryCount: number
  expressionBytes: number
  pendingOutboxCount: number
  totalCacheBytes: number
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
  await Promise.all(tableNames.map((tableName) => localDb.clear(tableName)))
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
    const [packs, unitDetails, inkScripts, assets, dictionaries, expressions, outbox] = await Promise.all([
      localDb.list<InstalledLearningPack>('downloaded_packs'),
      localDb.list<any>('downloaded_unit_details'),
      localDb.list<any>('ink_scripts'),
      localDb.list<LocalAsset>('local_assets'),
      localDb.list<any>('dictionary_entries'),
      localDb.list<any>('expression_entries'),
      localDb.list<any>('outbox'),
    ])

    const downloadedPackBytes = sumJsonBytes([...packs, ...unitDetails, ...inkScripts])
    const dictionaryBytes = sumJsonBytes(dictionaries)
    const expressionBytes = sumJsonBytes(expressions)
    const localAssetBytes = assets.reduce((sum, asset) => sum + Number(asset.size ?? 0), 0)

    return {
      downloadedPackCount: packs.filter((pack) => pack.status === 'installed').length,
      localAssetCount: assets.filter((asset) => asset.status === 'ready').length,
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

  async clearCategory(category: OfflineCacheCategory): Promise<void> {
    if (category === 'all') {
      await Promise.all([
        this.clearCategory('packs'),
        this.clearCategory('assets'),
        this.clearCategory('dictionary'),
        this.clearCategory('expressions'),
      ])
      return
    }

    if (category === 'packs') {
      await clearTables(['downloaded_packs', 'downloaded_unit_details', 'ink_scripts'])
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
    }
  },

  async clearCache(): Promise<void> {
    await this.clearCategory('all')
  },
}

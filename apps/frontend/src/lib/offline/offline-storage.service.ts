import { Directory, Filesystem } from '@capacitor/filesystem'
import { isNative } from '@/lib/native'
import { localDb } from './unified-storage'
import type { InstalledLearningPack } from './learning-pack.service'
import type { LocalAsset } from './asset-cache.service'

export interface OfflineStorageStats {
  downloadedPackCount: number
  localAssetCount: number
  localAssetBytes: number
  dictionaryEntryCount: number
  expressionEntryCount: number
  pendingOutboxCount: number
  storageEstimate?: {
    usage?: number
    quota?: number
  }
}

export const offlineStorageService = {
  async getStats(): Promise<OfflineStorageStats> {
    const [packs, assets, dictionaries, expressions, outbox] = await Promise.all([
      localDb.list<InstalledLearningPack>('downloaded_packs'),
      localDb.list<LocalAsset>('local_assets'),
      localDb.list<any>('dictionary_entries'),
      localDb.list<any>('expression_entries'),
      localDb.list<any>('outbox'),
    ])

    const storageEstimate = navigator.storage?.estimate
      ? await navigator.storage.estimate().catch(() => undefined)
      : undefined

    return {
      downloadedPackCount: packs.filter((pack) => pack.status === 'installed').length,
      localAssetCount: assets.filter((asset) => asset.status === 'ready').length,
      localAssetBytes: assets.reduce((sum, asset) => sum + Number(asset.size ?? 0), 0),
      dictionaryEntryCount: dictionaries.length,
      expressionEntryCount: expressions.length,
      pendingOutboxCount: outbox.filter((item) => item.status === 'pending' || item.status === 'failed').length,
      storageEstimate,
    }
  },

  async clearCache(): Promise<void> {
    await Promise.all([
      localDb.clear('downloaded_packs'),
      localDb.clear('downloaded_unit_details'),
      localDb.clear('ink_scripts'),
      localDb.clear('dictionary_entries'),
      localDb.clear('expression_entries'),
      localDb.clear('local_assets'),
    ])

    if (isNative()) {
      try {
        await Filesystem.rmdir({ path: 'offline-assets', directory: Directory.Data, recursive: true })
      } catch {
        // Directory may not exist.
      }
    }
  },
}

import { assetCacheService, type AssetRef } from './asset-cache.service'
import { learningApi } from '@/features/learning/api/learning-api'
import { learningRepository } from './learning.repository'
import { localDb } from './unified-storage'
import { practiceRepository } from './practice.repository'
import { syncOutbox } from './sync-outbox'

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

  for (const topicDetail of topicDetails) {
    if (topicDetail?.inkScript) {
      await localDb.put('ink_scripts', {
        id: topicDetail.inkScript.id,
        topicId: topicDetail.topic.id,
        unitId: unitDetail.id,
        ...topicDetail.inkScript,
        updatedAt: new Date().toISOString(),
      })
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
    if (unitDetail.scene) {
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
    const { manifest, unitDetail, topicDetails } = await this.buildManifestFromUnit(unitId)
    await persistUnitContent(unitDetail, topicDetails)
    return this.install(manifest)
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
      await syncOutbox.enqueue({
        entityType: 'learning_pack',
        entityId: manifest.packId,
        operation: 'create',
        payload: { packId: manifest.packId, version: manifest.version },
      })
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

    const otherPacks = (await localDb.list<InstalledLearningPack>('downloaded_packs'))
      .filter((item) => item.packId !== packId && item.status === 'installed')
    const stillUsed = new Set(
      otherPacks.flatMap((item) => item.manifest.assets.map((asset) => asset.assetId || asset.sha256 || asset.url)),
    )

    for (const asset of pack.manifest.assets) {
      const key = asset.assetId || asset.sha256 || asset.url
      if (!stillUsed.has(key)) await assetCacheService.removeRef(asset)
    }

    await localDb.delete('downloaded_packs', packId)
    await localDb.delete('downloaded_unit_details', packId)
    await localDb.deleteWhere<any>('downloaded_unit_details', (item) => item.unitId === packId)
    await localDb.deleteWhere<any>('ink_scripts', (item) => item.unitId === packId)
    await syncOutbox.enqueue({
      entityType: 'learning_pack',
      entityId: packId,
      operation: 'delete',
      payload: { packId },
    })
  },

  listInstalled(): Promise<InstalledLearningPack[]> {
    return localDb.list<InstalledLearningPack>('downloaded_packs')
  },

  async isInstalled(packId: string): Promise<boolean> {
    const pack = await localDb.get<InstalledLearningPack>('downloaded_packs', packId)
    return pack?.status === 'installed'
  },
}

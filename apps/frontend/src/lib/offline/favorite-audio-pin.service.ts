import { fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'
import { assetCacheService, type LocalAsset } from './asset-cache.service'
import { stableRemoteUrl } from './asset-url-identity'
import { localDb } from './unified-storage'

type ExpressionAudioEntry = {
  id: string
  contentSnapshot?: unknown
  sourceSnapshot?: unknown
}

export const FAVORITE_AUDIO_PACK_PREFIX = 'favorite:'

export function favoriteAudioPackId(expressionEntryId: string) {
  return `${FAVORITE_AUDIO_PACK_PREFIX}${expressionEntryId}`
}

export function isFavoriteAudioPackId(packId: string | null | undefined) {
  return String(packId ?? '').startsWith(FAVORITE_AUDIO_PACK_PREFIX)
}

function normalizePlaybackUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return null
  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
}

/** Collect pronunciation + example audio URLs from a content snapshot. */
export function collectPlaybackUrls(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  const record = snapshot as Record<string, unknown>
  const urls: string[] = []
  const push = (value: unknown) => {
    const url = normalizePlaybackUrl(value)
    if (url) urls.push(url)
  }
  push(record.audioUsUrl)
  push(record.audioUkUrl)
  push(record.audioUrl)
  if (Array.isArray(record.examples)) {
    for (const example of record.examples) {
      if (!example || typeof example !== 'object') continue
      push((example as Record<string, unknown>).audioUrl)
    }
  }
  return [...new Set(urls)]
}

function extensionFrom(url: string) {
  try {
    const pathname = new URL(stableRemoteUrl(url)).pathname
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i)
    if (match) return match[1].toLowerCase()
  } catch {
    const match = url.match(/\.([a-z0-9]{2,5})(?:$|\?)/i)
    if (match) return match[1].toLowerCase()
  }
  return 'mp3'
}

function sha256FromAsset(asset: LocalAsset): string | null {
  if (asset.sha256) return asset.sha256
  const canonical = asset.assetId || asset.id
  // Pack installs key physical files by sha256 hex.
  if (/^[a-f0-9]{64}$/i.test(canonical)) return canonical.toLowerCase()
  return null
}

async function materializeAndResolveSha(url: string): Promise<{ sha256: string; url: string } | null> {
  const { resolvePlaybackAudio } = await import('./playback-audio')
  const resolved = await resolvePlaybackAudio({ url, role: 'voice' })
  if (!resolved) return null
  const asset = await assetCacheService.findReadyAssetForUrl(url, fileAssetIdFromUrl(url))
  const sha256 = asset ? sha256FromAsset(asset) : null
  if (!sha256) return null
  return { sha256, url }
}

export const favoriteAudioPinService = {
  async pinExpressionAudio(entry: ExpressionAudioEntry): Promise<void> {
    if (!isNative() || !entry?.id) return
    const urls = collectPlaybackUrls(entry.contentSnapshot ?? entry.sourceSnapshot)
    if (urls.length === 0) return

    const packId = favoriteAudioPackId(entry.id)
    const now = new Date().toISOString()
    for (const url of urls) {
      try {
        const materialized = await materializeAndResolveSha(url)
        if (!materialized) continue
        const { sha256 } = materialized
        const id = `${packId}:${sha256}`
        const existing = await localDb.get<any>('asset_refs', id)
        if (existing) continue
        await localDb.put('asset_refs', {
          id,
          sha256,
          packId,
          logicalPath: `favorite/${entry.id}/${sha256}.${extensionFrom(url)}`,
          ext: extensionFrom(url),
          updatedAt: now,
          data: JSON.stringify({
            role: 'favorite_audio',
            expressionEntryId: entry.id,
            contentUrl: url,
            pinnedAt: now,
          }),
        })
        await assetCacheService.addAliases(sha256, {
          url,
          fileAssetId: fileAssetIdFromUrl(url) ?? undefined,
          sha256,
          role: 'favorite_audio',
        })
      } catch (error) {
        console.warn('[favorite-audio-pin] pin failed', { entryId: entry.id, url, error })
      }
    }
  },

  async unpinExpressionAudio(expressionEntryId: string): Promise<void> {
    if (!expressionEntryId) return
    const packId = favoriteAudioPackId(expressionEntryId)
    const refs = await localDb.findByIndex<{ id: string; sha256: string }>('asset_refs', 'pack_id', packId)
    if (refs.length === 0) return
    const shas = [...new Set(refs.map((ref) => ref.sha256).filter(Boolean))]
    await localDb.deleteByIndex('asset_refs', 'pack_id', packId)
    await Promise.all(shas.map((sha256) => assetCacheService.releaseIfUnreferenced(sha256)))
  },

  /**
   * If this expression has audio URLs but no favorite refs yet (e.g. pin failed
   * during save), try once more. No-op when already pinned.
   */
  async ensurePinned(entry: ExpressionAudioEntry): Promise<void> {
    if (!isNative() || !entry?.id) return
    const urls = collectPlaybackUrls(entry.contentSnapshot ?? entry.sourceSnapshot)
    if (urls.length === 0) return
    const existing = await localDb.findByIndex('asset_refs', 'pack_id', favoriteAudioPackId(entry.id))
    if (existing.length > 0) return
    await this.pinExpressionAudio(entry)
  },

  async pinMany(entries: ExpressionAudioEntry[]): Promise<void> {
    if (!isNative() || entries.length === 0) return
    for (const entry of entries) {
      await this.ensurePinned(entry).catch((error) => {
        console.warn('[favorite-audio-pin] ensurePinned failed', { entryId: entry.id, error })
      })
    }
  },
}

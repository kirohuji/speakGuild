import { createFileAssetReference, fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'
import { audioDiag } from './audio-playback-diag'
import { assetCacheService, type LocalAsset } from './asset-cache.service'
import {
  canonicalContentUrl,
  isExternalAudioUrl,
  stableRemoteUrl,
} from './asset-url-identity'
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

async function materializeAndResolveSha(url: string): Promise<{ sha256: string; url: string; fileAssetId: string | null } | null> {
  const fileAssetId = fileAssetIdFromUrl(url)
  const { resolvePlaybackAudio } = await import('./playback-audio')
  const resolved = await resolvePlaybackAudio({ url, assetId: fileAssetId, role: 'voice' })
  if (!resolved) return null
  const asset = await assetCacheService.findReadyAssetForUrl(url, fileAssetId)
  const sha256 = asset ? sha256FromAsset(asset) : null
  if (!sha256) {
    audioDiag('library.pin_no_sha', {
      url,
      fileAssetId,
      assetId: asset?.id ?? null,
      hasLocalUri: Boolean(asset?.localUri),
    })
    return null
  }
  return {
    sha256,
    url: canonicalContentUrl(fileAssetId, url) || url,
    fileAssetId,
  }
}

export const favoriteAudioPinService = {
  async pinExpressionAudio(entry: ExpressionAudioEntry): Promise<void> {
    if (!isNative() || !entry?.id) return
    const urls = collectPlaybackUrls(entry.contentSnapshot ?? entry.sourceSnapshot)
    audioDiag('library.pin_start', {
      entryId: entry.id,
      urlCount: urls.length,
      urls: urls.slice(0, 8),
    })
    if (urls.length === 0) return

    const packId = favoriteAudioPackId(entry.id)
    const now = new Date().toISOString()
    let pinned = 0
    let skipped = 0
    for (const url of urls) {
      try {
        if (isExternalAudioUrl(url)) {
          skipped += 1
          audioDiag('library.pin_url_external_skip', { entryId: entry.id, url })
          continue
        }
        const materialized = await materializeAndResolveSha(url)
        if (!materialized) {
          skipped += 1
          audioDiag('library.pin_url_miss', { entryId: entry.id, url })
          continue
        }
        const { sha256, url: contentUrl, fileAssetId } = materialized
        const id = `${packId}:${sha256}`
        const existing = await localDb.get<any>('asset_refs', id)
        if (existing) {
          skipped += 1
          audioDiag('library.pin_url_already', { entryId: entry.id, url: contentUrl, sha256: sha256.slice(0, 12) })
          continue
        }
        await localDb.put('asset_refs', {
          id,
          sha256,
          packId,
          logicalPath: `favorite/${entry.id}/${sha256}.${extensionFrom(contentUrl)}`,
          ext: extensionFrom(contentUrl),
          updatedAt: now,
          data: JSON.stringify({
            role: 'favorite_audio',
            expressionEntryId: entry.id,
            contentUrl,
            pinnedAt: now,
          }),
        })
        await assetCacheService.addAliases(sha256, {
          url: contentUrl,
          fileAssetId: fileAssetId ?? undefined,
          sha256,
          role: 'favorite_audio',
        })
        // Also alias the managed asset:// form when the snapshot still used a content URL.
        if (fileAssetId) {
          await assetCacheService.addAliases(sha256, {
            url: createFileAssetReference(fileAssetId),
            fileAssetId,
            sha256,
            role: 'favorite_audio',
          })
        }
        pinned += 1
        audioDiag('library.pin_url_ok', { entryId: entry.id, url: contentUrl, sha256: sha256.slice(0, 12) })
      } catch (error) {
        skipped += 1
        audioDiag('library.pin_url_error', {
          entryId: entry.id,
          url,
          error: error instanceof Error ? error.message : String(error),
        })
        console.warn('[favorite-audio-pin] pin failed', { entryId: entry.id, url, error })
      }
    }
    audioDiag('library.pin_done', { entryId: entry.id, pinned, skipped, urlCount: urls.length })
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

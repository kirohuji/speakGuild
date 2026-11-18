import { LOCAL_RECORDING_SCHEME, resolveLocalRecording } from './user-recordings'
import { getFileAssetPrivateUrl } from '@/features/file-assets/api'
import { fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'
import { audioDiag } from './audio-playback-diag'
import { assetCacheService, isCachedPlaybackUrl, OFFLINE_RESOURCE_MISSING } from './asset-cache.service'
import { deferredPackAssetService } from './deferred-pack-asset.service'

function normalizeUrl(url: string) {
  return url.startsWith('//') ? `https:${url}` : url
}

/**
 * Play audio that may already live in an installed pack.
 * A missing local file is downloaded once and kept for the next play.
 */
function isPlayable(url: string, asFileUri: boolean) {
  if (asFileUri) return url.startsWith('file://')
  return isCachedPlaybackUrl(url)
}

export async function resolvePlaybackAudio(input: {
  url?: string | null
  assetId?: string | null
  role?: string
  /** NativeAudio needs a file:// URI. The WebView player needs a capacitor:// URL. */
  asFileUri?: boolean
}): Promise<string | null> {
  if (input.url?.startsWith(LOCAL_RECORDING_SCHEME)) return resolveLocalRecording(input.url)
  const rawUrl = input.url ? normalizeUrl(input.url) : ''
  const assetId = input.assetId || fileAssetIdFromUrl(rawUrl) || null
  const role = input.role ?? 'voice'
  const asFileUri = input.asFileUri === true

  audioDiag('resolve.start', { url: rawUrl || null, assetId, role, asFileUri, native: isNative() })

  if (!isNative()) {
    if (!assetId) {
      audioDiag('resolve.web_raw', { url: rawUrl || null })
      return rawUrl || null
    }
    try {
      const fresh = await getFileAssetPrivateUrl(assetId)
      audioDiag('resolve.web_signed', { assetId, url: fresh.url })
      return fresh.url
    } catch {
      audioDiag('resolve.web_signed_failed', { assetId, url: rawUrl || null })
      return rawUrl || null
    }
  }

  if (rawUrl && isPlayable(rawUrl, asFileUri)) {
    audioDiag('resolve.already_local', { url: rawUrl })
    return rawUrl
  }

  if (rawUrl) {
    const local = await assetCacheService.resolve({
      url: rawUrl,
      assetId: assetId ?? undefined,
      role,
      asFileUri,
    }).catch(() => '')
    const playable = Boolean(local && local !== OFFLINE_RESOURCE_MISSING && isPlayable(local, asFileUri))
    audioDiag('resolve.cache', {
      url: rawUrl,
      assetId,
      got: local || null,
      playable,
      missing: local === OFFLINE_RESOURCE_MISSING,
    })
    if (playable) return local
  }

  // Vocabulary pronunciations included in a native learning pack are indexed
  // but not extracted during installation. Materialize only the requested ZIP
  // entry before falling back to the normal signed-URL network path.
  if (rawUrl) {
    const deferred = await deferredPackAssetService.resolve({
      url: rawUrl,
      assetId,
      role,
      asFileUri,
    }).catch(() => null)
    const playable = Boolean(deferred && isPlayable(deferred, asFileUri))
    audioDiag('resolve.deferred', { url: rawUrl, assetId, got: deferred, playable })
    if (playable) return deferred
  }

  if (!assetId) {
    audioDiag('resolve.fail_no_asset_id', { url: rawUrl || null, role })
    return null
  }
  try {
    const fresh = await getFileAssetPrivateUrl(assetId)
    const downloaded = await assetCacheService.download({
      url: fresh.url,
      assetId,
      role,
      asFileUri,
    })
    const playable = Boolean(downloaded && isPlayable(downloaded, asFileUri))
    audioDiag('resolve.network_download', { assetId, url: fresh.url, got: downloaded, playable })
    return playable ? downloaded : null
  } catch (error) {
    audioDiag('resolve.network_failed', {
      assetId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

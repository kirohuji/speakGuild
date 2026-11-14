import { LOCAL_RECORDING_SCHEME, resolveLocalRecording } from './user-recordings'
import { getFileAssetPrivateUrl } from '@/features/file-assets/api'
import { fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'
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

  if (!isNative()) {
    if (!assetId) return rawUrl || null
    try {
      const fresh = await getFileAssetPrivateUrl(assetId)
      return fresh.url
    } catch {
      return rawUrl || null
    }
  }

  if (rawUrl && isPlayable(rawUrl, asFileUri)) return rawUrl

  if (rawUrl) {
    const local = await assetCacheService.resolve({
      url: rawUrl,
      assetId: assetId ?? undefined,
      role,
      asFileUri,
    }).catch(() => '')
    if (local && local !== OFFLINE_RESOURCE_MISSING && isPlayable(local, asFileUri)) return local
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
    if (deferred && isPlayable(deferred, asFileUri)) return deferred
  }

  if (!assetId) return null
  try {
    const fresh = await getFileAssetPrivateUrl(assetId)
    const downloaded = await assetCacheService.download({
      url: fresh.url,
      assetId,
      role,
      asFileUri,
    })
    return downloaded && isPlayable(downloaded, asFileUri) ? downloaded : null
  } catch {
    return null
  }
}

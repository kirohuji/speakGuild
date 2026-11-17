import {
  createFileAssetReference,
  parseFileAssetReference,
} from '@/lib/file-asset-reference'

/**
 * Stable identity for cache aliases / deferred lookup.
 *
 * COS signed URLs change query tokens; pathname is enough there.
 * `asset://` is a non-special scheme whose URL `origin` is the opaque string
 * `"null"`, so `origin+pathname` would collapse every file onto one alias and
 * make insight-dialog example playback randomly return another word's audio.
 */
export function stableRemoteUrl(url: string) {
  const assetRef = parseFileAssetReference(url)
  if (assetRef) return createFileAssetReference(assetRef.assetId, assetRef.suffix)
  try {
    const parsed = new URL(url)
    // Opaque origins must never become shared alias keys.
    if (!parsed.origin || parsed.origin === 'null') {
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
    }
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url
  }
}

/** True when a stable-url digest would collide across unrelated resources. */
export function isCollapsedOpaqueStableUrl(stable: string) {
  return stable === 'null' || stable === 'null/'
}

import {
  createFileAssetReference,
  fileAssetIdFromUrl,
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

/**
 * Offline-playable audio identity rank (higher = better for native playback).
 * L3 (signed COS) is only for deferred lookup helpers, not long-lived snapshots.
 */
export type AudioUrlRank = 0 | 1 | 2 | 3

function isLocalPlaybackUrl(url: string) {
  return url.startsWith('capacitor://')
    || url.startsWith('file:')
    || url.startsWith('blob:')
    || url.startsWith('data:')
    || url.startsWith('http://localhost/_capacitor_file_')
    || url.startsWith('https://localhost/_capacitor_file_')
}

/** L1 asset:// or L2 /file-assets/{id}/content — managed FileAsset identity. */
export function isManagedAudioUrl(url?: string | null): boolean {
  if (!url?.trim()) return false
  return Boolean(fileAssetIdFromUrl(url.trim()))
}

/**
 * L0 external URL: no FileAsset id and not an already-local playback URL.
 * Wikimedia and other third-party hosts fall here.
 */
export function isExternalAudioUrl(url?: string | null): boolean {
  const trimmed = url?.trim()
  if (!trimmed) return false
  if (isLocalPlaybackUrl(trimmed)) return false
  if (fileAssetIdFromUrl(trimmed)) return false
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')
}

export function audioUrlRank(url?: string | null): AudioUrlRank {
  const trimmed = url?.trim()
  if (!trimmed) return 0
  if (parseFileAssetReference(trimmed)) return 3
  if (fileAssetIdFromUrl(trimmed)) return 2
  if (isLocalPlaybackUrl(trimmed)) return 2
  // Signed pack URLs still beat bare third-party links for lookup, but lose to managed ids.
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    return isExternalAudioUrl(trimmed) ? 0 : 1
  }
  return 0
}

/**
 * Prefer the URL that is better for native offline playback.
 * Same rank keeps `current` (stable; avoid churn).
 */
export function preferAudioUrl(current?: string | null, candidate?: string | null): string | null {
  const left = typeof current === 'string' && current.trim() ? current.trim() : null
  const right = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
  if (!left) return right
  if (!right) return left
  const leftRank = audioUrlRank(left)
  const rightRank = audioUrlRank(right)
  if (rightRank > leftRank) return right
  return left
}

/** Canonical pack/content URL: prefer asset:// when a FileAsset id is known. */
export function canonicalContentUrl(
  fileAssetId?: string | null,
  fallbackUrl?: string | null,
): string | null {
  const id = fileAssetId?.trim() || fileAssetIdFromUrl(fallbackUrl) || null
  if (id) return createFileAssetReference(id)
  const fallback = fallbackUrl?.trim()
  return fallback || null
}

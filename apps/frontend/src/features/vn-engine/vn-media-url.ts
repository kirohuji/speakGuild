/**
 * Strict VN media URL helpers.
 *
 * Ink aliases (bg_*, audio_*, …) are identity keys, never browser paths.
 * Callers must only hand playable URLs to <img>, <audio>, or Pixi.
 */

import { fileAssetIdFromUrl, getFileAssetContentUrl, resolveDisplayAssetUrl } from '@/lib/file-asset-reference'

export type VnAssetMapEntry = {
  fileAssetId?: string
  signedUrl?: string | null
  type?: string
  mimeType?: string | null
}

export type VnAssetMap = Record<string, VnAssetMapEntry>

const PLAYABLE_URL =
  /^(data:|blob:|file:|capacitor:|https?:)/i
const CAPACITOR_LOCAL_HTTP =
  /^https?:\/\/localhost\/_capacitor_file_/i

/** True when the string can be loaded by WebView / Pixi / HTML media elements. */
export function isPlayableMediaUrl(url?: string | null): url is string {
  if (!url) return false
  return PLAYABLE_URL.test(url) || CAPACITOR_LOCAL_HTTP.test(url)
}

/** Ink registry keys and other non-URL tokens that must never hit the network as paths. */
export function isVnAssetAlias(value?: string | null): boolean {
  if (!value) return false
  if (PLAYABLE_URL.test(value) || CAPACITOR_LOCAL_HTTP.test(value)) return false
  if (value.startsWith('asset://')) return false
  if (/^(bg_|audio_)[a-z0-9_]+$/i.test(value)) return true
  // Bare token with no scheme and no path — treat as unresolved alias.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.includes('/') && !value.startsWith('//')) {
    return true
  }
  return false
}

function isCookieBoundContentUrl(url?: string | null): boolean {
  if (!url) return false
  try {
    return /\/file-assets\/[^/]+\/content\/?$/i.test(new URL(url, 'http://manyu.local').pathname)
  } catch {
    return false
  }
}

/**
 * Resolve a background / image tag value to a playable URL.
 * Accepts ink aliases (via assetMap), asset:// refs, and plain http(s) URLs.
 * Unresolved aliases never fall through as relative browser paths.
 *
 * `preferSigned` keeps Remotion-safe URLs only (no cookie-bound content proxies).
 */
export function resolveVnImageUrl(
  value: string | undefined,
  assetMap?: VnAssetMap | null,
  options?: { preferSigned?: boolean },
): string | undefined {
  if (!value) return undefined
  const preferSigned = Boolean(options?.preferSigned)

  if (assetMap && Object.prototype.hasOwnProperty.call(assetMap, value)) {
    const entry = assetMap[value]
    if (isPlayableMediaUrl(entry?.signedUrl)) return entry!.signedUrl!
    if (preferSigned) {
      // Remotion cannot authenticate /file-assets/:id/content — leave the
      // asset:// / bare id for the render service to re-sign.
      if (entry?.fileAssetId) return `asset://${encodeURIComponent(entry.fileAssetId)}`
      const signedId = fileAssetIdFromUrl(entry?.signedUrl)
      if (signedId) return `asset://${encodeURIComponent(signedId)}`
      return undefined
    }
    if (entry?.fileAssetId) return getFileAssetContentUrl(entry.fileAssetId)
    const signedId = fileAssetIdFromUrl(entry?.signedUrl)
    if (signedId) return getFileAssetContentUrl(signedId)
    return undefined
  }

  if (isPlayableMediaUrl(value)) {
    if (preferSigned && isCookieBoundContentUrl(value)) {
      const assetId = fileAssetIdFromUrl(value)
      return assetId ? `asset://${encodeURIComponent(assetId)}` : undefined
    }
    return value
  }

  const assetId = fileAssetIdFromUrl(value)
  if (assetId) {
    return preferSigned
      ? `asset://${encodeURIComponent(assetId)}`
      : getFileAssetContentUrl(assetId)
  }

  const displayed = resolveDisplayAssetUrl(value)
  return isPlayableMediaUrl(displayed) ? displayed : undefined
}

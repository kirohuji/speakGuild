/**
 * Strict VN media URL helpers.
 *
 * Ink aliases (bg_*, audio_*, …) are identity keys, never browser paths.
 * Callers must only hand playable URLs to <img>, <audio>, or Pixi.
 */

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
  if (/^(bg_|audio_)[a-z0-9_]+$/i.test(value)) return true
  // Bare token with no scheme and no path — treat as unresolved alias.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.includes('/') && !value.startsWith('//')) {
    return true
  }
  return false
}

/**
 * Resolve a background / image tag value to a playable URL.
 * Map hits without a playable signedUrl, and unresolved aliases, become undefined.
 */
export function resolveVnImageUrl(
  value: string | undefined,
  assetMap?: VnAssetMap | null,
): string | undefined {
  if (!value) return undefined
  if (assetMap && Object.prototype.hasOwnProperty.call(assetMap, value)) {
    const signed = assetMap[value]?.signedUrl
    return isPlayableMediaUrl(signed) ? signed : undefined
  }
  if (isPlayableMediaUrl(value)) return value
  return undefined
}

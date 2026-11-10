import {
  fileAssetIdFromUrl,
  getFileAssetContentUrl,
  parseFileAssetReference,
  resolveFileAssetUrl,
} from '@/lib/file-asset-reference'

/**
 * Same playback identity story-pack VN replay uses:
 * durable file-asset id / asset:// → same-origin content URL.
 * Never returns blob: (session-only) or empty pack aliases.
 */
export function resolveUserRecordingPlaybackUrl(value?: string | null): string | undefined {
  if (!value || value.startsWith('blob:') || value.startsWith('data:')) return undefined

  const fromAssetScheme = parseFileAssetReference(value)?.assetId
  if (fromAssetScheme) return getFileAssetContentUrl(fromAssetScheme)

  const fromContentOrAsset = fileAssetIdFromUrl(value)
  if (fromContentOrAsset) return getFileAssetContentUrl(fromContentOrAsset)

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return getFileAssetContentUrl(value)
  }

  const resolved = resolveFileAssetUrl(value)
  if (!resolved || resolved.startsWith('blob:')) return undefined
  return resolved
}

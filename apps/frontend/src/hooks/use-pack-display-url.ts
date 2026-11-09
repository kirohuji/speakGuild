import { useEffect, useState } from 'react'
import { resolveFileAssetUrl } from '@/lib/file-asset-reference'
import { resolvePackDisplayUrl } from '@/lib/offline/installed-pack-media'

/**
 * Cover / card image URL that prefers an installed pack's local file and falls
 * back to the API content URL when the pack is not on device.
 */
export function usePackDisplayUrl(
  url?: string | null,
  packId?: string | null,
): string | null {
  const remote = url ? (resolveFileAssetUrl(url) || url) : null
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(remote)

  useEffect(() => {
    if (!url) {
      setResolvedUrl(null)
      return
    }

    const fallback = resolveFileAssetUrl(url) || url
    setResolvedUrl(fallback)

    let cancelled = false
    void resolvePackDisplayUrl(url, packId).then((next) => {
      if (!cancelled && next) setResolvedUrl(next)
    })

    return () => {
      cancelled = true
    }
  }, [packId, url])

  return resolvedUrl
}

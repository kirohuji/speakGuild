import { useState, useEffect, useRef } from 'react'
import { fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { assetCacheService, OFFLINE_RESOURCE_MISSING } from '@/lib/offline/asset-cache.service'
import { isNative } from '@/lib/native'

/**
 * Capacitor-first image URL resolution hook.
 *
 * On native: prefer an installed pack's local file (looked up by content URL /
 * fileAssetId). Misses fall back to the remote content URL.
 * On web: return the original URL directly.
 */
export function useCachedImage(url?: string | null): { resolvedUrl: string | null; loading: boolean } {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!url) {
      setResolvedUrl(null)
      setLoading(false)
      return
    }

    const normalized = url.startsWith('//') ? `https:${url}` : url

    if (!isNative()) {
      setResolvedUrl(normalized)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setResolvedUrl(normalized)

    assetCacheService
      .resolve({
        url: normalized,
        fileAssetId: fileAssetIdFromUrl(normalized) ?? undefined,
        role: 'warmup_image',
      })
      .then((resolved) => {
        if (!cancelled && mountedRef.current) {
          setResolvedUrl(
            !resolved || resolved === OFFLINE_RESOURCE_MISSING ? normalized : resolved,
          )
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          setResolvedUrl(normalized)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [url])

  return { resolvedUrl, loading }
}

import { useState, useEffect, useRef } from 'react'
import { assetCacheService } from '@/lib/offline/asset-cache.service'
import { isNative } from '@/lib/native'

/**
 * Capacitor-first image URL resolution hook.
 *
 * On native (iOS/Android): resolves the image URL through assetCacheService,
 * which returns a local file:// URI (converted to capacitor://localhost) if the
 * image was pre-cached via learning pack download. Falls back to remote URL.
 *
 * On web: returns the original URL directly (browser handles caching).
 *
 * This hook follows the exact same pattern as useCachedAudio (audio playback)
 * and the VN player's useCachedAssetUrl (backgrounds/sprites).
 *
 * Usage:
 *   const { resolvedUrl } = useCachedImage(item.imageUrl)
 *   {resolvedUrl && <img src={resolvedUrl} />}
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

    assetCacheService
      .resolve({ url: normalized, role: 'warmup_image' })
      .then((resolved) => {
        if (!cancelled && mountedRef.current) {
          setResolvedUrl(resolved)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          // Fall back to remote URL if cache resolution fails
          setResolvedUrl(normalized)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [url])

  return { resolvedUrl, loading }
}

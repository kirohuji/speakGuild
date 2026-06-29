import { useCallback, useRef } from 'react'
import { assetCacheService } from '@/lib/offline/asset-cache.service'
import { isNative } from '@/lib/native'

/**
 * Capacitor-first audio playback hook.
 *
 * On native (iOS/Android): resolves the audio URL through assetCacheService,
 * which downloads and caches the file to the device filesystem on first play.
 * Subsequent plays within the signed URL's validity window are served from
 * the local cache via capacitor://localhost scheme.
 *
 * On web: plays directly from the remote URL (browser handles caching natively).
 *
 * Usage:
 *   const { play } = useCachedAudio()
 *   <button onClick={() => play(audioUrl)}>Play</button>
 */
export function useCachedAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = useCallback(async (url: string) => {
    if (!url) return

    // Stop any currently playing audio
    audioRef.current?.pause()
    audioRef.current = null

    // Normalize protocol-relative URLs
    let resolvedUrl = url.startsWith('//') ? `https:${url}` : url

    if (isNative()) {
      try {
        resolvedUrl = await assetCacheService.resolve({
          url: resolvedUrl,
          role: 'voice',
        })
      } catch {
        // Fall back to direct URL if caching fails
      }
    }

    const audio = new Audio(resolvedUrl)
    audioRef.current = audio
    audio.play().catch(() => {
      // Silently ignore autoplay restrictions or playback errors
    })
  }, [])

  /**
   * Synchronous play — skips asset cache resolution.
   * Useful when you already have a resolved/cached URL or on web.
   */
  const playDirect = useCallback((url: string) => {
    if (!url) return
    audioRef.current?.pause()
    const resolvedUrl = url.startsWith('//') ? `https:${url}` : url
    const audio = new Audio(resolvedUrl)
    audioRef.current = audio
    audio.play().catch(() => {})
  }, [])

  const stop = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  return { play, playDirect, stop }
}

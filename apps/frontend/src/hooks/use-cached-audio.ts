import { useCallback, useEffect, useRef, useState } from 'react'
import { audioDiag } from '@/lib/offline/audio-playback-diag'
import { resolvePlaybackAudio } from '@/lib/offline/playback-audio'

/**
 * Capacitor-first audio playback hook.
 *
 * On native (iOS/Android): play the audio already stored with a learning pack.
 * If that file was removed with the pack or the cache, download it once and
 * keep the local copy for the next play.
 *
 * On web: plays directly from the remote URL (browser handles caching natively).
 *
 * Usage:
 *   const { play } = useCachedAudio()
 *   <button onClick={() => play(audioUrl)}>Play</button>
 */
export function useCachedAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playGenerationRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  /** Requested source URL (or asset id) for the in-flight / active clip — survives stop→play switches. */
  const [activeUrl, setActiveUrl] = useState<string | null>(null)

  const stopCurrent = useCallback((options?: { clearActiveUrl?: boolean }) => {
    playGenerationRef.current += 1
    const current = audioRef.current
    if (!current) {
      setIsPlaying(false)
      if (options?.clearActiveUrl !== false) setActiveUrl(null)
      return
    }
    current.pause()
    current.onplay = null
    current.onpause = null
    current.onended = null
    current.onerror = null
    try {
      current.removeAttribute('src')
      current.load()
    } catch {
      // Some WebViews reject load() after src removal.
    }
    audioRef.current = null
    setIsPlaying(false)
    if (options?.clearActiveUrl !== false) setActiveUrl(null)
  }, [])

  useEffect(() => () => stopCurrent(), [stopCurrent])

  const play = useCallback(async (
    url?: string | null,
    assetId?: string | null,
    role = 'voice',
    options?: { onEnded?: () => void },
  ) => {
    if (!url && !assetId) return

    audioDiag('ui.play_click', { url: url || null, assetId: assetId || null, role })

    // Keep activeUrl across the stop→start gap so UI highlight can move to the new clip.
    stopCurrent({ clearActiveUrl: false })
    const requestKey = url || assetId || null
    setActiveUrl(requestKey)
    const generation = playGenerationRef.current
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    audio.onplay = () => {
      if (audioRef.current === audio) setIsPlaying(true)
    }
    const clearPlayingState = (clearActive: boolean, ended = false) => {
      if (audioRef.current !== audio) return
      setIsPlaying(false)
      if (clearActive) setActiveUrl(null)
      if (ended) options?.onEnded?.()
    }
    audio.onpause = () => clearPlayingState(false)
    audio.onended = () => clearPlayingState(true, true)
    audio.onerror = () => {
      clearPlayingState(true)
      audioDiag('ui.audio_element_error', {
        url: url || null,
        src: audio.src || null,
        code: audio.error?.code ?? null,
        message: audio.error?.message ?? null,
      })
    }

    const resolvedUrl = await resolvePlaybackAudio({ url, assetId, role })
    if (playGenerationRef.current !== generation || audioRef.current !== audio) return
    if (!resolvedUrl) {
      audioDiag('ui.play_aborted_null_resolve', { url: url || null, assetId: assetId || null, role })
      setActiveUrl(null)
      return
    }
    try {
      audio.src = resolvedUrl
      audio.load()
      await audio.play()
      audioDiag('ui.play_started', { url: url || null, resolved: resolvedUrl, role })
    } catch (error) {
      if (playGenerationRef.current === generation) {
        audioDiag('ui.play_failed', {
          url: url || null,
          resolved: resolvedUrl,
          error: error instanceof Error ? error.message : String(error),
        })
        console.warn('[useCachedAudio] playback failed', error)
        setIsPlaying(false)
        setActiveUrl(null)
      }
    }
  }, [stopCurrent])

  /**
   * Synchronous play — skips asset cache resolution.
   * Useful when you already have a resolved/cached URL or on web.
   */
  const playDirect = useCallback((url: string) => {
    if (!url) return
    stopCurrent({ clearActiveUrl: false })
    setActiveUrl(url)
    const resolvedUrl = url.startsWith('//') ? `https:${url}` : url
    const audio = new Audio(resolvedUrl)
    audioRef.current = audio
    audio.onplay = () => {
      if (audioRef.current === audio) setIsPlaying(true)
    }
    const clearPlayingState = (clearActive: boolean) => {
      if (audioRef.current !== audio) return
      setIsPlaying(false)
      if (clearActive) setActiveUrl(null)
    }
    audio.onpause = () => clearPlayingState(false)
    audio.onended = () => clearPlayingState(true)
    audio.onerror = () => clearPlayingState(true)
    audio.play().catch(() => {})
  }, [stopCurrent])

  const stop = useCallback(() => stopCurrent({ clearActiveUrl: true }), [stopCurrent])

  return { play, playDirect, stop, isPlaying, activeUrl }
}

import { useCallback, useEffect, useRef, useState } from 'react'
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

  const stopCurrent = useCallback(() => {
    playGenerationRef.current += 1
    const current = audioRef.current
    if (!current) {
      setIsPlaying(false)
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
  }, [])

  useEffect(() => () => stopCurrent(), [stopCurrent])

  const play = useCallback(async (url?: string | null, assetId?: string | null, role = 'voice') => {
    if (!url && !assetId) return

    // Stop any currently playing audio
    stopCurrent()
    const generation = playGenerationRef.current
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    audio.onplay = () => {
      if (audioRef.current === audio) setIsPlaying(true)
    }
    const clearPlayingState = () => {
      if (audioRef.current === audio) setIsPlaying(false)
    }
    audio.onpause = clearPlayingState
    audio.onended = clearPlayingState
    audio.onerror = clearPlayingState

    const resolvedUrl = await resolvePlaybackAudio({ url, assetId, role })
    if (playGenerationRef.current !== generation || audioRef.current !== audio) return
    if (!resolvedUrl) return
    try {
      audio.src = resolvedUrl
      audio.load()
      await audio.play()
    } catch (error) {
      if (playGenerationRef.current === generation) {
        console.warn('[useCachedAudio] playback failed', error)
      }
    }
  }, [stopCurrent])

  /**
   * Synchronous play — skips asset cache resolution.
   * Useful when you already have a resolved/cached URL or on web.
   */
  const playDirect = useCallback((url: string) => {
    if (!url) return
    stopCurrent()
    const resolvedUrl = url.startsWith('//') ? `https:${url}` : url
    const audio = new Audio(resolvedUrl)
    audioRef.current = audio
    audio.onplay = () => {
      if (audioRef.current === audio) setIsPlaying(true)
    }
    const clearPlayingState = () => {
      if (audioRef.current === audio) setIsPlaying(false)
    }
    audio.onpause = clearPlayingState
    audio.onended = clearPlayingState
    audio.onerror = clearPlayingState
    audio.play().catch(() => {})
  }, [stopCurrent])

  const stop = stopCurrent

  return { play, playDirect, stop, isPlaying }
}

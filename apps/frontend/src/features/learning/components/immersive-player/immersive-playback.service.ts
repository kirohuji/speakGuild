import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { NativeAudio, type PlaybackStateEvent } from '@capgo/capacitor-native-audio'
import { MediaSession, type MediaSessionAction } from '@capgo/capacitor-media-session'
import { audioDiag } from '@/lib/offline/audio-playback-diag'
import { resolvePlaybackAudio } from '@/lib/offline/playback-audio'
import { isNative } from '@/lib/native'
import { synthesizeAsset } from '@/lib/tts-api'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { PlaybackSegment } from './immersive-player.types'

let configured = false
let htmlAudio: HTMLAudioElement | null = null
let currentNativeAssetId: string | null = null
let cancelCurrentPlayback: (() => void) | null = null
let playbackRequestId = 0
/** Resolved local/file URLs for segments that already have audioUrl (no TTS). */
const resolveCache = new Map<string, Promise<string | null>>()
let gapMediaControlsActive = false

export type ImmersivePlaybackVisualState = {
  state: 'idle' | 'loading' | 'playing' | 'paused'
  media: HTMLAudioElement | null
}

let visualState: ImmersivePlaybackVisualState = { state: 'idle', media: null }
const visualStateListeners = new Set<(state: ImmersivePlaybackVisualState) => void>()

function publishVisualState(state: ImmersivePlaybackVisualState) {
  visualState = state
  visualStateListeners.forEach((listener) => listener(state))
}

async function clearMediaSession() {
  await MediaSession.setPlaybackState({ playbackState: 'none' }).catch(() => undefined)
  await MediaSession.setMetadata({}).catch(() => undefined)
}

type MediaMetadataLabels = {
  artist?: string
  album?: string
}

function segmentCacheKey(segment: PlaybackSegment) {
  return `${segment.id}:${segment.audioUrl ?? ''}`
}

async function resolveAudioUrl(segment: PlaybackSegment): Promise<string | null> {
  // NativeAudio crashes on the WebView capacitor:// URL. It can only open file://.
  const asFileUri = isNative()
  if (segment.audioUrl) {
    const key = segmentCacheKey(segment)
    const cached = resolveCache.get(key)
    if (cached) return cached

    const pending = (async () => {
      audioDiag('immersive.resolve', {
        segmentId: segment.id,
        url: segment.audioUrl,
        asFileUri,
      })
      return resolvePlaybackAudio({ url: segment.audioUrl!, role: 'immersive_audio', asFileUri })
    })()
    resolveCache.set(key, pending)
    try {
      return await pending
    } catch (error) {
      resolveCache.delete(key)
      throw error
    }
  }

  // Missing audioUrl: keep existing on-demand TTS path (no prefetch).
  const { ttsBackend } = usePreferencesStore.getState()
  const result = await synthesizeAsset({
    text: segment.text,
    provider: ttsBackend.provider,
    model: ttsBackend.model,
    voiceId: ttsBackend.voiceId,
    params: ttsBackend.params,
    bizType: 'immersive_player',
    bizId: segment.id,
  })
  audioDiag('immersive.resolve_tts', {
    segmentId: segment.id,
    url: result.url,
    assetId: result.assetId,
    asFileUri,
  })
  return resolvePlaybackAudio({
    url: result.url,
    assetId: result.assetId,
    role: 'immersive_audio',
    asFileUri,
  })
}

async function configureNativeAudio() {
  if (configured || !isNative()) return
  configured = true
  await NativeAudio.configure({
    focus: true,
    background: true,
    backgroundPlayback: true,
    ignoreSilent: true,
    showNotification: true,
  }).catch((error) => {
    configured = false
    throw error
  })
}

async function stopActivePlayback(options?: { clearSession?: boolean }) {
  if (isNative() && currentNativeAssetId) {
    const assetId = currentNativeAssetId
    currentNativeAssetId = null
    await NativeAudio.stop({ assetId }).catch(() => undefined)
    await NativeAudio.unload({ assetId }).catch(() => undefined)
  }
  const audio = htmlAudio
  htmlAudio = null
  audio?.pause()
  cancelCurrentPlayback?.()
  publishVisualState({ state: 'idle', media: null })
  if (options?.clearSession !== false) {
    await clearMediaSession()
  }
}

export const immersivePlaybackService = {
  /** Warm resolve for segments that already have audioUrl. Does not touch TTS. */
  prefetchSegment(segment: PlaybackSegment | null | undefined) {
    if (!segment?.audioUrl?.trim()) return
    const key = segmentCacheKey(segment)
    if (resolveCache.has(key)) return
    void resolveAudioUrl(segment).catch(() => undefined)
  },

  clearPrefetchCache() {
    resolveCache.clear()
  },

  hasResumableAsset() {
    return Boolean(currentNativeAssetId || htmlAudio)
  },

  async setMediaMetadata(segment: PlaybackSegment, playbackRate: number, state: 'none' | 'paused' | 'playing', labels?: MediaMetadataLabels) {
    await MediaSession.setMetadata({
      title: segment.title,
      artist: segment.subtitle || labels?.artist || 'ManYuDing',
      album: labels?.album || 'Immersive Library Playback',
    }).catch(() => undefined)
    await MediaSession.setPlaybackState({ playbackState: state }).catch(() => undefined)
    await MediaSession.setPositionState({ playbackRate }).catch(() => undefined)
  },

  async registerMediaActions(handlers: Partial<Record<MediaSessionAction, () => void>>, options?: { includeTrackSkip?: boolean }) {
    // NativeAudio owns the iOS previous/next commands while an asset is loaded.
    // During gap / between-item unload we temporarily register MediaSession skip.
    const includeTrackSkip = options?.includeTrackSkip ?? Capacitor.getPlatform() !== 'ios'
    const actions = (
      includeTrackSkip
        ? ['play', 'pause', 'previoustrack', 'nexttrack', 'stop']
        : ['play', 'pause', 'stop']
    ) as MediaSessionAction[]
    await Promise.all(actions.map((action) =>
      MediaSession.setActionHandler({ action }, handlers[action] ? () => handlers[action]?.() : null).catch(() => undefined),
    ))
    if (!includeTrackSkip) {
      await Promise.all((['previoustrack', 'nexttrack'] as MediaSessionAction[]).map((action) =>
        MediaSession.setActionHandler({ action }, null).catch(() => undefined),
      ))
    }
  },

  async setIosGapTrackControls(
    enabled: boolean,
    handlers?: Partial<Record<'previoustrack' | 'nexttrack', () => void>>,
  ) {
    if (Capacitor.getPlatform() !== 'ios') return
    gapMediaControlsActive = enabled
    if (!enabled) {
      await Promise.all((['previoustrack', 'nexttrack'] as MediaSessionAction[]).map((action) =>
        MediaSession.setActionHandler({ action }, null).catch(() => undefined),
      ))
      return
    }
    await MediaSession.setActionHandler(
      { action: 'previoustrack' },
      handlers?.previoustrack ? () => handlers.previoustrack?.() : null,
    ).catch(() => undefined)
    await MediaSession.setActionHandler(
      { action: 'nexttrack' },
      handlers?.nexttrack ? () => handlers.nexttrack?.() : null,
    ).catch(() => undefined)
  },

  isIosGapTrackControlsActive() {
    return gapMediaControlsActive
  },

  async playSegment(segment: PlaybackSegment, playbackRate: number, onNativeState?: (event: PlaybackStateEvent) => void, onStarted?: () => void, labels?: MediaMetadataLabels): Promise<void> {
    const requestId = playbackRequestId + 1
    playbackRequestId = requestId
    const audioUrl = await resolveAudioUrl(segment)
    if (requestId !== playbackRequestId) return
    if (!audioUrl) throw new Error('No audio URL available')

    await stopActivePlayback({ clearSession: false })
    if (requestId !== playbackRequestId) return
    if (isNative()) await configureNativeAudio()
    if (requestId !== playbackRequestId) return
    await this.setIosGapTrackControls(false)
    await this.setMediaMetadata(segment, playbackRate, 'playing', labels)
    if (requestId !== playbackRequestId) return

    if (isNative()) {
      const assetId = `immersive-${Date.now()}-${Math.random().toString(36).slice(2)}`
      currentNativeAssetId = assetId
      let settled = false
      let resolvePlayback: () => void = () => undefined
      const completion = new Promise<void>((resolve) => {
        resolvePlayback = resolve
      })
      const settle = () => {
        if (settled) return
        settled = true
        resolvePlayback()
      }
      cancelCurrentPlayback = settle
      let completeHandle: PluginListenerHandle | null = null
      let stateHandle: PluginListenerHandle | null = null

      try {
        completeHandle = await NativeAudio.addListener('complete', (event) => {
          if (event.assetId !== assetId) return
          if (currentNativeAssetId === assetId) currentNativeAssetId = null
          publishVisualState({ state: 'idle', media: null })
          // Resolve before bridge cleanup. When iOS locks the WebView it may suspend JS as soon
          // as the native player is unloaded, which previously stranded the auto-next chain.
          settle()
          void NativeAudio.unload({ assetId }).catch(() => undefined)
        })
        if (settled || requestId !== playbackRequestId || currentNativeAssetId !== assetId) return
        if (onNativeState) {
          stateHandle = await NativeAudio.addListener('playbackState', onNativeState)
        }
        if (settled || requestId !== playbackRequestId || currentNativeAssetId !== assetId) return
        await NativeAudio.preload({
          assetId,
          assetPath: audioUrl,
          isUrl: true,
          notificationMetadata: {
            title: segment.title,
            artist: segment.subtitle || labels?.artist || 'ManYuDing',
            album: labels?.album || 'Immersive Library Playback',
          },
        })
        if (settled || requestId !== playbackRequestId || currentNativeAssetId !== assetId) return
        await NativeAudio.setRate({ assetId, rate: playbackRate }).catch(() => undefined)
        if (settled || requestId !== playbackRequestId || currentNativeAssetId !== assetId) return
        await NativeAudio.play({ assetId, volume: 1 })
        if (settled || requestId !== playbackRequestId || currentNativeAssetId !== assetId) return
        publishVisualState({ state: 'playing', media: null })
        onStarted?.()
        await completion
      } catch (error) {
        if (currentNativeAssetId === assetId) currentNativeAssetId = null
        await NativeAudio.stop({ assetId }).catch(() => undefined)
        await NativeAudio.unload({ assetId }).catch(() => undefined)
        publishVisualState({ state: 'idle', media: null })
        await clearMediaSession()
        settle()
        throw error
      } finally {
        if (cancelCurrentPlayback === settle) cancelCurrentPlayback = null
        await completeHandle?.remove().catch(() => undefined)
        await stateHandle?.remove().catch(() => undefined)
      }
      return
    }

    const audio = new Audio(audioUrl)
    htmlAudio = audio
    audio.playbackRate = playbackRate
    publishVisualState({ state: 'loading', media: audio })

    let settled = false
    let resolvePlayback: (error: Error | null) => void = () => undefined
    const completion = new Promise<Error | null>((resolve) => {
      resolvePlayback = resolve
    })
    const settle = (error?: Error) => {
      if (settled) return
      settled = true
      audio.onplay = null
      audio.onpause = null
      audio.onended = null
      audio.onerror = null
      if (htmlAudio === audio) htmlAudio = null
      publishVisualState({ state: 'idle', media: null })
      resolvePlayback(error ?? null)
    }
    const cancel = () => settle()
    cancelCurrentPlayback = cancel

    audio.onplay = () => {
      if (htmlAudio !== audio) return
      publishVisualState({ state: 'playing', media: audio })
    }
    audio.onpause = () => {
      if (htmlAudio !== audio) return
      if (!audio.ended) publishVisualState({ state: 'paused', media: audio })
    }
    audio.onended = () => {
      if (htmlAudio !== audio) return
      void clearMediaSession()
      settle()
    }
    audio.onerror = () => {
      if (htmlAudio !== audio) return
      settle(new Error('Audio playback failed'))
    }

    try {
      await audio.play()
      if (!settled && htmlAudio === audio) onStarted?.()
      const playbackError = await completion
      if (playbackError) throw playbackError
    } catch (error) {
      settle()
      await clearMediaSession()
      throw error
    } finally {
      if (cancelCurrentPlayback === cancel) cancelCurrentPlayback = null
      audio.onplay = null
      audio.onpause = null
      audio.onended = null
      audio.onerror = null
    }
  },

  async pause() {
    if (isNative() && currentNativeAssetId) {
      await NativeAudio.pause({ assetId: currentNativeAssetId }).catch(() => undefined)
    } else {
      htmlAudio?.pause()
    }
    publishVisualState({ state: 'paused', media: htmlAudio })
    await MediaSession.setPlaybackState({ playbackState: 'paused' }).catch(() => undefined)
  },

  async resume(): Promise<boolean> {
    if (isNative()) {
      if (!currentNativeAssetId) return false
      try {
        await NativeAudio.resume({ assetId: currentNativeAssetId })
      } catch {
        return false
      }
      publishVisualState({ state: 'playing', media: null })
      await MediaSession.setPlaybackState({ playbackState: 'playing' }).catch(() => undefined)
      return true
    }
    if (!htmlAudio) return false
    try {
      await htmlAudio.play()
    } catch {
      return false
    }
    publishVisualState({ state: 'playing', media: htmlAudio })
    await MediaSession.setPlaybackState({ playbackState: 'playing' }).catch(() => undefined)
    return true
  },

  async setPlaybackRate(playbackRate: number) {
    if (isNative() && currentNativeAssetId) {
      await NativeAudio.setRate({ assetId: currentNativeAssetId, rate: playbackRate }).catch(() => undefined)
    } else if (htmlAudio) {
      htmlAudio.playbackRate = playbackRate
    }
    await MediaSession.setPositionState({ playbackRate }).catch(() => undefined)
  },

  async stopCurrent(options?: { clearSession?: boolean }) {
    playbackRequestId += 1
    await stopActivePlayback(options)
  },

  async clearSession() {
    await clearMediaSession()
  },

  subscribeVisualState(listener: (state: ImmersivePlaybackVisualState) => void) {
    visualStateListeners.add(listener)
    listener(visualState)
    return () => {
      visualStateListeners.delete(listener)
    }
  },

  isNativeAudioAvailable() {
    return Capacitor.isNativePlatform()
  },
}

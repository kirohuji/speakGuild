import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { NativeAudio, type PlaybackStateEvent } from '@capgo/capacitor-native-audio'
import { MediaSession, type MediaSessionAction } from '@capgo/capacitor-media-session'
import { assetCacheService } from '@/lib/offline/asset-cache.service'
import { isNative } from '@/lib/native'
import { getFileAssetPrivateUrl } from '@/features/file-assets/api'
import { synthesizeAsset } from '@/lib/tts-api'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { PlaybackSegment } from './immersive-player.types'

let configured = false
let htmlAudio: HTMLAudioElement | null = null
let currentNativeAssetId: string | null = null
let cancelCurrentPlayback: (() => void) | null = null
let playbackRequestId = 0

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

function normalizeUrl(url: string) {
  return url.startsWith('//') ? `https:${url}` : url
}

async function resolveAudioUrl(segment: PlaybackSegment): Promise<string | null> {
  if (segment.audioUrl) {
    const normalized = normalizeUrl(segment.audioUrl)
    return isNative()
      ? assetCacheService.resolve({ url: normalized, role: 'immersive_audio' })
      : normalized
  }

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
  const fresh = result.assetId ? await getFileAssetPrivateUrl(result.assetId).catch(() => ({ url: result.url })) : { url: result.url }
  return isNative()
    ? assetCacheService.resolve({ url: fresh.url, assetId: result.assetId, role: 'immersive_audio', mimeType: result.mimeType })
    : fresh.url
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

async function stopActivePlayback() {
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
  await clearMediaSession()
}

export const immersivePlaybackService = {
  async setMediaMetadata(segment: PlaybackSegment, playbackRate: number, state: 'none' | 'paused' | 'playing', labels?: MediaMetadataLabels) {
    await MediaSession.setMetadata({
      title: segment.title,
      artist: segment.subtitle || labels?.artist || 'ManYuDing',
      album: labels?.album || 'Immersive Library Playback',
    }).catch(() => undefined)
    await MediaSession.setPlaybackState({ playbackState: state }).catch(() => undefined)
    await MediaSession.setPositionState({ playbackRate }).catch(() => undefined)
  },

  async registerMediaActions(handlers: Partial<Record<MediaSessionAction, () => void>>) {
    const actions = ['play', 'pause', 'previoustrack', 'nexttrack', 'stop'] as MediaSessionAction[]
    await Promise.all(actions.map((action) =>
      MediaSession.setActionHandler({ action }, handlers[action] ? () => handlers[action]?.() : null).catch(() => undefined),
    ))
  },

  async playSegment(segment: PlaybackSegment, playbackRate: number, onNativeState?: (event: PlaybackStateEvent) => void, onStarted?: () => void, labels?: MediaMetadataLabels): Promise<void> {
    const requestId = playbackRequestId + 1
    playbackRequestId = requestId
    const audioUrl = await resolveAudioUrl(segment)
    if (requestId !== playbackRequestId) return
    if (!audioUrl) throw new Error('No audio URL available')

    await stopActivePlayback()
    if (requestId !== playbackRequestId) return
    if (isNative()) await configureNativeAudio()
    if (requestId !== playbackRequestId) return
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
          void (async () => {
            if (currentNativeAssetId === assetId) currentNativeAssetId = null
            await NativeAudio.unload({ assetId }).catch(() => undefined)
            publishVisualState({ state: 'idle', media: null })
            await clearMediaSession()
            settle()
          })()
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

  async resume() {
    if (isNative() && currentNativeAssetId) {
      await NativeAudio.resume({ assetId: currentNativeAssetId }).catch(() => undefined)
    } else {
      await htmlAudio?.play().catch(() => undefined)
    }
    publishVisualState({ state: 'playing', media: htmlAudio })
    await MediaSession.setPlaybackState({ playbackState: 'playing' }).catch(() => undefined)
  },

  async setPlaybackRate(playbackRate: number) {
    if (isNative() && currentNativeAssetId) {
      await NativeAudio.setRate({ assetId: currentNativeAssetId, rate: playbackRate }).catch(() => undefined)
    } else if (htmlAudio) {
      htmlAudio.playbackRate = playbackRate
    }
    await MediaSession.setPositionState({ playbackRate }).catch(() => undefined)
  },

  async stopCurrent() {
    playbackRequestId += 1
    await stopActivePlayback()
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

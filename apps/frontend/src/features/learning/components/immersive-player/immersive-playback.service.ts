import { Capacitor } from '@capacitor/core'
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

export const immersivePlaybackService = {
  async setMediaMetadata(segment: PlaybackSegment, playbackRate: number, state: 'none' | 'paused' | 'playing', labels?: MediaMetadataLabels) {
    await MediaSession.setMetadata({
      title: segment.title,
      artist: segment.subtitle || labels?.artist || 'ManYu',
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
    const audioUrl = await resolveAudioUrl(segment)
    if (!audioUrl) throw new Error('No audio URL available')

    await this.stopCurrent()
    await this.setMediaMetadata(segment, playbackRate, 'playing', labels)

    if (isNative()) {
      await configureNativeAudio()
      const assetId = `immersive-${Date.now()}-${Math.random().toString(36).slice(2)}`
      currentNativeAssetId = assetId
      const handle = await NativeAudio.addListener('complete', (event) => {
        if (event.assetId !== assetId) return
        void handle.remove()
        void NativeAudio.unload({ assetId }).catch(() => undefined)
      }).catch(() => null)
      const stateHandle = onNativeState
        ? await NativeAudio.addListener('playbackState', onNativeState).catch(() => null)
        : null

      await NativeAudio.preload({
        assetId,
        assetPath: audioUrl,
        isUrl: true,
        notificationMetadata: {
          title: segment.title,
          artist: segment.subtitle || labels?.artist || 'ManYu',
          album: labels?.album || 'Immersive Library Playback',
        },
      })
      await NativeAudio.setRate({ assetId, rate: playbackRate }).catch(() => undefined)
      await NativeAudio.play({ assetId, volume: 1 })
      onStarted?.()

      await new Promise<void>((resolve) => {
        const done = NativeAudio.addListener('complete', (event) => {
          if (event.assetId !== assetId) return
          void done.then((listener) => listener.remove())
          void stateHandle?.remove()
          resolve()
        })
      })
      void handle?.remove()
      return
    }

    await new Promise<void>((resolve, reject) => {
      htmlAudio?.pause()
      const audio = new Audio(audioUrl)
      htmlAudio = audio
      audio.playbackRate = playbackRate
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('Audio playback failed'))
      audio.play().then(() => onStarted?.()).catch(reject)
    })
  },

  async pause() {
    if (isNative() && currentNativeAssetId) {
      await NativeAudio.pause({ assetId: currentNativeAssetId }).catch(() => undefined)
    } else {
      htmlAudio?.pause()
    }
    await MediaSession.setPlaybackState({ playbackState: 'paused' }).catch(() => undefined)
  },

  async resume() {
    if (isNative() && currentNativeAssetId) {
      await NativeAudio.resume({ assetId: currentNativeAssetId }).catch(() => undefined)
    } else {
      await htmlAudio?.play().catch(() => undefined)
    }
    await MediaSession.setPlaybackState({ playbackState: 'playing' }).catch(() => undefined)
  },

  async stopCurrent() {
    if (isNative() && currentNativeAssetId) {
      const assetId = currentNativeAssetId
      currentNativeAssetId = null
      await NativeAudio.stop({ assetId }).catch(() => undefined)
      await NativeAudio.unload({ assetId }).catch(() => undefined)
    }
    htmlAudio?.pause()
    htmlAudio = null
  },

  isNativeAudioAvailable() {
    return Capacitor.isNativePlatform()
  },
}

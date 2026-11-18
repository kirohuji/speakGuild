import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { NativeAudio, type PlaybackStateEvent } from '@capgo/capacitor-native-audio'
import { MediaSession, type MediaSessionAction } from '@capgo/capacitor-media-session'
import { audioDiag } from '@/lib/offline/audio-playback-diag'
import { resolvePlaybackAudio } from '@/lib/offline/playback-audio'
import { isNative } from '@/lib/native'
import { synthesizeAsset } from '@/lib/tts-api'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { PlaybackSegment } from './immersive-player.types'
import type {
  ImmersiveAudioTransport,
  ImmersivePlaybackVisualState,
  MediaMetadataLabels,
  TransportSlot,
} from './immersive-audio.transport'

export type { ImmersiveAudioTransport, ImmersivePlaybackVisualState, MediaMetadataLabels, TransportSlot }

const SLOT_ASSET: Record<TransportSlot, string> = {
  a: 'immersive-a',
  b: 'immersive-b',
}

let configured = false
let listenersReady = false
let completeHandle: PluginListenerHandle | null = null
let stateHandle: PluginListenerHandle | null = null
let nativeStateHandler: ((event: PlaybackStateEvent) => void) | null = null

let playingSlot: TransportSlot | null = null
let preparedSlots = new Set<TransportSlot>()
let playWaiters = new Map<TransportSlot, { resolve: () => void; reject: (error: Error) => void }>()
let playEpoch = 0

let htmlAudio: HTMLAudioElement | null = null
let htmlPlayResolve: (() => void) | null = null
let gapMediaControlsActive = false

const resolveCache = new Map<string, Promise<string | null>>()

let visualState: ImmersivePlaybackVisualState = { state: 'idle', media: null }
const visualStateListeners = new Set<(state: ImmersivePlaybackVisualState) => void>()

function publishVisualState(state: ImmersivePlaybackVisualState) {
  visualState = state
  visualStateListeners.forEach((listener) => listener(state))
}

function segmentCacheKey(segment: PlaybackSegment) {
  return `${segment.id}:${segment.audioUrl ?? ''}`
}

async function clearMediaSession() {
  await MediaSession.setPlaybackState({ playbackState: 'none' }).catch(() => undefined)
  await MediaSession.setMetadata({}).catch(() => undefined)
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

function settleSlot(slot: TransportSlot, error?: Error) {
  const waiter = playWaiters.get(slot)
  if (!waiter) return
  playWaiters.delete(slot)
  if (error) waiter.reject(error)
  else waiter.resolve()
}

async function unloadSlot(slot: TransportSlot) {
  const assetId = SLOT_ASSET[slot]
  preparedSlots.delete(slot)
  if (playingSlot === slot) playingSlot = null
  settleSlot(slot)
  if (!isNative()) return
  await NativeAudio.stop({ assetId }).catch(() => undefined)
  await NativeAudio.unload({ assetId }).catch(() => undefined)
}

async function ensureNativeListeners() {
  if (!isNative() || listenersReady) return
  listenersReady = true
  completeHandle = await NativeAudio.addListener('complete', (event) => {
    const slot = (Object.keys(SLOT_ASSET) as TransportSlot[]).find((key) => SLOT_ASSET[key] === event.assetId)
    if (!slot || playingSlot !== slot) return
    playingSlot = null
    preparedSlots.delete(slot)
    publishVisualState({ state: 'idle', media: null })
    settleSlot(slot)
    void NativeAudio.unload({ assetId: event.assetId }).catch(() => undefined)
  })
  stateHandle = await NativeAudio.addListener('playbackState', (event) => {
    nativeStateHandler?.(event)
  })
}

async function resolveSegmentUrl(segment: PlaybackSegment, allowTts: boolean): Promise<string | null> {
  const asFileUri = isNative()
  if (segment.audioUrl?.trim()) {
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

  if (!allowTts) return null

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

function createTransport(): ImmersiveAudioTransport {
  return {
    otherSlot(slot) {
      return slot === 'a' ? 'b' : 'a'
    },

    async resolve(segment, options) {
      return resolveSegmentUrl(segment, options?.allowTts !== false)
    },

    async prepare(slot, fileUrl, meta) {
      if (!isNative()) {
        if (playingSlot === slot) {
          throw new Error(`Cannot prepare playing slot ${slot}`)
        }
        const audio = new Audio(fileUrl)
        htmlAudio = audio
        preparedSlots.clear()
        preparedSlots.add(slot)
        void meta
        return
      }
      await configureNativeAudio()
      await ensureNativeListeners()
      const assetId = SLOT_ASSET[slot]
      if (playingSlot === slot) {
        throw new Error(`Cannot prepare playing slot ${slot}`)
      }
      await NativeAudio.stop({ assetId }).catch(() => undefined)
      await NativeAudio.unload({ assetId }).catch(() => undefined)
      preparedSlots.delete(slot)
      await NativeAudio.preload({
        assetId,
        assetPath: fileUrl,
        isUrl: true,
        notificationMetadata: {
          title: meta.title,
          artist: meta.artist || 'ManYuDing',
          album: meta.album || 'Immersive Library Playback',
        },
      })
      preparedSlots.add(slot)
    },

    async playSlot(slot, playbackRate) {
      const epoch = ++playEpoch
      if (isNative()) {
        await configureNativeAudio()
        await ensureNativeListeners()
        if (!preparedSlots.has(slot)) {
          throw new Error(`Slot ${slot} is not prepared`)
        }
        if (playingSlot && playingSlot !== slot) {
          await unloadSlot(playingSlot)
        }
        const assetId = SLOT_ASSET[slot]
        const completion = new Promise<void>((resolve, reject) => {
          playWaiters.set(slot, { resolve, reject })
        })
        playingSlot = slot
        await NativeAudio.setRate({ assetId, rate: playbackRate }).catch(() => undefined)
        if (epoch !== playEpoch) {
          settleSlot(slot)
          return
        }
        await NativeAudio.play({ assetId, volume: 1 })
        if (epoch !== playEpoch) {
          settleSlot(slot)
          return
        }
        publishVisualState({ state: 'playing', media: null })
        await completion
        return
      }

      // Web preview: single HTMLAudio track (same interface, no dual-buffer).
      if (!htmlAudio?.src || !preparedSlots.has(slot)) {
        throw new Error('Web slot has no prepared audio')
      }
      const audio = htmlAudio
      audio.playbackRate = playbackRate
      const completion = new Promise<void>((resolve, reject) => {
        htmlPlayResolve = resolve
        audio.onended = () => {
          publishVisualState({ state: 'idle', media: null })
          preparedSlots.delete(slot)
          playingSlot = null
          htmlPlayResolve = null
          resolve()
        }
        audio.onerror = () => {
          htmlPlayResolve = null
          reject(new Error('Audio playback failed'))
        }
      })
      playingSlot = slot
      publishVisualState({ state: 'loading', media: audio })
      await audio.play()
      if (epoch !== playEpoch) {
        htmlPlayResolve = null
        return
      }
      publishVisualState({ state: 'playing', media: audio })
      await completion
    },

    async pause() {
      if (isNative() && playingSlot) {
        await NativeAudio.pause({ assetId: SLOT_ASSET[playingSlot] }).catch(() => undefined)
      } else {
        htmlAudio?.pause()
      }
      publishVisualState({ state: 'paused', media: htmlAudio })
      await MediaSession.setPlaybackState({ playbackState: 'paused' }).catch(() => undefined)
    },

    async resume() {
      if (isNative()) {
        if (!playingSlot) return false
        try {
          await NativeAudio.resume({ assetId: SLOT_ASSET[playingSlot] })
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

    async stop(options) {
      playEpoch += 1
      const slots: TransportSlot[] = ['a', 'b']
      for (const slot of slots) {
        await unloadSlot(slot)
      }
      if (htmlAudio) {
        htmlAudio.pause()
        htmlAudio.onended = null
        htmlAudio.onerror = null
        htmlAudio = null
      }
      htmlPlayResolve?.()
      htmlPlayResolve = null
      playingSlot = null
      publishVisualState({ state: 'idle', media: null })
      if (options?.clearSession !== false) {
        await clearMediaSession()
      }
    },

    async setRate(playbackRate) {
      if (isNative() && playingSlot) {
        await NativeAudio.setRate({ assetId: SLOT_ASSET[playingSlot], rate: playbackRate }).catch(() => undefined)
      } else if (htmlAudio) {
        htmlAudio.playbackRate = playbackRate
      }
      await MediaSession.setPositionState({ playbackRate }).catch(() => undefined)
    },

    hasResumableAsset() {
      return Boolean(playingSlot || htmlAudio)
    },

    async setMediaMetadata(segment, playbackRate, state, labels) {
      await MediaSession.setMetadata({
        title: segment.title,
        artist: segment.subtitle || labels?.artist || 'ManYuDing',
        album: labels?.album || 'Immersive Library Playback',
      }).catch(() => undefined)
      await MediaSession.setPlaybackState({ playbackState: state }).catch(() => undefined)
      await MediaSession.setPositionState({ playbackRate }).catch(() => undefined)
    },

    async registerMediaActions(handlers, options) {
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

    async setIosGapTrackControls(enabled, handlers) {
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

    setNativeStateHandler(handler) {
      nativeStateHandler = handler
    },

    clearResolveCache() {
      resolveCache.clear()
    },

    async clearSession() {
      await clearMediaSession()
    },

    subscribeVisualState(listener) {
      visualStateListeners.add(listener)
      listener(visualState)
      return () => {
        visualStateListeners.delete(listener)
      }
    },
  }
}

export const immersivePlaybackService: ImmersiveAudioTransport = createTransport()

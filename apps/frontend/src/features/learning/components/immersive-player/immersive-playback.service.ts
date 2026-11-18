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
import { resolveAppLogoArtworkUri } from './immersive-audio.transport'

export type { ImmersiveAudioTransport, ImmersivePlaybackVisualState, MediaMetadataLabels, TransportSlot }

const SLOT_ASSET: Record<TransportSlot, string> = {
  a: 'immersive-a',
  b: 'immersive-b',
}

const POSITION_THROTTLE_MS = 400

let configured = false
let listenersReady = false
let completeHandle: PluginListenerHandle | null = null
let stateHandle: PluginListenerHandle | null = null
let currentTimeHandle: PluginListenerHandle | null = null
let nativeStateHandler: ((event: PlaybackStateEvent) => void) | null = null

let playingSlot: TransportSlot | null = null
let preparedSlots = new Set<TransportSlot>()
let playWaiters = new Map<TransportSlot, { resolve: () => void; reject: (error: Error) => void }>()
let playEpoch = 0
let activePlaybackRate = 1

let htmlAudio: HTMLAudioElement | null = null
let htmlPlayResolve: (() => void) | null = null
let gapMediaControlsActive = false

const resolveCache = new Map<string, Promise<string | null>>()

let lastDuration = 0
let lastPosition = 0
let lastPositionPushAt = 0

let visualState: ImmersivePlaybackVisualState = { state: 'idle', media: null }
const visualStateListeners = new Set<(state: ImmersivePlaybackVisualState) => void>()

function publishVisualState(state: ImmersivePlaybackVisualState) {
  visualState = state
  visualStateListeners.forEach((listener) => listener(state))
}

function segmentCacheKey(segment: PlaybackSegment) {
  return `${segment.id}:${segment.audioUrl ?? ''}`
}

async function artworkList() {
  const src = await resolveAppLogoArtworkUri()
  return [{ src, sizes: '512x512', type: 'image/png' }]
}

async function clearMediaSession() {
  await MediaSession.setPlaybackState({ playbackState: 'none' }).catch(() => undefined)
  await MediaSession.setMetadata({}).catch(() => undefined)
  lastDuration = 0
  lastPosition = 0
}

async function pushPositionState(playbackRate = activePlaybackRate) {
  const duration = lastDuration > 0 ? lastDuration : undefined
  const position = lastDuration > 0 ? Math.min(lastPosition, lastDuration) : undefined
  await MediaSession.setPositionState({
    playbackRate,
    ...(duration != null ? { duration } : {}),
    ...(position != null ? { position } : {}),
  }).catch(() => undefined)
}

/**
 * MediaSession.setPlaybackState rewrites Now Playing from its internal dict.
 * If elapsed was only written by NativeAudio, that wipe flashes progress to 0.
 * Always seed duration/position into MediaSession before flipping playbackState.
 */
async function syncPlaybackState(state: 'playing' | 'paused' | 'none') {
  const rate = state === 'playing' ? activePlaybackRate : 0
  if (state !== 'none' && lastDuration > 0) {
    await pushPositionState(rate)
  }
  await MediaSession.setPlaybackState({ playbackState: state }).catch(() => undefined)
  if (state !== 'none' && lastDuration > 0) {
    await pushPositionState(rate)
  }
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

async function readNativeTiming(assetId: string) {
  const [timeResult, durationResult] = await Promise.all([
    NativeAudio.getCurrentTime({ assetId }).catch(() => null),
    NativeAudio.getDuration({ assetId }).catch(() => null),
  ])
  if (typeof timeResult?.currentTime === 'number' && Number.isFinite(timeResult.currentTime)) {
    lastPosition = Math.max(0, timeResult.currentTime)
  }
  if (typeof durationResult?.duration === 'number' && Number.isFinite(durationResult.duration) && durationResult.duration > 0) {
    lastDuration = durationResult.duration
  }
}

async function ensureNativeListeners() {
  if (!isNative() || listenersReady) return
  listenersReady = true
  completeHandle = await NativeAudio.addListener('complete', (event) => {
    const slot = (Object.keys(SLOT_ASSET) as TransportSlot[]).find((key) => SLOT_ASSET[key] === event.assetId)
    if (!slot || playingSlot !== slot) return
    if (lastDuration > 0) lastPosition = lastDuration
    playingSlot = null
    preparedSlots.delete(slot)
    publishVisualState({ state: 'idle', media: null })
    settleSlot(slot)
    void NativeAudio.unload({ assetId: event.assetId }).catch(() => undefined)
  })
  stateHandle = await NativeAudio.addListener('playbackState', (event) => {
    nativeStateHandler?.(event)
  })
  currentTimeHandle = await NativeAudio.addListener('currentTime', (event) => {
    if (typeof event.currentTime !== 'number' || !Number.isFinite(event.currentTime)) return
    lastPosition = Math.max(0, event.currentTime)
    const now = Date.now()
    if (now - lastPositionPushAt < POSITION_THROTTLE_MS) return
    lastPositionPushAt = now
    void pushPositionState()
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
      const logo = await resolveAppLogoArtworkUri()
      if (!isNative()) {
        if (playingSlot === slot) {
          throw new Error(`Cannot prepare playing slot ${slot}`)
        }
        const audio = new Audio(fileUrl)
        htmlAudio = audio
        preparedSlots.clear()
        preparedSlots.add(slot)
        void meta
        void logo
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
          artworkUrl: logo,
        },
      })
      preparedSlots.add(slot)
    },

    async playSlot(slot, playbackRate) {
      const epoch = ++playEpoch
      activePlaybackRate = playbackRate
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
        lastPosition = 0
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
        await readNativeTiming(assetId)
        await pushPositionState(playbackRate)
        publishVisualState({ state: 'playing', media: null })
        await completion
        return
      }

      if (!htmlAudio?.src || !preparedSlots.has(slot)) {
        throw new Error('Web slot has no prepared audio')
      }
      const audio = htmlAudio
      audio.playbackRate = playbackRate
      const completion = new Promise<void>((resolve, reject) => {
        htmlPlayResolve = resolve
        audio.onended = () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            lastDuration = audio.duration
            lastPosition = audio.duration
          }
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
        audio.ontimeupdate = () => {
          lastPosition = audio.currentTime || 0
          if (Number.isFinite(audio.duration) && audio.duration > 0) lastDuration = audio.duration
          const now = Date.now()
          if (now - lastPositionPushAt < POSITION_THROTTLE_MS) return
          lastPositionPushAt = now
          void pushPositionState(playbackRate)
        }
      })
      playingSlot = slot
      lastPosition = 0
      publishVisualState({ state: 'loading', media: audio })
      await audio.play()
      if (epoch !== playEpoch) {
        htmlPlayResolve = null
        return
      }
      if (Number.isFinite(audio.duration) && audio.duration > 0) lastDuration = audio.duration
      await pushPositionState(playbackRate)
      publishVisualState({ state: 'playing', media: audio })
      await completion
    },

    async pause() {
      if (isNative() && playingSlot) {
        const assetId = SLOT_ASSET[playingSlot]
        await readNativeTiming(assetId)
        await NativeAudio.pause({ assetId }).catch(() => undefined)
        await readNativeTiming(assetId)
      } else if (htmlAudio) {
        lastPosition = htmlAudio.currentTime || lastPosition
        if (Number.isFinite(htmlAudio.duration) && htmlAudio.duration > 0) lastDuration = htmlAudio.duration
        htmlAudio.pause()
      }
      publishVisualState({ state: 'paused', media: htmlAudio })
      await syncPlaybackState('paused')
    },

    async resume() {
      if (isNative()) {
        if (!playingSlot) return false
        const assetId = SLOT_ASSET[playingSlot]
        try {
          await NativeAudio.resume({ assetId })
        } catch {
          return false
        }
        await readNativeTiming(assetId)
        publishVisualState({ state: 'playing', media: null })
        await syncPlaybackState('playing')
        return true
      }
      if (!htmlAudio) return false
      try {
        await htmlAudio.play()
      } catch {
        return false
      }
      lastPosition = htmlAudio.currentTime || lastPosition
      if (Number.isFinite(htmlAudio.duration) && htmlAudio.duration > 0) lastDuration = htmlAudio.duration
      publishVisualState({ state: 'playing', media: htmlAudio })
      await syncPlaybackState('playing')
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
        htmlAudio.ontimeupdate = null
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
      activePlaybackRate = playbackRate
      if (isNative() && playingSlot) {
        await NativeAudio.setRate({ assetId: SLOT_ASSET[playingSlot], rate: playbackRate }).catch(() => undefined)
      } else if (htmlAudio) {
        htmlAudio.playbackRate = playbackRate
      }
      await pushPositionState(playbackRate)
    },

    hasResumableAsset() {
      return Boolean(playingSlot || htmlAudio)
    },

    async setMediaMetadata(segment, playbackRate, state, labels) {
      activePlaybackRate = playbackRate
      await MediaSession.setMetadata({
        title: segment.title,
        artist: segment.subtitle || labels?.artist || 'ManYuDing',
        album: labels?.album || 'Immersive Library Playback',
        artwork: await artworkList(),
      }).catch(() => undefined)
      await syncPlaybackState(state === 'none' ? 'none' : state)
    },

    async holdPositionForGap() {
      if (lastDuration > 0) lastPosition = lastDuration
      await syncPlaybackState('paused')
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

void completeHandle
void stateHandle
void currentTimeHandle
void gapMediaControlsActive

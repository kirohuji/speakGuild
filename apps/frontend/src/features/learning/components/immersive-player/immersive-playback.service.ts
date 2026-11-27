import type { PluginListenerHandle } from '@capacitor/core'
import { NativeAudio, type PlaybackStateEvent, type ProgressEvent, type QueueChangeEvent } from '@capgo/capacitor-native-audio'
import { audioDiag } from '@/lib/offline/audio-playback-diag'
import { resolvePlaybackAudio } from '@/lib/offline/playback-audio'
import { isNative } from '@/lib/native'
import { synthesizeAsset } from '@/lib/tts-api'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { PlaybackSegment } from './immersive-player.types'
import type {
  ImmersiveAudioTransport,
  ImmersiveNativeEvent,
  ImmersivePlaybackVisualState,
  MediaMetadataLabels,
  QueuePlayItem,
} from './immersive-audio.transport'
import {
  IMMERSIVE_PLAYBACK_RATE,
  immersiveLog,
  resolveAppLogoArtworkUri,
} from './immersive-audio.transport'

export type {
  ImmersiveAudioTransport,
  ImmersiveNativeEvent,
  ImmersivePlaybackVisualState,
  MediaMetadataLabels,
  QueuePlayItem,
}

let configured = false
let listenersReady = false
let completeHandle: PluginListenerHandle | null = null
let stateHandle: PluginListenerHandle | null = null
let queueChangeHandle: PluginListenerHandle | null = null
let progressHandle: PluginListenerHandle | null = null

let nativeEventHandler: ((event: ImmersiveNativeEvent) => void) | null = null

let queueItems: QueuePlayItem[] = []
let queueIndex = -1
let activeAssetId: string | null = null
let playEpoch = 0
let activePlaybackRate = IMMERSIVE_PLAYBACK_RATE
let lastKnownPosition = 0
let lastKnownDuration = 0
let artworkUri: string | null = null
let trackWaiter: { assetId: string; resolve: () => void; reject: (error: Error) => void } | null = null

/** Test helper — clears cached artwork between suites. */
export function resetImmersiveArtworkCacheForTests() {
  artworkUri = null
}

let htmlAudio: HTMLAudioElement | null = null

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

function emitNativeEvent(event: ImmersiveNativeEvent) {
  immersiveLog('native.event', event as unknown as Record<string, unknown>)
  nativeEventHandler?.(event)
}

function settleTrack(error?: Error) {
  const waiter = trackWaiter
  if (!waiter) return
  trackWaiter = null
  if (error) waiter.reject(error)
  else waiter.resolve()
}

function waitForTrack(assetId: string): Promise<void> {
  settleTrack()
  return new Promise<void>((resolve, reject) => {
    trackWaiter = { assetId, resolve, reject }
  })
}

function forceImmersiveRate(_requested?: number) {
  return IMMERSIVE_PLAYBACK_RATE
}

async function ensureArtworkUri() {
  if (artworkUri) return artworkUri
  try {
    artworkUri = await resolveAppLogoArtworkUri()
  } catch {
    artworkUri = null
  }
  return artworkUri
}

function toNativeQueueItems(items: QueuePlayItem[]) {
  return items.map((item) => ({
    assetId: item.assetId,
    assetPath: item.fileUrl,
    isUrl: true as const,
    notificationMetadata: {
      title: item.title,
      artist: item.artist,
      album: item.album,
      artworkUrl: artworkUri ?? undefined,
    },
  }))
}

async function configureNativeAudio() {
  if (configured || !isNative()) return
  configured = true
  // Single-plugin Now Playing: Capgo owns the lock-screen card (docs §2 / §6).
  immersiveLog('configure', { showNotification: true, backgroundPlayback: true })
  await NativeAudio.configure({
    focus: true,
    background: true,
    backgroundPlayback: true,
    ignoreSilent: true,
    showNotification: true,
    // progressInterval: JS/UI only. Lock-screen: native rate=1 + quiet visual rebase (§4).
    progressInterval: 0.5,
  }).catch((error) => {
    configured = false
    throw error
  })
}

async function ensureNativeListeners() {
  if (!isNative() || listenersReady) return
  listenersReady = true

  completeHandle = await NativeAudio.addListener('complete', (event) => {
    immersiveLog('complete', { assetId: event.assetId, waiting: trackWaiter?.assetId ?? null })
    emitNativeEvent({ type: 'complete', assetId: event.assetId })
    if (trackWaiter?.assetId === event.assetId) {
      settleTrack()
    }
    if (activeAssetId === event.assetId) {
      activeAssetId = null
      publishVisualState({ state: 'idle', media: null })
    }
  })

  stateHandle = await NativeAudio.addListener('playbackState', (event: PlaybackStateEvent) => {
    immersiveLog('playbackState', {
      assetId: event.assetId,
      state: event.state,
      reason: event.reason,
    })
    emitNativeEvent({
      type: 'playbackState',
      reason: event.reason,
      assetId: event.assetId,
      state: event.state,
    })
    if (event.state === 'playing') {
      activeAssetId = event.assetId
      publishVisualState({ state: 'playing', media: null })
    } else if (event.state === 'paused') {
      publishVisualState({ state: 'paused', media: null })
    } else if (event.state === 'stopped' && activeAssetId === event.assetId) {
      activeAssetId = null
      publishVisualState({ state: 'idle', media: null })
    }
  })

  queueChangeHandle = await NativeAudio.addListener('queueChange', (event: QueueChangeEvent) => {
    immersiveLog('queueChange', {
      assetId: event.assetId,
      index: event.index,
      reason: event.reason,
    })
    queueIndex = event.index
    if (event.assetId) activeAssetId = event.assetId

    // Remote / programmatic skip mid-track: keep waiting for the newly selected asset.
    const skipReasons = new Set(['remoteNext', 'remotePrevious', 'next', 'previous', 'select'])
    if (skipReasons.has(event.reason) && trackWaiter && event.assetId) {
      trackWaiter.assetId = event.assetId
      publishVisualState({ state: 'playing', media: null })
    }

    emitNativeEvent({
      type: 'queueChange',
      reason: event.reason,
      assetId: event.assetId,
      index: event.index,
    })
  })

  progressHandle = await NativeAudio.addListener('progress', (event: ProgressEvent) => {
    // JS/UI position only — native Plugin quietly re-bases NP; do not double-write (§4).
    if (activeAssetId && event.assetId !== activeAssetId) return
    lastKnownPosition = event.position
    if (event.duration > 0) lastKnownDuration = event.duration
  })
}

async function clearNativeQueue() {
  if (!isNative()) return
  immersiveLog('clearQueue')
  await NativeAudio.clearQueue().catch(() => undefined)
}

async function detachNativeListeners() {
  await completeHandle?.remove().catch(() => undefined)
  await stateHandle?.remove().catch(() => undefined)
  await queueChangeHandle?.remove().catch(() => undefined)
  await progressHandle?.remove().catch(() => undefined)
  completeHandle = null
  stateHandle = null
  queueChangeHandle = null
  progressHandle = null
  listenersReady = false
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
      immersiveLog('resolve', { segmentId: segment.id, asFileUri, hasUrl: true })
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

  if (!allowTts) {
    immersiveLog('resolve.skip_tts', { segmentId: segment.id })
    return null
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
  audioDiag('immersive.resolve_tts', {
    segmentId: segment.id,
    url: result.url,
    assetId: result.assetId,
    asFileUri,
  })
  immersiveLog('resolve.tts', { segmentId: segment.id, assetId: result.assetId })
  return resolvePlaybackAudio({
    url: result.url,
    assetId: result.assetId,
    role: 'immersive_audio',
    asFileUri,
  })
}

async function playWebQueue(items: QueuePlayItem[], startIndex: number, playbackRate: number) {
  const item = items[startIndex]
  if (!item) throw new Error('Empty queue')
  queueItems = items
  queueIndex = startIndex
  activeAssetId = item.assetId
  activePlaybackRate = playbackRate

  const audio = new Audio(item.fileUrl)
  htmlAudio = audio
  audio.playbackRate = playbackRate
  publishVisualState({ state: 'loading', media: audio })

  const completion = new Promise<void>((resolve, reject) => {
    trackWaiter = {
      assetId: item.assetId,
      resolve: () => {
        trackWaiter = null
        resolve()
      },
      reject: (error) => {
        trackWaiter = null
        reject(error)
      },
    }
    audio.onended = () => {
      immersiveLog('web.complete', { assetId: item.assetId })
      emitNativeEvent({ type: 'complete', assetId: item.assetId })
      publishVisualState({ state: 'idle', media: null })
      activeAssetId = null
      settleTrack()
    }
    audio.onerror = () => {
      settleTrack(new Error('Audio playback failed'))
    }
  })

  immersiveLog('web.play', { assetId: item.assetId, index: startIndex })
  await audio.play()
  publishVisualState({ state: 'playing', media: audio })
  await completion
}

async function playWebAdjacent(delta: 1 | -1): Promise<boolean> {
  const nextIndex = queueIndex + delta
  if (nextIndex < 0 || nextIndex >= queueItems.length) return false
  const epoch = playEpoch
  await playWebQueue(queueItems, nextIndex, activePlaybackRate)
  return epoch === playEpoch
}

function createTransport(): ImmersiveAudioTransport {
  return {
    async resolve(segment, options) {
      return resolveSegmentUrl(segment, options?.allowTts !== false)
    },

    async armQueue(items, options) {
      const startIndex = options?.startIndex ?? 0
      if (!items.length || startIndex < 0 || startIndex >= items.length) {
        throw new Error('Invalid armQueue items/startIndex')
      }

      queueItems = items
      queueIndex = startIndex
      const start = items[startIndex]
      immersiveLog('lockscreen.arm', {
        count: items.length,
        startIndex,
        assetId: start.assetId,
      })

      if (!isNative()) {
        activeAssetId = start.assetId
        lastKnownPosition = 0
        lastKnownDuration = 0
        publishVisualState({ state: 'paused', media: null })
        return
      }

      await configureNativeAudio()
      await ensureNativeListeners()
      await ensureArtworkUri()

      // Prefer Capgo setQueue(autoPlay:false)+metadata. Native patch (docs §3.1) writes
      // MPNowPlayingInfoCenter with playbackRate=0 so the paused card appears without play.
      const queueState = await NativeAudio.setQueue({
        items: toNativeQueueItems(items),
        startIndex,
        autoPlay: false,
      })

      immersiveLog('setQueue.arm', {
        assetId: queueState.assetId,
        index: queueState.index,
        count: queueState.count,
      })

      activeAssetId = queueState.assetId || start.assetId
      queueIndex = queueState.index >= 0 ? queueState.index : startIndex
      lastKnownPosition = 0
      lastKnownDuration = 0
      activePlaybackRate = IMMERSIVE_PLAYBACK_RATE
      publishVisualState({ state: 'paused', media: null })
    },

    async playQueue(items, options) {
      const startIndex = options?.startIndex ?? 0
      const playbackRate = forceImmersiveRate(options?.playbackRate)
      const epoch = ++playEpoch
      activePlaybackRate = playbackRate
      settleTrack()

      if (!items.length || startIndex < 0 || startIndex >= items.length) {
        throw new Error('Invalid playQueue items/startIndex')
      }

      queueItems = items
      queueIndex = startIndex
      const start = items[startIndex]
      immersiveLog('playQueue', {
        count: items.length,
        startIndex,
        assetId: start.assetId,
        playbackRate,
      })

      if (!isNative()) {
        await playWebQueue(items, startIndex, playbackRate)
        return
      }

      await configureNativeAudio()
      await ensureNativeListeners()
      await ensureArtworkUri()
      // R5: do not clearQueue before setQueue — avoid blank Now Playing during window swap.
      // setQueue replaces the playlist; Capgo updates the card on play.

      const queueState = await NativeAudio.setQueue({
        items: toNativeQueueItems(items),
        startIndex,
        autoPlay: true,
      })

      immersiveLog('setQueue', {
        assetId: queueState.assetId,
        index: queueState.index,
        count: queueState.count,
      })

      if (epoch !== playEpoch) {
        settleTrack()
        return
      }

      activeAssetId = queueState.assetId || start.assetId
      queueIndex = queueState.index >= 0 ? queueState.index : startIndex
      lastKnownPosition = 0
      lastKnownDuration = 0

      await NativeAudio.setRate({ assetId: activeAssetId, rate: IMMERSIVE_PLAYBACK_RATE }).catch(() => undefined)
      publishVisualState({ state: 'playing', media: null })

      const completion = waitForTrack(activeAssetId)
      await completion
    },

    async queueNext() {
      const nextIndex = queueIndex + 1
      if (nextIndex >= queueItems.length) {
        immersiveLog('queueNext.eof', { queueIndex, count: queueItems.length })
        return false
      }

      immersiveLog('queueNext', { from: queueIndex, to: nextIndex })
      const epoch = ++playEpoch
      activePlaybackRate = IMMERSIVE_PLAYBACK_RATE

      if (!isNative()) {
        return playWebAdjacent(1)
      }

      await configureNativeAudio()
      await ensureNativeListeners()
      const state = await NativeAudio.queueNext()
      if (epoch !== playEpoch) return false

      queueIndex = state.index
      activeAssetId = state.assetId || queueItems[nextIndex]?.assetId || null
      if (!activeAssetId) return false

      await NativeAudio.setRate({ assetId: activeAssetId, rate: IMMERSIVE_PLAYBACK_RATE }).catch(() => undefined)
      publishVisualState({ state: 'playing', media: null })
      await waitForTrack(activeAssetId)
      return epoch === playEpoch
    },

    async queuePrevious() {
      const prevIndex = queueIndex - 1
      if (prevIndex < 0) {
        immersiveLog('queuePrevious.bof', { queueIndex })
        return false
      }

      immersiveLog('queuePrevious', { from: queueIndex, to: prevIndex })
      const epoch = ++playEpoch

      if (!isNative()) {
        return playWebAdjacent(-1)
      }

      await configureNativeAudio()
      await ensureNativeListeners()
      const state = await NativeAudio.queuePrevious()
      if (epoch !== playEpoch) return false

      queueIndex = state.index
      activeAssetId = state.assetId || queueItems[prevIndex]?.assetId || null
      if (!activeAssetId) return false

      await NativeAudio.setRate({ assetId: activeAssetId, rate: IMMERSIVE_PLAYBACK_RATE }).catch(() => undefined)
      publishVisualState({ state: 'playing', media: null })
      await waitForTrack(activeAssetId)
      return epoch === playEpoch
    },

    async pause() {
      immersiveLog('transport.pause.enter', {
        assetId: activeAssetId,
        queueIndex,
        jsPosition: lastKnownPosition,
        jsDuration: lastKnownDuration,
        visualState: visualState.state,
      })
      if (visualState.state === 'paused') {
        immersiveLog('transport.pause.skip', { reason: 'already_paused', assetId: activeAssetId })
        return
      }
      if (isNative() && activeAssetId) {
        await NativeAudio.pause({ assetId: activeAssetId }).catch(() => undefined)
        immersiveLog('transport.pause.nativeDone', { assetId: activeAssetId, queueIndex })
      } else if (htmlAudio) {
        lastKnownPosition = htmlAudio.currentTime
        lastKnownDuration = Number.isFinite(htmlAudio.duration) ? htmlAudio.duration : lastKnownDuration
        htmlAudio.pause()
        immersiveLog('transport.pause.webDone', {
          assetId: activeAssetId,
          player: lastKnownPosition,
          duration: lastKnownDuration,
        })
      }
      publishVisualState({ state: 'paused', media: htmlAudio })
    },

    async resume() {
      immersiveLog('transport.resume.enter', {
        assetId: activeAssetId,
        queueIndex,
        jsPosition: lastKnownPosition,
        jsDuration: lastKnownDuration,
        visualState: visualState.state,
      })
      if (visualState.state === 'playing') {
        immersiveLog('transport.resume.skip', { reason: 'already_playing', assetId: activeAssetId })
        return true
      }
      if (isNative()) {
        if (!activeAssetId) return false
        try {
          await NativeAudio.resume({ assetId: activeAssetId })
        } catch {
          immersiveLog('transport.resume.nativeFailed', { assetId: activeAssetId })
          return false
        }
        immersiveLog('transport.resume.nativeDone', { assetId: activeAssetId, queueIndex })
        publishVisualState({ state: 'playing', media: null })
        return true
      }
      if (!htmlAudio) return false
      try {
        await htmlAudio.play()
      } catch {
        return false
      }
      publishVisualState({ state: 'playing', media: htmlAudio })
      return true
    },

    async stop(options) {
      immersiveLog('stop', { clearSession: options?.clearSession !== false, assetId: activeAssetId })
      playEpoch += 1
      settleTrack()
      if (isNative()) {
        if (activeAssetId) {
          await NativeAudio.stop({ assetId: activeAssetId }).catch(() => undefined)
        }
        if (options?.clearSession !== false) {
          await clearNativeQueue()
          await detachNativeListeners()
        }
      }
      if (htmlAudio) {
        htmlAudio.pause()
        htmlAudio.onended = null
        htmlAudio.onerror = null
        htmlAudio = null
      }
      activeAssetId = null
      lastKnownPosition = 0
      lastKnownDuration = 0
      if (options?.clearSession !== false) {
        queueItems = []
        queueIndex = -1
      }
      publishVisualState({ state: 'idle', media: null })
    },

    async setRate(playbackRate) {
      // Rate locked to 1 for immersive this phase (docs §6).
      activePlaybackRate = forceImmersiveRate(playbackRate)
      immersiveLog('setRate', { playbackRate: activePlaybackRate, assetId: activeAssetId, locked: true })
      if (isNative() && activeAssetId) {
        await NativeAudio.setRate({ assetId: activeAssetId, rate: IMMERSIVE_PLAYBACK_RATE }).catch(() => undefined)
      } else if (htmlAudio) {
        htmlAudio.playbackRate = IMMERSIVE_PLAYBACK_RATE
      }
    },

    async seekTo(seconds: number) {
      if (!Number.isFinite(seconds)) return
      immersiveLog('seekTo', { seconds, assetId: activeAssetId, duration: lastKnownDuration })

      if (isNative()) {
        if (!activeAssetId) return
        let duration = lastKnownDuration
        if (!(duration > 0)) {
          const result = await NativeAudio.getDuration({ assetId: activeAssetId }).catch(() => null)
          duration = result?.duration ?? 0
          if (duration > 0) lastKnownDuration = duration
        }
        const clamped = duration > 0 ? Math.min(Math.max(0, seconds), duration) : Math.max(0, seconds)
        await NativeAudio.setCurrentTime({ assetId: activeAssetId, time: clamped }).catch(() => undefined)
        lastKnownPosition = clamped
        return
      }

      if (!htmlAudio) return
      const duration = Number.isFinite(htmlAudio.duration) ? htmlAudio.duration : 0
      const clamped = duration > 0 ? Math.min(Math.max(0, seconds), duration) : Math.max(0, seconds)
      htmlAudio.currentTime = clamped
      lastKnownPosition = clamped
      lastKnownDuration = duration > 0 ? duration : lastKnownDuration
    },

    hasResumableAsset() {
      return Boolean(activeAssetId || htmlAudio)
    },

    getActiveAssetId() {
      return activeAssetId
    },

    getQueueIndex() {
      return queueIndex
    },

    setNativeEventHandler(handler) {
      nativeEventHandler = handler
    },

    clearResolveCache() {
      resolveCache.clear()
    },

    async clearSession() {
      immersiveLog('clearSession')
      playEpoch += 1
      settleTrack()
      activeAssetId = null
      queueItems = []
      queueIndex = -1
      lastKnownPosition = 0
      lastKnownDuration = 0
      if (isNative()) {
        await clearNativeQueue()
      }
      publishVisualState({ state: 'idle', media: null })
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

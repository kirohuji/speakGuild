import { buildPlaybackSegments } from './immersive-player.mapper'
import type {
  ImmersiveAudioTransport,
  MediaMetadataLabels,
  QueuePlayItem,
} from './immersive-audio.transport'
import {
  immersiveLog,
  normalizeImmersivePlaybackRate,
  toQueueAssetId,
} from './immersive-audio.transport'
import {
  bakeSilenceDurationSeconds,
  computeLeadingSilenceSeconds,
  computeTrailingSilenceSeconds,
} from './immersive-audio-pad'
import {
  isGapAssetId,
  normalizePauseGapSeconds,
  resolveSilenceFileUrlForDuration,
  toGapAssetId,
} from './immersive-silence'
import type {
  ImmersivePlaybackSettings,
  ImmersivePlayerItem,
  ImmersivePlayerStatus,
  PlaybackSegment,
} from './immersive-player.types'

const LOAD_MORE_THRESHOLD = 5
const PENDING_CONTINUE_TIMEOUT_MS = 15_000

export type QueueScheduler = {
  delay(ms: number): Promise<boolean>
  cancel(): void
}

export type ListeningQueueEngineState = {
  status: ImmersivePlayerStatus
  absoluteIndex: number
  currentItemId: string | null
  currentSegment: PlaybackSegment | null
  errorMessage: string | null
  gapActive: boolean
}

export type PlaylistBinding = {
  items: ImmersivePlayerItem[]
  index: number
  total: number
  windowOffset?: number
  onIndexChange: (absoluteIndex: number) => void
  onLoadMoreNearEnd?: () => void
}

export type ListeningQueueEngineOptions = {
  transport: ImmersiveAudioTransport
  getSettings: () => ImmersivePlaybackSettings
  scheduler: QueueScheduler
  isBackground: () => boolean
  now?: () => number
  mediaLabels?: MediaMetadataLabels
  /** Override silence-file gap (tests). Return null to force timer fallback. */
  resolveSilenceUrl?: (seconds: number) => Promise<string | null>
  onSleepEnd?: () => void
  onEmptySegments?: () => void
  onPlayFailed?: (error: unknown) => void
}

function defaultState(absoluteIndex = 0): ListeningQueueEngineState {
  return {
    status: 'idle',
    absoluteIndex,
    currentItemId: null,
    currentSegment: null,
    errorMessage: null,
    gapActive: false,
  }
}

export function createTimerScheduler(): QueueScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null
  let resolveDelay: ((continued: boolean) => void) | null = null
  return {
    delay(ms) {
      this.cancel()
      if (ms <= 0) return Promise.resolve(true)
      return new Promise<boolean>((resolve) => {
        resolveDelay = resolve
        timer = setTimeout(() => {
          timer = null
          resolveDelay = null
          resolve(true)
        }, ms)
      })
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      if (resolveDelay) {
        const resolve = resolveDelay
        resolveDelay = null
        resolve(false)
      }
    },
  }
}

function fireAndForget(promise: Promise<unknown>) {
  promise.catch(() => undefined)
}

export class ListeningQueueEngine {
  private readonly transport: ImmersiveAudioTransport
  private readonly getSettings: () => ImmersivePlaybackSettings
  private readonly scheduler: QueueScheduler
  private readonly isBackground: () => boolean
  private readonly now: () => number
  private readonly mediaLabels?: MediaMetadataLabels
  private readonly resolveSilenceUrl: (seconds: number) => Promise<string | null>
  private readonly onSleepEnd?: () => void
  private readonly onEmptySegments?: () => void
  private readonly onPlayFailed?: (error: unknown) => void

  private generation = 0
  private binding: PlaylistBinding | null = null
  private state: ListeningQueueEngineState = defaultState()
  private listeners = new Set<(state: ListeningQueueEngineState) => void>()
  private pendingContinue = false
  private pendingContinueTimer: ReturnType<typeof setTimeout> | null = null
  /** After queue end: wait for bind to absolute 0, then arm paused card. */
  private pendingArmPaused = false
  private gapPaused = false
  private gapResume: (() => void) | null = null
  /** Resolves when user resumes after a mid-track / between-track pause. */
  private pauseGateResolve: (() => void) | null = null
  /** True only while JS timer waitGap is in flight (pad-failure fallback). */
  private timerGapRunning = false
  private sleepTimer: ReturnType<typeof setTimeout> | null = null
  private loadMoreInFlightOffset: number | null = null
  private itemSegments: PlaybackSegment[] = []
  private snapshotItemId: string | null = null
  private segmentIndex = 0
  /**
   * Maps native queue index → learning segment (+ whether this slot is a silence gap).
   * Gap tracks keep the same Now Playing title; Capgo skips rewriting the card.
   */
  private windowMeta: Array<{
    segmentIndex: number
    kind: 'segment' | 'gap'
    leadingBaked: boolean
    trailingBaked: boolean
    leadingSilenceSec: number
    trailingSilenceSec: number
  }> = []
  private windowLength = 0
  private lastKnownQueueIndex = -1
  /** True while runItemLoop / softRestart owns the playback generation. */
  private playbackLoopActive = false
  /**
   * Next learning-item first segment, resolved early so trailing-gap pre-arm
   * can write NP @0 during silence (cross-item flash fix).
   */
  private nextItemPreArm: {
    generation: number
    assetId: string
    fileUrl: string
    title: string
    artist?: string
    album?: string
    segmentId: string
  } | null = null
  private preArmInFlight: Promise<void> | null = null
  /** Avoid double preArm (queueChange + post-queueNext sync) rewriting @0 twice. */
  private trailingPreArmCommittedKey: string | null = null

  constructor(options: ListeningQueueEngineOptions) {
    this.transport = options.transport
    this.getSettings = options.getSettings
    this.scheduler = options.scheduler
    this.isBackground = options.isBackground
    this.now = options.now ?? (() => Date.now())
    this.mediaLabels = options.mediaLabels
    this.resolveSilenceUrl = options.resolveSilenceUrl ?? resolveSilenceFileUrlForDuration
    this.onSleepEnd = options.onSleepEnd
    this.onEmptySegments = options.onEmptySegments
    this.onPlayFailed = options.onPlayFailed

    this.transport.setNativeEventHandler((event) => {
      if (event.type === 'playbackState') {
        if (event.reason === 'remotePlay') {
          // Capgo remotePlay already resumed the native asset + wrote Now Playing.
          // Engine only syncs state / starts the wait loop — do not transport.resume again.
          immersiveLog('engine.remote.play', {
            assetId: event.assetId,
            queueIndex: this.transport.getQueueIndex(),
            engineState: this.state.status,
            note: 'native_already_resumed_np_hold_then_arm',
          })
          this.handleRemotePlay()
        } else if (event.reason === 'remotePause') {
          // Capgo remotePause already paused + wrote Now Playing; sync Engine only.
          immersiveLog('engine.remote.pause', {
            assetId: event.assetId,
            queueIndex: this.transport.getQueueIndex(),
            engineState: this.state.status,
            note: 'native_already_froze_np_bar',
          })
          this.handleRemotePause()
        } else if (event.reason === 'remoteNextTrack' || event.reason === 'remoteNext') {
          immersiveLog('engine.remote.next', {
            reason: event.reason,
            assetId: event.assetId,
            queueIndex: this.transport.getQueueIndex(),
            windowLength: this.windowLength,
          })
          // Capgo queue edge only emits queueChange (index unchanged). playbackState
          // remoteNext is for single-track windows / legacy remoteNextTrack.
          // Multi-track cross-item is owned by queueChange below — do NOT use
          // "index >= last" here (landing on last content via skip_gaps would
          // wrongly jump learning items).
          if (this.windowLength === 1) {
            fireAndForget(this.next(true))
          }
        } else if (event.reason === 'remotePreviousTrack' || event.reason === 'remotePrevious') {
          immersiveLog('engine.remote.prev', {
            reason: event.reason,
            assetId: event.assetId,
            queueIndex: this.transport.getQueueIndex(),
            windowLength: this.windowLength,
          })
          // Same as next: multi-track edge is queueChange (index unchanged).
          if (this.windowLength === 1) {
            fireAndForget(this.prev(true))
          }
        }
        return
      }

      if (event.type !== 'queueChange') return

      const isNext = event.reason === 'remoteNext' || event.reason === 'next'
      const isPrev = event.reason === 'remotePrevious' || event.reason === 'previous'
      if (!isNext && !isPrev) return

      const prevQueueIndex = this.lastKnownQueueIndex
      immersiveLog('engine.queueChange', {
        reason: event.reason,
        index: event.index,
        assetId: event.assetId,
        windowLength: this.windowLength,
        prevQueueIndex,
      })

      this.syncFromQueueIndex(event.index)

      // Cross learning-item when remote skip cannot move within the native window (R5).
      // Native edge notify keeps the same index (no next/prev content after skip_gaps).
      // Important for next: last *content* (example) before trailing gap is also an edge —
      // requiring index === windowLength-1 missed that and made lock-screen next a no-op.
      if (isNext && event.reason === 'remoteNext' && this.windowLength > 0) {
        if (event.index === prevQueueIndex) {
          fireAndForget(this.next(true))
        }
      }
      if (isPrev && event.reason === 'remotePrevious' && this.windowLength > 0) {
        if (event.index === prevQueueIndex) {
          fireAndForget(this.prev(true))
        }
      }
    })
  }

  subscribe(listener: (state: ListeningQueueEngineState) => void) {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): ListeningQueueEngineState {
    return { ...this.state }
  }

  /** False after arm-only; true once play()/runItemLoop owns the session. */
  hasPlaybackLoop(): boolean {
    return this.playbackLoopActive
  }

  /** Test helper: locked segment snapshot for current item. */
  getItemSegmentSnapshot() {
    return this.itemSegments.map((segment) => segment.id)
  }

  bindPlaylist(binding: PlaylistBinding) {
    const prevIndex = this.binding ? this.absoluteIndexOf(this.binding) : null
    this.binding = binding
    const absoluteIndex = this.absoluteIndexOf(binding)
    this.patchState({
      absoluteIndex,
      currentItemId: binding.items[binding.index]?.id ?? null,
    })

    if (this.pendingArmPaused && absoluteIndex === 0 && binding.items[binding.index]) {
      this.pendingArmPaused = false
      fireAndForget(this.armSession())
      return
    }

    if (this.pendingContinue && prevIndex !== absoluteIndex) {
      this.clearPendingContinueTimer()
      this.pendingContinue = false
      fireAndForget(this.playFromCurrentItem({ rebuildSnapshot: true }))
      return
    }

    if (this.pendingContinue && binding.items[binding.index]) {
      const item = binding.items[binding.index]
      if (item && this.state.status !== 'playing' && this.state.status !== 'loading') {
        this.clearPendingContinueTimer()
        this.pendingContinue = false
        fireAndForget(this.playFromCurrentItem({ rebuildSnapshot: true }))
      }
    }

    this.maybeLoadMore()
  }

  async play() {
    immersiveLog('engine.play', { absoluteIndex: this.binding ? this.absoluteIndexOf(this.binding) : null })
    this.bumpGeneration()
    this.pendingContinue = false
    this.pendingArmPaused = false
    this.clearPendingContinueTimer()
    this.playbackLoopActive = true
    await this.playFromCurrentItem({ rebuildSnapshot: true })
  }

  /**
   * Open Immersive → paused Now Playing card before the user presses play (docs §3).
   */
  async armSession() {
    if (this.state.status === 'playing' || this.state.status === 'loading') return
    if (this.playbackLoopActive || this.pendingContinue) return
    const binding = this.binding
    if (!binding) return
    const item = binding.items[binding.index]
    if (!item) return

    const settings = this.getSettings()
    const segments = buildPlaybackSegments(item, settings)
    if (segments.length === 0) return

    this.itemSegments = segments
    this.snapshotItemId = item.id
    this.segmentIndex = 0

    const allowTts = !this.isBackground()
    let armed: QueuePlayItem | null = null
    for (const segment of segments) {
      const fileUrl = await this.transport.resolve(segment, { allowTts })
      if (!fileUrl) continue
      armed = {
        assetId: toQueueAssetId(segment.id),
        fileUrl,
        title: segment.title,
        artist: segment.subtitle || this.mediaLabels?.artist,
        album: this.mediaLabels?.album,
        segmentId: segment.id,
        kind: 'segment',
      }
      this.segmentIndex = segments.indexOf(segment)
      this.patchState({
        status: 'paused',
        absoluteIndex: this.absoluteIndexOf(binding),
        currentItemId: item.id,
        currentSegment: segment,
        gapActive: false,
        errorMessage: null,
      })
      break
    }
    if (!armed) return

    this.windowMeta = [{
      segmentIndex: this.segmentIndex,
      kind: 'segment',
      leadingBaked: true,
      trailingBaked: true,
      leadingSilenceSec: 0,
      trailingSilenceSec: 0,
    }]
    this.windowLength = 1
    this.lastKnownQueueIndex = 0
    immersiveLog('lockscreen.arm', { assetId: armed.assetId, itemId: item.id })
    try {
      await this.transport.armQueue([armed], { startIndex: 0 })
    } catch (error) {
      immersiveLog('lockscreen.arm.failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async pause() {
    immersiveLog('engine.pause', {
      gapActive: this.state.gapActive,
      timerGap: this.timerGapRunning,
      engineState: this.state.status,
      assetId: this.transport.getActiveAssetId(),
      queueIndex: this.transport.getQueueIndex(),
      absoluteIndex: this.state.absoluteIndex,
      note: 'expect_native_freezePause_next',
    })
    // Timer-gap fallback only — silence-queue gaps pause via NativeAudio like any track.
    if (this.state.gapActive && this.timerGapRunning) {
      this.gapPaused = true
      this.scheduler.cancel()
      this.patchState({ status: 'paused' })
      return
    }
    this.patchState({ status: 'paused' })
    await this.transport.pause()
  }

  async resume(): Promise<boolean> {
    immersiveLog('engine.resume', {
      gapActive: this.state.gapActive,
      gapPaused: this.gapPaused,
      timerGap: this.timerGapRunning,
      engineState: this.state.status,
      assetId: this.transport.getActiveAssetId(),
      queueIndex: this.transport.getQueueIndex(),
      absoluteIndex: this.state.absoluteIndex,
      note: 'expect_native_resumeHold_then_arm',
    })
    if (this.state.gapActive && this.timerGapRunning && this.gapPaused) {
      this.gapPaused = false
      this.patchState({ status: 'playing' })
      this.gapResume?.()
      this.releasePauseGate()
      return true
    }

    // Native silence gap is already playing — foreground flaps must not call
    // NativeAudio.resume (that used to restart NP from 0→100% on the content card).
    const activeId = this.transport.getActiveAssetId()
    if (
      this.state.gapActive &&
      !this.timerGapRunning &&
      this.state.status === 'playing' &&
      ListeningQueueEngine.isGapQueueAsset(activeId)
    ) {
      immersiveLog('engine.resume.skip_gap_already_playing', { assetId: activeId })
      this.releasePauseGate()
      return true
    }

    const resumed = await this.transport.resume()
    if (resumed) {
      this.patchState({ status: 'playing' })
      this.releasePauseGate()
      return true
    }

    if (this.state.status !== 'paused' && this.state.status !== 'playing' && this.state.status !== 'loading') {
      return false
    }

    this.patchState({ status: 'playing' })
    this.releasePauseGate()
    return this.softRestartCurrentSegment()
  }

  private releasePauseGate() {
    const resolve = this.pauseGateResolve
    this.pauseGateResolve = null
    resolve?.()
  }

  /** Block queue advance while UI/engine is paused (complete can still resolve). */
  private async holdWhilePaused(generation: number): Promise<boolean> {
    while (this.isCurrent(generation) && this.state.status === 'paused') {
      await new Promise<void>((resolve) => {
        this.pauseGateResolve = () => {
          this.pauseGateResolve = null
          resolve()
        }
      })
    }
    return this.isCurrent(generation)
  }

  /**
   * Lock-screen pause: Capgo already paused the player. Sync Engine/UI only
   * (avoids second NativeAudio.pause that rewrites timeBeforePause / flashes scrubber).
   */
  private handleRemotePause() {
    if (this.state.gapActive && this.timerGapRunning) {
      this.gapPaused = true
      this.scheduler.cancel()
      this.patchState({ status: 'paused' })
      return
    }
    this.patchState({ status: 'paused' })
  }

  /**
   * Lock-screen play: Capgo already resumed when a track was paused.
   * If a playback loop is active, only sync status. If armed (no loop yet),
   * start play() so auto-advance continues after the first track.
   */
  private handleRemotePlay() {
    if (this.state.gapActive && this.timerGapRunning && this.gapPaused) {
      this.gapPaused = false
      this.patchState({ status: 'playing' })
      this.gapResume?.()
      this.releasePauseGate()
      return
    }
    if (this.playbackLoopActive) {
      this.patchState({ status: 'playing' })
      this.releasePauseGate()
      return
    }
    fireAndForget(this.play())
  }

  async next(continuePlayback = true) {
    immersiveLog('engine.next', { continuePlayback })
    const binding = this.binding
    if (!binding) return
    const absolute = this.absoluteIndexOf(binding)
    const total = Math.max(binding.total, binding.items.length)
    const settings = this.getSettings()
    if (absolute >= total - 1 && !settings.loopQueue) return
    const nextAbsolute = absolute >= total - 1 ? 0 : absolute + 1
    await this.seekTo(nextAbsolute, continuePlayback)
  }

  async prev(continuePlayback = true) {
    immersiveLog('engine.prev', { continuePlayback })
    const binding = this.binding
    if (!binding) return
    const absolute = this.absoluteIndexOf(binding)
    const total = Math.max(binding.total, binding.items.length)
    const settings = this.getSettings()
    if (absolute <= 0 && !settings.loopQueue) return
    const prevAbsolute = absolute <= 0 ? total - 1 : absolute - 1
    await this.seekTo(prevAbsolute, continuePlayback)
  }

  async seekTo(absoluteIndex: number, continuePlayback = true) {
    immersiveLog('engine.seekTo', { absoluteIndex, continuePlayback })
    this.bumpGeneration()
    this.scheduler.cancel()
    this.gapPaused = false
    this.segmentIndex = 0
    this.snapshotItemId = null
    this.itemSegments = []
    this.windowMeta = []
    this.windowLength = 0
    await this.transport.stop({ clearSession: !continuePlayback })
    if (!continuePlayback) {
      this.pendingContinue = false
      this.clearPendingContinueTimer()
      this.patchState({ status: 'idle', currentSegment: null, gapActive: false })
    } else {
      this.armPendingContinue()
      this.patchState({ status: 'loading', currentSegment: null, gapActive: false })
    }
    this.binding?.onIndexChange(absoluteIndex)
  }

  async stop(options?: { clearSession?: boolean; status?: ImmersivePlayerStatus }) {
    immersiveLog('engine.stop', { clearSession: options?.clearSession !== false })
    this.bumpGeneration()
    this.pendingContinue = false
    this.pendingArmPaused = false
    this.clearPendingContinueTimer()
    this.scheduler.cancel()
    this.gapPaused = false
    this.timerGapRunning = false
    this.playbackLoopActive = false
    this.clearSleepTimer()
    this.segmentIndex = 0
    this.snapshotItemId = null
    this.itemSegments = []
    this.windowMeta = []
    this.windowLength = 0
    // clearSession → stop + clearQueue clears the Now Playing card (docs §6 / §9).
    await this.transport.stop({ clearSession: options?.clearSession !== false })
    this.patchState({
      status: options?.status ?? 'idle',
      currentSegment: null,
      gapActive: false,
      errorMessage: null,
    })
  }

  updateSettings(partial: Partial<ImmersivePlaybackSettings>) {
    const rateChanged = partial.playbackRate !== undefined
    const gapChanged = partial.pauseGapSeconds !== undefined
    if (rateChanged) {
      const rate = normalizeImmersivePlaybackRate(partial.playbackRate)
      fireAndForget(this.transport.setRate(rate))
    }
    this.refreshSleepTimer()
    // Trailing silence bake depends on rate + gap; rebuild the content window.
    if (
      (rateChanged || gapChanged) &&
      (this.state.status === 'playing' || this.state.status === 'paused' || this.state.status === 'loading')
    ) {
      fireAndForget(this.softRestartCurrentSegment())
    }
  }

  async dispose() {
    await this.stop({ clearSession: true })
    this.transport.setNativeEventHandler(null)
    this.transport.clearResolveCache()
    this.listeners.clear()
    this.binding = null
  }

  private syncFromQueueIndex(queueIndex: number) {
    if (queueIndex < 0 || queueIndex >= this.windowMeta.length) return
    this.lastKnownQueueIndex = queueIndex
    const meta = this.windowMeta[queueIndex]
    this.segmentIndex = meta.segmentIndex
    const segment = this.itemSegments[meta.segmentIndex]
    if (segment) {
      this.patchState({
        currentSegment: segment,
        status: this.state.status === 'paused' ? 'paused' : 'playing',
        gapActive: meta.kind === 'gap',
      })
    }
    // Trailing silence has no next content in the native window — native
    // gapPreArm.skip. Pre-arm the *next learning item* so end→0 lands in silence.
    if (meta.kind === 'gap' && queueIndex === this.windowMeta.length - 1) {
      this.maybePreArmDuringTrailingGap(this.generation)
    }
  }

  private absoluteIndexOf(binding: PlaylistBinding) {
    return (binding.windowOffset ?? 0) + binding.index
  }

  private bumpGeneration() {
    this.generation += 1
    this.scheduler.cancel()
    this.releasePauseGate()
    this.nextItemPreArm = null
    this.preArmInFlight = null
    this.trailingPreArmCommittedKey = null
  }

  private isCurrent(generation: number) {
    return generation === this.generation
  }

  private patchState(partial: Partial<ListeningQueueEngineState>) {
    this.state = { ...this.state, ...partial }
    const snapshot = this.getState()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private armPendingContinue() {
    this.pendingContinue = true
    this.clearPendingContinueTimer()
    this.pendingContinueTimer = setTimeout(() => {
      if (!this.pendingContinue) return
      this.pendingContinue = false
      fireAndForget(this.stop({ status: 'ended' }))
    }, PENDING_CONTINUE_TIMEOUT_MS)
  }

  private clearPendingContinueTimer() {
    if (this.pendingContinueTimer) {
      clearTimeout(this.pendingContinueTimer)
      this.pendingContinueTimer = null
    }
  }

  private maybeLoadMore() {
    const binding = this.binding
    if (!binding?.onLoadMoreNearEnd) return
    const absolute = this.absoluteIndexOf(binding)
    if (absolute < binding.items.length - LOAD_MORE_THRESHOLD) return
    if (binding.items.length >= binding.total) return
    if (this.loadMoreInFlightOffset === binding.items.length) return
    this.loadMoreInFlightOffset = binding.items.length
    try {
      binding.onLoadMoreNearEnd()
    } catch {
      // load-more failures must not stop playback
    }
    const frozenLength = binding.items.length
    setTimeout(() => {
      if (this.loadMoreInFlightOffset === frozenLength) {
        this.loadMoreInFlightOffset = null
      }
    }, 0)
  }

  private refreshSleepTimer() {
    this.clearSleepTimer()
    const minutes = this.getSettings().sleepTimerMinutes
    const active = this.state.status === 'loading' || this.state.status === 'playing' || this.state.status === 'paused'
    if (!minutes || !active) return
    this.sleepTimer = setTimeout(() => {
      fireAndForget(this.stop({ status: 'ended' }).then(() => this.onSleepEnd?.()))
    }, minutes * 60 * 1000)
  }

  private clearSleepTimer() {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer)
      this.sleepTimer = null
    }
  }

  private async softRestartCurrentSegment(): Promise<boolean> {
    const segment = this.itemSegments[this.segmentIndex] ?? this.state.currentSegment
    if (!segment) return false

    immersiveLog('engine.softRestart', { segmentId: segment.id, segmentIndex: this.segmentIndex })
    this.bumpGeneration()
    const generation = this.generation
    this.scheduler.cancel()
    this.gapPaused = false
    this.playbackLoopActive = true
    await this.transport.stop({ clearSession: false })

    this.patchState({ status: 'loading', gapActive: false, currentSegment: segment, errorMessage: null })
    this.refreshSleepTimer()

    try {
      const played = await this.playSegmentWindow(generation, this.segmentIndex)
      if (!played || !this.isCurrent(generation)) return false

      if (this.getSettings().repeatPerItem === 'infinite') {
        await this.runItemLoop(generation)
        return this.isCurrent(generation)
      }

      await this.advanceAfterItem(generation)
      return true
    } catch (error) {
      if (!this.isCurrent(generation)) return false
      immersiveLog('engine.softRestart.failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      this.patchState({ status: 'error', errorMessage: error instanceof Error ? error.message : 'play failed' })
      this.onPlayFailed?.(error)
      return false
    }
  }

  private async playFromCurrentItem(options?: { rebuildSnapshot?: boolean }) {
    const generation = this.generation
    const binding = this.binding
    if (!binding) return
    const item = binding.items[binding.index]
    if (!item) {
      this.armPendingContinue()
      this.patchState({ status: 'loading' })
      return
    }

    const rebuild = options?.rebuildSnapshot !== false || this.snapshotItemId !== item.id || this.itemSegments.length === 0
    if (rebuild) {
      const settings = this.getSettings()
      this.itemSegments = buildPlaybackSegments(item, settings)
      this.snapshotItemId = item.id
      this.segmentIndex = 0
    }

    if (this.itemSegments.length === 0) {
      this.playbackLoopActive = false
      this.patchState({ status: 'idle', currentItemId: item.id, currentSegment: null })
      this.onEmptySegments?.()
      return
    }

    this.playbackLoopActive = true
    this.patchState({
      status: 'loading',
      absoluteIndex: this.absoluteIndexOf(binding),
      currentItemId: item.id,
      errorMessage: null,
    })
    this.refreshSleepTimer()
    this.maybeLoadMore()
    await this.runItemLoop(generation)
  }

  private async runItemLoop(generation: number) {
    this.playbackLoopActive = true
    try {
      do {
        if (!this.isCurrent(generation)) return
        const played = await this.playSegmentWindow(generation, 0)
        if (!played || !this.isCurrent(generation)) return
      } while (
        this.isCurrent(generation)
        && this.getSettings().repeatPerItem === 'infinite'
      )

      if (!this.isCurrent(generation)) return
      await this.advanceAfterItem(generation)
    } catch (error) {
      if (!this.isCurrent(generation)) return
      this.playbackLoopActive = false
      immersiveLog('engine.playback.failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      this.patchState({ status: 'error', errorMessage: error instanceof Error ? error.message : 'play failed' })
      this.onPlayFailed?.(error)
    }
  }

  private willNeedTrailingGap(): boolean {
    const settings = this.getSettings()
    const willRepeat = settings.repeatPerItem === 'infinite'
    const binding = this.binding
    if (!binding) return willRepeat
    const absolute = this.absoluteIndexOf(binding)
    const total = Math.max(binding.total, binding.items.length)
    const willAdvance = settings.autoNext && (absolute < total - 1 || settings.loopQueue)
    return willRepeat || willAdvance
  }

  private willAdvanceAfterWindow(): boolean {
    const settings = this.getSettings()
    if (!settings.autoNext) return false
    const binding = this.binding
    if (!binding) return false
    const absolute = this.absoluteIndexOf(binding)
    const total = Math.max(binding.total, binding.items.length)
    return absolute < total - 1 || settings.loopQueue
  }

  /** Resolve next item's first segment early (while current window still plays). */
  private prepareNextItemPreArm(generation: number) {
    fireAndForget(this.prepareNextItemPreArmPayload(generation))
  }

  private async prepareNextItemPreArmPayload(generation: number) {
    if (!this.isCurrent(generation)) return
    if (!this.willAdvanceAfterWindow()) return
    const binding = this.binding
    if (!binding) return
    const settings = this.getSettings()
    const absolute = this.absoluteIndexOf(binding)
    const total = Math.max(binding.total, binding.items.length)
    const hasNext = absolute < total - 1
    const nextAbsolute = hasNext ? absolute + 1 : 0
    const nextLocal = nextAbsolute - (binding.windowOffset ?? 0)
    const nextItem = binding.items[nextLocal]
    if (!nextItem) {
      immersiveLog('engine.nextItemPreArm.skip', {
        nextAbsolute,
        note: 'next_item_not_in_window',
      })
      return
    }

    const segments = buildPlaybackSegments(nextItem, settings)
    const first = segments[0]
    if (!first) return
    const fileUrl = await this.transport.resolve(first, { allowTts: !this.isBackground() })
    if (!fileUrl || !this.isCurrent(generation)) return

    this.nextItemPreArm = {
      generation,
      assetId: toQueueAssetId(first.id),
      fileUrl,
      title: first.title,
      artist: first.subtitle || this.mediaLabels?.artist,
      album: this.mediaLabels?.album,
      segmentId: first.id,
    }
    immersiveLog('engine.nextItemPrepared', {
      assetId: this.nextItemPreArm.assetId,
      nextAbsolute,
    })
  }

  private maybePreArmDuringTrailingGap(generation: number) {
    if (!this.isCurrent(generation)) return
    if (!this.willAdvanceAfterWindow()) return
    if (this.preArmInFlight) return

    this.preArmInFlight = this.ensureTrailingPreArm(generation).finally(() => {
      this.preArmInFlight = null
    })
  }

  /** Awaitable: used before queueNext into the trailing gap so end→0 is not mid-silence. */
  private async ensureTrailingPreArm(generation: number) {
    if (!this.isCurrent(generation)) return
    if (!this.willAdvanceAfterWindow()) return
    if (!this.nextItemPreArm || this.nextItemPreArm.generation !== generation) {
      await this.prepareNextItemPreArmPayload(generation)
    }
    await this.commitTrailingGapPreArm(generation)
  }

  private async commitTrailingGapPreArm(generation: number) {
    const payload = this.nextItemPreArm
    if (!payload || payload.generation !== generation || !this.isCurrent(generation)) return
    const key = `${generation}:${payload.assetId}`
    if (this.trailingPreArmCommittedKey === key) {
      immersiveLog('engine.preArmTrailingGap.skip', { assetId: payload.assetId, note: 'already_committed' })
      return
    }
    immersiveLog('engine.preArmTrailingGap', { assetId: payload.assetId })
    await this.transport.preArmCard({
      assetId: payload.assetId,
      fileUrl: payload.fileUrl,
      title: payload.title,
      artist: payload.artist,
      album: payload.album,
      segmentId: payload.segmentId,
      kind: 'segment',
    })
    if (this.isCurrent(generation)) {
      this.trailingPreArmCommittedKey = key
    }
  }

  /**
   * Build a native queue of content + silence-file gap tracks, then play through.
   *
   * Lock-screen gaps must not rely on JS timers (suspended in background) or on
   * WebView decode+pad (often fails). Silence WAVs are real Capgo tracks; native
   * skips rewriting Now Playing for `immersive:gap:*` so the scrubber holds at
   * the previous content end for the full pause.
   */
  private async playSegmentWindow(generation: number, fromSegmentIndex: number): Promise<boolean> {
    // Background only gates new TTS — silence files still apply on lock screen.
    const allowTts = !this.isBackground()
    const settings = this.getSettings()
    const gapSeconds = normalizePauseGapSeconds(settings.pauseGapSeconds)
    const playbackRate = normalizeImmersivePlaybackRate(settings.playbackRate)
    const needTrailingGap = this.willNeedTrailingGap()

    const windowItems: QueuePlayItem[] = []
    const windowMeta: Array<{
      segmentIndex: number
      kind: 'segment' | 'gap'
      leadingBaked: boolean
      trailingBaked: boolean
      leadingSilenceSec: number
      trailingSilenceSec: number
    }> = []

    const pushGap = async (
      afterSegment: PlaybackSegment,
      segmentIndex: number,
      wallClockSec: number,
    ): Promise<boolean> => {
      if (wallClockSec <= 0) return true
      // Compensates setRate so wall-clock pause ≈ settings (silence file is longer at >1x).
      const bakeSec = bakeSilenceDurationSeconds(wallClockSec, playbackRate)
      const silenceUrl = await this.resolveSilenceUrl(bakeSec)
      if (!this.isCurrent(generation)) return false
      if (!silenceUrl) {
        immersiveLog('engine.gap.silenceMissing', {
          segmentId: afterSegment.id,
          wallClockSec,
          bakeSec,
          note: 'timer_fallback_later',
        })
        return false
      }
      windowItems.push({
        assetId: toGapAssetId(afterSegment.id, wallClockSec, playbackRate),
        fileUrl: silenceUrl,
        title: afterSegment.title,
        artist: afterSegment.subtitle || this.mediaLabels?.artist,
        album: this.mediaLabels?.album,
        segmentId: afterSegment.id,
        kind: 'gap',
      })
      windowMeta.push({
        segmentIndex,
        kind: 'gap',
        leadingBaked: true,
        trailingBaked: true,
        leadingSilenceSec: 0,
        trailingSilenceSec: wallClockSec,
      })
      return true
    }

    const resolvedSegments: Array<{ index: number; segment: PlaybackSegment; fileUrl: string }> = []
    for (let i = fromSegmentIndex; i < this.itemSegments.length; i += 1) {
      if (!this.isCurrent(generation)) return false
      const segment = this.itemSegments[i]
      const fileUrl = await this.transport.resolve(segment, { allowTts })
      if (!this.isCurrent(generation)) return false
      if (!fileUrl) continue
      resolvedSegments.push({ index: i, segment, fileUrl })
    }

    /** Gaps that could not be materialized as silence files → timer fallback. */
    const pendingTimerGaps: Array<{ afterQueueIndex: number; seconds: number }> = []

    for (let r = 0; r < resolvedSegments.length; r += 1) {
      if (!this.isCurrent(generation)) return false
      const { index, segment, fileUrl } = resolvedSegments[r]
      const isLast = r === resolvedSegments.length - 1
      const prevSegment = r === 0 ? undefined : resolvedSegments[r - 1]?.segment
      const nextSegment = isLast ? undefined : resolvedSegments[r + 1]?.segment
      const leadingSilenceSec = computeLeadingSilenceSeconds({
        segment,
        prevSegment,
      })
      const trailingSilenceSec = computeTrailingSilenceSeconds({
        segment,
        nextSegment,
        isLastInResolvedWindow: isLast,
        needTrailingGap,
        pauseGapSeconds: gapSeconds,
      })

      // Prefer a dedicated silence track for leading pause (word→example 1s).
      if (leadingSilenceSec > 0 && prevSegment) {
        const ok = await pushGap(prevSegment, resolvedSegments[r - 1]!.index, leadingSilenceSec)
        if (!this.isCurrent(generation)) return false
        if (!ok) {
          pendingTimerGaps.push({ afterQueueIndex: windowItems.length - 1, seconds: leadingSilenceSec })
        }
      }

      windowItems.push({
        assetId: toQueueAssetId(segment.id),
        fileUrl,
        title: segment.title,
        artist: segment.subtitle || this.mediaLabels?.artist,
        album: this.mediaLabels?.album,
        segmentId: segment.id,
        kind: 'segment',
      })
      const segmentQueueIndex = windowItems.length - 1
      windowMeta.push({
        segmentIndex: index,
        kind: 'segment',
        leadingBaked: leadingSilenceSec <= 0,
        trailingBaked: trailingSilenceSec <= 0,
        leadingSilenceSec,
        trailingSilenceSec,
      })

      if (trailingSilenceSec > 0) {
        const ok = await pushGap(segment, index, trailingSilenceSec)
        if (!this.isCurrent(generation)) return false
        if (!ok) {
          pendingTimerGaps.push({ afterQueueIndex: segmentQueueIndex, seconds: trailingSilenceSec })
          windowMeta[segmentQueueIndex]!.trailingBaked = false
        } else {
          windowMeta[segmentQueueIndex]!.trailingBaked = true
        }
      }
    }

    this.windowMeta = windowMeta
    this.windowLength = windowItems.length
    this.lastKnownQueueIndex = windowItems.length > 0 ? 0 : -1

    immersiveLog('engine.playWindow', {
      fromSegmentIndex,
      windowLength: windowItems.length,
      gapSeconds,
      playbackRate,
      needTrailingGap,
      gaps: windowItems.filter((item) => item.kind === 'gap').map((item) => item.assetId),
      assetIds: windowItems.map((item) => item.assetId),
      timerFallbacks: pendingTimerGaps.length,
    })

    // Warm next-item URL while this window plays so trailing-gap pre-arm is ready.
    if (needTrailingGap && this.willAdvanceAfterWindow()) {
      this.prepareNextItemPreArm(generation)
    }

    if (windowItems.length === 0) {
      return true
    }

    this.segmentIndex = windowMeta[0]!.segmentIndex
    this.patchState({
      status: 'playing',
      currentSegment: this.itemSegments[this.segmentIndex],
      gapActive: windowMeta[0]!.kind === 'gap',
    })

    if (!(await this.holdWhilePaused(generation))) return false

    await this.transport.playQueue(windowItems, {
      startIndex: 0,
      playbackRate,
    })
    if (!this.isCurrent(generation)) return false
    if (!(await this.holdWhilePaused(generation))) return false

    let windowPos = Math.max(0, this.transport.getQueueIndex())
    this.syncFromQueueIndex(windowPos)

    while (windowPos < windowItems.length - 1) {
      if (!this.isCurrent(generation)) return false
      if (!(await this.holdWhilePaused(generation))) return false

      // Timer fallback only when a silence file could not be created.
      const timerGap = pendingTimerGaps.find((gap) => gap.afterQueueIndex === windowPos)
      if (timerGap) {
        const continued = await this.waitGap(generation, timerGap.seconds)
        if (!continued || !this.isCurrent(generation)) return false
      }

      // Native remote prev/next may move the index either direction (and skip gaps).
      // Always trust live queue index — never assume +1 after a wait.
      let liveIndex = this.transport.getQueueIndex()
      if (liveIndex !== windowPos && liveIndex >= 0 && liveIndex < windowItems.length) {
        windowPos = liveIndex
        this.syncFromQueueIndex(windowPos)
        if (windowPos >= windowItems.length - 1) break
        continue
      }

      if (!(await this.holdWhilePaused(generation))) return false

      const before = windowPos
      const nextSlot = before + 1
      // Trailing gap has no native next content — pre-arm the next learning item
      // *before* leaving the content end pin, so 100%→0 is not mid-gap / late.
      if (
        nextSlot === windowItems.length - 1
        && windowMeta[nextSlot]?.kind === 'gap'
      ) {
        await this.ensureTrailingPreArm(generation)
        if (!this.isCurrent(generation)) return false
      }

      const advanced = await this.transport.queueNext()
      if (!this.isCurrent(generation)) return false

      liveIndex = this.transport.getQueueIndex()
      if (liveIndex >= 0 && liveIndex < windowItems.length && liveIndex !== before) {
        windowPos = liveIndex
        this.syncFromQueueIndex(windowPos)
        continue
      }
      if (!advanced) break

      windowPos = Math.min(windowItems.length - 1, before + 1)
      this.syncFromQueueIndex(windowPos)
    }

    // Trailing timer fallback after the last content slot when silence file missing.
    if (!this.isCurrent(generation)) return false
    if (!(await this.holdWhilePaused(generation))) return false
    const endTimer = pendingTimerGaps.find((gap) => gap.afterQueueIndex === windowPos)
    if (endTimer) {
      const continued = await this.waitGap(generation, endTimer.seconds)
      if (!continued || !this.isCurrent(generation)) return false
    }

    return true
  }

  /** True when the native queue asset is a silence spacer (lock-screen holds NP card). */
  static isGapQueueAsset(assetId: string | null | undefined) {
    return Boolean(assetId && isGapAssetId(assetId))
  }

  /** Fallback when trailing silence could not be baked into the content file. */
  private async waitGap(generation: number, silenceSeconds?: number): Promise<boolean> {
    const seconds =
      silenceSeconds != null && silenceSeconds > 0
        ? silenceSeconds
        : normalizePauseGapSeconds(this.getSettings().pauseGapSeconds)
    const ms = Math.max(0, seconds * 1000)

    immersiveLog('engine.waitGap.enter', {
      ms,
      seconds,
      background: this.isBackground(),
    })
    this.timerGapRunning = true
    this.patchState({ gapActive: true, status: this.gapPaused ? 'paused' : 'playing' })

    let remaining = ms
    const startedAt = this.now()
    while (this.isCurrent(generation)) {
      if (this.gapPaused) {
        this.patchState({ status: 'paused', gapActive: true })
        await new Promise<void>((resolve) => {
          this.gapResume = () => {
            this.gapResume = null
            resolve()
          }
        })
        if (!this.isCurrent(generation)) break
        this.patchState({ status: 'playing', gapActive: true })
      }

      const slice = Math.max(0, remaining)
      const continued = await this.scheduler.delay(slice)
      if (!this.isCurrent(generation)) break
      if (!continued) {
        if (this.gapPaused) {
          remaining = Math.max(0, remaining - (this.now() - startedAt))
          continue
        }
        this.timerGapRunning = false
        this.patchState({ gapActive: false })
        immersiveLog('engine.waitGap.cancelled')
        return false
      }
      this.timerGapRunning = false
      this.patchState({ gapActive: false })
      immersiveLog('engine.waitGap.exit')
      return true
    }

    this.timerGapRunning = false
    this.patchState({ gapActive: false })
    immersiveLog('engine.waitGap.aborted')
    return false
  }

  private async advanceAfterItem(generation: number) {
    if (!this.isCurrent(generation)) return
    const binding = this.binding
    if (!binding) return
    const settings = this.getSettings()
    const absolute = this.absoluteIndexOf(binding)
    const total = Math.max(binding.total, binding.items.length)
    const hasNext = absolute < total - 1

    immersiveLog('engine.advanceAfterItem', {
      absolute,
      total,
      hasNext,
      autoNext: settings.autoNext,
      loopQueue: settings.loopQueue,
    })

    // Queue finished (no auto-advance, or last item without loop): rewind to first + pause.
    // loopQueue continues from 0 without pausing (below).
    if (!settings.autoNext || (!hasNext && !settings.loopQueue)) {
      await this.rewindToStartAndArmPaused(generation)
      return
    }

    if (!hasNext && settings.loopQueue && total === 1) {
      fireAndForget(this.play())
      return
    }

    const nextAbsolute = hasNext ? absolute + 1 : 0
    const nextLocal = nextAbsolute - (binding.windowOffset ?? 0)
    this.snapshotItemId = null
    this.itemSegments = []
    this.segmentIndex = 0
    this.windowMeta = []
    this.windowLength = 0

    // Play next item immediately — do not clearQueue/arm via React round-trip
    // (that blanked the Now Playing card between learning items).
    if (nextLocal >= 0 && binding.items[nextLocal]) {
      this.pendingContinue = false
      this.clearPendingContinueTimer()
      this.binding = { ...binding, index: nextLocal }
      this.patchState({
        status: 'loading',
        absoluteIndex: nextAbsolute,
        currentItemId: binding.items[nextLocal]?.id ?? null,
        currentSegment: null,
      })
      binding.onIndexChange(nextAbsolute)
      await this.playFromCurrentItem({ rebuildSnapshot: true })
      return
    }

    this.armPendingContinue()
    this.patchState({ status: 'loading', currentSegment: null })
    binding.onIndexChange(nextAbsolute)
  }

  /**
   * End of queue without loop: jump to list[0], arm paused Now Playing (do not clear card).
   */
  private async rewindToStartAndArmPaused(generation: number) {
    if (!this.isCurrent(generation)) return
    const binding = this.binding
    if (!binding) return

    immersiveLog('engine.rewindToStartAndArmPaused', {
      fromAbsolute: this.absoluteIndexOf(binding),
    })

    this.playbackLoopActive = false
    this.pendingContinue = false
    this.pendingArmPaused = false
    this.clearPendingContinueTimer()
    this.scheduler.cancel()
    this.gapPaused = false
    this.timerGapRunning = false
    this.snapshotItemId = null
    this.itemSegments = []
    this.segmentIndex = 0
    this.windowMeta = []
    this.windowLength = 0
    this.lastKnownQueueIndex = -1

    // Stop residual audio but keep the Now Playing session so arm can rewrite the card.
    await this.transport.stop({ clearSession: false })
    if (!this.isCurrent(generation)) return

    const nextAbsolute = 0
    const nextLocal = nextAbsolute - (binding.windowOffset ?? 0)

    if (nextLocal >= 0 && nextLocal < binding.items.length && binding.items[nextLocal]) {
      this.binding = { ...binding, index: nextLocal }
      this.patchState({
        status: 'paused',
        absoluteIndex: nextAbsolute,
        currentItemId: binding.items[nextLocal]!.id,
        currentSegment: null,
        gapActive: false,
        errorMessage: null,
      })
      binding.onIndexChange(nextAbsolute)
      await this.armSession()
      return
    }

    // First item not in the current window — host rebinds to 0, then we arm.
    this.pendingArmPaused = true
    this.patchState({
      status: 'paused',
      absoluteIndex: nextAbsolute,
      currentItemId: null,
      currentSegment: null,
      gapActive: false,
      errorMessage: null,
    })
    binding.onIndexChange(nextAbsolute)
  }
}

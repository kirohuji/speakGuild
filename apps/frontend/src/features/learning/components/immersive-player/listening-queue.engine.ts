import { buildPlaybackSegments } from './immersive-player.mapper'
import type {
  ImmersiveAudioTransport,
  MediaMetadataLabels,
  QueuePlayItem,
} from './immersive-audio.transport'
import { immersiveLog, toQueueAssetId } from './immersive-audio.transport'
import {
  normalizePauseGapSeconds,
  resolveSilenceFileUrl,
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
  /** Override silence URL resolution (tests / custom assets). */
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
  private gapPaused = false
  private gapResume: (() => void) | null = null
  /** True only while JS timer waitGap is in flight (silence-queue gaps use transport pause). */
  private timerGapRunning = false
  private sleepTimer: ReturnType<typeof setTimeout> | null = null
  private loadMoreInFlightOffset: number | null = null
  private itemSegments: PlaybackSegment[] = []
  private snapshotItemId: string | null = null
  private segmentIndex = 0
  /** Maps native queue index → learning segment index (+ whether slot is silence). */
  private windowMeta: Array<{ segmentIndex: number; isGap: boolean }> = []
  private windowLength = 0
  private lastKnownQueueIndex = -1

  constructor(options: ListeningQueueEngineOptions) {
    this.transport = options.transport
    this.getSettings = options.getSettings
    this.scheduler = options.scheduler
    this.isBackground = options.isBackground
    this.now = options.now ?? (() => Date.now())
    this.mediaLabels = options.mediaLabels
    this.resolveSilenceUrl = options.resolveSilenceUrl ?? resolveSilenceFileUrl
    this.onSleepEnd = options.onSleepEnd
    this.onEmptySegments = options.onEmptySegments
    this.onPlayFailed = options.onPlayFailed

    this.transport.setNativeEventHandler((event) => {
      if (event.type === 'playbackState') {
        if (event.reason === 'remotePlay') {
          // NativeAudio already resumed. Only sync engine/UI — never call transport.resume()
          // (would double-resume and can soft-restart on false → audible jump).
          immersiveLog('engine.remotePlay.sync')
          this.syncFromRemotePlay()
        } else if (event.reason === 'remotePause') {
          // NativeAudio already paused. Only sync engine/UI — never call transport.pause().
          immersiveLog('engine.remotePause.sync')
          this.syncFromRemotePause()
        } else if (event.reason === 'remoteNextTrack' || event.reason === 'remoteNext') {
          // Fallback when plugin emits playbackState instead of queueChange (e.g. empty/edge queue).
          immersiveLog('engine.remoteNext.playbackState', { reason: event.reason })
          if (this.windowLength <= 1 || this.transport.getQueueIndex() >= this.windowLength - 1) {
            fireAndForget(this.next(true))
          }
        } else if (event.reason === 'remotePreviousTrack' || event.reason === 'remotePrevious') {
          immersiveLog('engine.remotePrev.playbackState', { reason: event.reason })
          if (this.windowLength <= 1 || this.transport.getQueueIndex() <= 0) {
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

      // Cross learning-item when remote skip cannot move within the native window.
      if (isNext && event.reason === 'remoteNext' && this.windowLength > 0) {
        if (event.index >= this.windowLength - 1 && prevQueueIndex >= this.windowLength - 1) {
          fireAndForget(this.next(true))
        }
      }
      if (isPrev && event.reason === 'remotePrevious' && this.windowLength > 0) {
        if (event.index <= 0 && prevQueueIndex <= 0) {
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
    this.clearPendingContinueTimer()
    await this.playFromCurrentItem({ rebuildSnapshot: true })
  }

  async pause() {
    immersiveLog('engine.pause', { gapActive: this.state.gapActive, timerGap: this.timerGapRunning })
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
    })
    if (this.state.gapActive && this.timerGapRunning && this.gapPaused) {
      this.gapPaused = false
      this.patchState({ status: 'playing' })
      this.gapResume?.()
      return true
    }

    const resumed = await this.transport.resume()
    if (resumed) {
      this.patchState({ status: 'playing' })
      return true
    }

    if (this.state.status !== 'paused' && this.state.status !== 'playing' && this.state.status !== 'loading') {
      return false
    }

    return this.softRestartCurrentSegment()
  }

  /**
   * Lock-screen / headset pause already applied by NativeAudio.
   * Sync session state only — do not call transport.pause().
   */
  private syncFromRemotePause() {
    if (this.state.gapActive && this.timerGapRunning) {
      this.gapPaused = true
      this.scheduler.cancel()
      this.patchState({ status: 'paused' })
      return
    }
    if (this.state.status === 'playing' || this.state.status === 'loading') {
      this.patchState({ status: 'paused' })
    }
  }

  /**
   * Lock-screen / headset play already applied by NativeAudio.
   * Sync session state only — do not call transport.resume() (avoids soft-restart).
   */
  private syncFromRemotePlay() {
    if (this.state.gapActive && this.timerGapRunning && this.gapPaused) {
      this.gapPaused = false
      this.patchState({ status: 'playing' })
      this.gapResume?.()
      return
    }
    if (this.state.status === 'paused' || this.state.status === 'loading') {
      this.patchState({ status: 'playing' })
    }
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
    this.clearPendingContinueTimer()
    this.scheduler.cancel()
    this.gapPaused = false
    this.timerGapRunning = false
    this.clearSleepTimer()
    this.segmentIndex = 0
    this.snapshotItemId = null
    this.itemSegments = []
    this.windowMeta = []
    this.windowLength = 0
    await this.transport.stop({ clearSession: options?.clearSession !== false })
    this.patchState({
      status: options?.status ?? 'idle',
      currentSegment: null,
      gapActive: false,
      errorMessage: null,
    })
  }

  updateSettings(partial: Partial<ImmersivePlaybackSettings>) {
    if (partial.playbackRate !== undefined) {
      fireAndForget(this.transport.setRate(partial.playbackRate))
    }
    this.refreshSleepTimer()
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
        status: meta.isGap && this.state.status === 'paused' ? 'paused' : 'playing',
        gapActive: meta.isGap,
      })
    }
  }

  private absoluteIndexOf(binding: PlaylistBinding) {
    return (binding.windowOffset ?? 0) + binding.index
  }

  private bumpGeneration() {
    this.generation += 1
    this.scheduler.cancel()
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
      this.patchState({ status: 'idle', currentItemId: item.id, currentSegment: null })
      this.onEmptySegments?.()
      return
    }

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

  /**
   * Resolve playable segments from `fromSegmentIndex`, setQueue the window
   * (with silence gap tracks when possible), then queueNext until exhausted.
   */
  private async playSegmentWindow(generation: number, fromSegmentIndex: number): Promise<boolean> {
    const allowTts = !this.isBackground()
    const settings = this.getSettings()
    const gapSeconds = normalizePauseGapSeconds(settings.pauseGapSeconds)
    const wantGap = !this.isBackground() && gapSeconds > 0
    const silenceUrl = wantGap ? await this.resolveSilenceUrl(gapSeconds) : null
    if (!this.isCurrent(generation)) return false
    const useQueueSilence = Boolean(silenceUrl)
    const needTrailingGap = this.willNeedTrailingGap()

    const windowItems: QueuePlayItem[] = []
    const windowMeta: Array<{ segmentIndex: number; isGap: boolean }> = []

    const resolvedSegments: Array<{ index: number; segment: PlaybackSegment; fileUrl: string }> = []
    for (let i = fromSegmentIndex; i < this.itemSegments.length; i += 1) {
      if (!this.isCurrent(generation)) return false
      const segment = this.itemSegments[i]
      const fileUrl = await this.transport.resolve(segment, { allowTts })
      if (!this.isCurrent(generation)) return false
      if (!fileUrl) continue
      resolvedSegments.push({ index: i, segment, fileUrl })
    }

    for (let r = 0; r < resolvedSegments.length; r += 1) {
      const { index, segment, fileUrl } = resolvedSegments[r]
      windowItems.push({
        assetId: toQueueAssetId(segment.id),
        fileUrl,
        title: segment.title,
        artist: segment.subtitle || this.mediaLabels?.artist,
        album: this.mediaLabels?.album,
        segmentId: segment.id,
        kind: 'segment',
      })
      windowMeta.push({ segmentIndex: index, isGap: false })

      const isLast = r === resolvedSegments.length - 1
      const insertGap = useQueueSilence && silenceUrl && (!isLast || needTrailingGap)
      if (insertGap) {
        windowItems.push({
          assetId: toGapAssetId(segment.id, gapSeconds),
          fileUrl: silenceUrl,
          // Keep previous title so lock screen doesn't flash empty / -:--.
          title: segment.title,
          artist: segment.subtitle || this.mediaLabels?.artist,
          album: this.mediaLabels?.album,
          segmentId: segment.id,
          kind: 'gap',
        })
        windowMeta.push({ segmentIndex: index, isGap: true })
      }
    }

    this.windowMeta = windowMeta
    this.windowLength = windowItems.length
    this.lastKnownQueueIndex = windowItems.length > 0 ? 0 : -1

    immersiveLog('engine.playWindow', {
      fromSegmentIndex,
      windowLength: windowItems.length,
      useQueueSilence,
      gapSeconds: useQueueSilence ? gapSeconds : 0,
      kinds: windowItems.map((item) => item.kind ?? 'segment'),
      segmentIds: windowItems.map((item) => item.segmentId),
    })

    if (windowItems.length === 0) {
      return true
    }

    this.segmentIndex = windowMeta[0].segmentIndex
    this.patchState({
      status: 'playing',
      currentSegment: this.itemSegments[this.segmentIndex],
      gapActive: false,
    })

    await this.transport.playQueue(windowItems, {
      startIndex: 0,
      playbackRate: settings.playbackRate,
    })
    if (!this.isCurrent(generation)) return false

    let windowPos = Math.max(0, this.transport.getQueueIndex())
    this.syncFromQueueIndex(windowPos)

    while (windowPos < windowItems.length - 1) {
      if (!this.isCurrent(generation)) return false

      const currentIsGap = windowMeta[windowPos]?.isGap === true
      // Silence tracks already occupy the gap; only timer-fallback needs waitGap
      // after a real segment when the next slot is also a real segment (or trailing).
      if (!useQueueSilence && !currentIsGap) {
        const continued = await this.waitGap(generation)
        if (!continued || !this.isCurrent(generation)) return false
      }

      // Remote skip may have already moved the native queue ahead during gap.
      const liveIndex = this.transport.getQueueIndex()
      if (liveIndex > windowPos) {
        windowPos = liveIndex
        this.syncFromQueueIndex(windowPos)
        continue
      }

      const advanced = await this.transport.queueNext()
      if (!this.isCurrent(generation)) return false
      if (!advanced) break

      windowPos = Math.max(windowPos + 1, this.transport.getQueueIndex())
      this.syncFromQueueIndex(windowPos)
    }

    // Timer-fallback trailing gap when silence could not be inserted.
    if (!this.isCurrent(generation)) return false
    if (!useQueueSilence && needTrailingGap) {
      const continued = await this.waitGap(generation)
      if (!continued || !this.isCurrent(generation)) return false
    }

    return true
  }

  /** Fallback when silence WAV cannot be resolved — keeps prior JS timer gap behavior. */
  private async waitGap(generation: number): Promise<boolean> {
    const seconds = normalizePauseGapSeconds(this.getSettings().pauseGapSeconds)
    const ms = seconds * 1000
    const effectiveMs = this.isBackground() ? 0 : ms

    immersiveLog('engine.waitGap.enter', { ms: effectiveMs, background: this.isBackground() })
    this.timerGapRunning = true
    this.patchState({ gapActive: true, status: this.gapPaused ? 'paused' : 'playing' })

    let remaining = effectiveMs
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

    immersiveLog('engine.advanceAfterItem', { absolute, total, hasNext, autoNext: settings.autoNext })

    if (!settings.autoNext || (!hasNext && !settings.loopQueue)) {
      this.patchState({ status: 'ended', currentSegment: null })
      await this.transport.clearSession()
      return
    }

    if (!hasNext && settings.loopQueue && total === 1) {
      fireAndForget(this.play())
      return
    }

    const nextAbsolute = hasNext ? absolute + 1 : 0
    this.armPendingContinue()
    this.snapshotItemId = null
    this.itemSegments = []
    this.segmentIndex = 0
    this.windowMeta = []
    this.windowLength = 0
    this.patchState({ status: 'loading', currentSegment: null })
    binding.onIndexChange(nextAbsolute)
  }
}

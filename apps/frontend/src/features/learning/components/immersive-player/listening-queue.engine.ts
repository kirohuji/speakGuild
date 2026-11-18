import { buildPlaybackSegments } from './immersive-player.mapper'
import type { ImmersiveAudioTransport, MediaMetadataLabels, TransportSlot } from './immersive-audio.transport'
import {
  IMMERSIVE_PAUSE_GAP_SECONDS,
  type ImmersivePlaybackSettings,
  type ImmersivePlayerItem,
  type ImmersivePlayerStatus,
  type PlaybackSegment,
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
  private sleepTimer: ReturnType<typeof setTimeout> | null = null
  private loadMoreInFlightOffset: number | null = null
  private itemSegments: PlaybackSegment[] = []
  private currentSlot: TransportSlot = 'a'

  constructor(options: ListeningQueueEngineOptions) {
    this.transport = options.transport
    this.getSettings = options.getSettings
    this.scheduler = options.scheduler
    this.isBackground = options.isBackground
    this.now = options.now ?? (() => Date.now())
    this.mediaLabels = options.mediaLabels
    this.onSleepEnd = options.onSleepEnd
    this.onEmptySegments = options.onEmptySegments
    this.onPlayFailed = options.onPlayFailed

    this.transport.setNativeStateHandler((event) => {
      if (event.reason === 'remotePlay') {
        fireAndForget(this.resume())
      } else if (event.reason === 'remotePause') {
        fireAndForget(this.pause())
      } else if (event.reason === 'remotePreviousTrack') {
        fireAndForget(this.prev(true))
      } else if (event.reason === 'remoteNextTrack') {
        fireAndForget(this.next(true))
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
      fireAndForget(this.playFromCurrentItem())
      return
    }

    if (this.pendingContinue && binding.items[binding.index]) {
      // Same index but item hydrated — start if we were waiting for content.
      const item = binding.items[binding.index]
      if (item && this.state.status !== 'playing' && this.state.status !== 'loading') {
        this.clearPendingContinueTimer()
        this.pendingContinue = false
        fireAndForget(this.playFromCurrentItem())
      }
    }

    this.maybeLoadMore()
  }

  async play() {
    this.bumpGeneration()
    this.pendingContinue = false
    this.clearPendingContinueTimer()
    await this.playFromCurrentItem()
  }

  async pause() {
    if (this.state.gapActive) {
      this.gapPaused = true
      this.scheduler.cancel()
      this.patchState({ status: 'paused' })
      return
    }
    this.patchState({ status: 'paused' })
    await this.transport.pause()
  }

  async resume(): Promise<boolean> {
    if (this.state.gapActive && this.gapPaused) {
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
    if (this.state.status === 'paused' || this.state.status === 'playing' || this.state.status === 'loading') {
      await this.playFromCurrentItem()
      return true
    }
    return false
  }

  async next(continuePlayback = true) {
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
    this.bumpGeneration()
    this.scheduler.cancel()
    this.gapPaused = false
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
    this.bumpGeneration()
    this.pendingContinue = false
    this.clearPendingContinueTimer()
    this.scheduler.cancel()
    this.gapPaused = false
    this.clearSleepTimer()
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
    this.transport.setNativeStateHandler(null)
    this.transport.clearResolveCache()
    this.listeners.clear()
    this.binding = null
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

  private async playFromCurrentItem() {
    const generation = this.generation
    const binding = this.binding
    if (!binding) return
    const item = binding.items[binding.index]
    if (!item) {
      this.armPendingContinue()
      this.patchState({ status: 'loading' })
      return
    }

    const settings = this.getSettings()
    this.itemSegments = buildPlaybackSegments(item, settings)
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
        for (let segmentIndex = 0; segmentIndex < this.itemSegments.length; segmentIndex += 1) {
          if (!this.isCurrent(generation)) return
          const segment = this.itemSegments[segmentIndex]
          const played = await this.playOneSegment(generation, segment, segmentIndex)
          if (!played || !this.isCurrent(generation)) return

          const settings = this.getSettings()
          const moreInPass = segmentIndex < this.itemSegments.length - 1
          const willRepeat = settings.repeatPerItem === 'infinite'
          const binding = this.binding
          const absolute = binding ? this.absoluteIndexOf(binding) : 0
          const total = binding ? Math.max(binding.total, binding.items.length) : 0
          const willAdvance = settings.autoNext && binding != null && (absolute < total - 1 || settings.loopQueue)
          if (moreInPass || willRepeat || willAdvance) {
            const continued = await this.waitGap(generation)
            if (!continued || !this.isCurrent(generation)) return
          }
        }
      } while (
        this.isCurrent(generation)
        && this.getSettings().repeatPerItem === 'infinite'
      )

      if (!this.isCurrent(generation)) return
      await this.advanceAfterItem(generation)
    } catch (error) {
      if (!this.isCurrent(generation)) return
      console.warn('[listening-queue] playback failed', error)
      this.patchState({ status: 'error', errorMessage: error instanceof Error ? error.message : 'play failed' })
      this.onPlayFailed?.(error)
    }
  }

  private async playOneSegment(generation: number, segment: PlaybackSegment, segmentIndex: number): Promise<boolean> {
    const allowTts = !this.isBackground()
    this.patchState({ status: 'loading', currentSegment: segment, gapActive: false })

    const fileUrl = await this.transport.resolve(segment, { allowTts })
    if (!this.isCurrent(generation)) return false
    if (!fileUrl) {
      return true
    }

    const settings = this.getSettings()
    const slot = this.currentSlot
    await this.transport.setIosGapTrackControls(false)
    await this.transport.setMediaMetadata(segment, settings.playbackRate, 'playing', this.mediaLabels)
    if (!this.isCurrent(generation)) return false

    await this.transport.prepare(slot, fileUrl, {
      title: segment.title,
      artist: segment.subtitle || this.mediaLabels?.artist,
      album: this.mediaLabels?.album,
    })
    if (!this.isCurrent(generation)) return false

    fireAndForget(this.prefetchUpcoming(generation, segmentIndex, this.transport.otherSlot(slot)))

    this.patchState({ status: 'playing' })
    await this.transport.playSlot(slot, settings.playbackRate)
    if (!this.isCurrent(generation)) return false

    this.currentSlot = this.transport.otherSlot(slot)
    return true
  }

  private async prefetchUpcoming(generation: number, segmentIndex: number, slot: TransportSlot) {
    if (!this.isCurrent(generation)) return
    const nextSegment = this.itemSegments[segmentIndex + 1]
    if (!nextSegment) return
    const allowTts = !this.isBackground()
    try {
      const url = await this.transport.resolve(nextSegment, { allowTts })
      if (!url || !this.isCurrent(generation)) return
      await this.transport.prepare(slot, url, {
        title: nextSegment.title,
        artist: nextSegment.subtitle || this.mediaLabels?.artist,
        album: this.mediaLabels?.album,
      })
    } catch {
      // Prefetch failures are non-fatal.
    }
  }

  private async waitGap(generation: number): Promise<boolean> {
    const seconds = this.getSettings().pauseGapSeconds
    const ms = (IMMERSIVE_PAUSE_GAP_SECONDS.includes(seconds) ? seconds : 2) * 1000
    const effectiveMs = this.isBackground() ? 0 : ms

    await this.transport.setIosGapTrackControls(true, {
      previoustrack: () => { fireAndForget(this.prev(true)) },
      nexttrack: () => { fireAndForget(this.next(true)) },
    })

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
        this.patchState({ gapActive: false })
        await this.transport.setIosGapTrackControls(false)
        return false
      }
      this.patchState({ gapActive: false })
      await this.transport.setIosGapTrackControls(false)
      return true
    }

    this.patchState({ gapActive: false })
    await this.transport.setIosGapTrackControls(false)
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
    this.patchState({ status: 'loading', currentSegment: null })
    binding.onIndexChange(nextAbsolute)
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImmersiveAudioTransport, ImmersiveNativeEvent, QueuePlayItem } from '../immersive-audio.transport'
import { ListeningQueueEngine, type QueueScheduler } from '../listening-queue.engine'
import { DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS } from '../immersive-player.store'
import type { ImmersivePlaybackSettings, ImmersivePlayerItem } from '../immersive-player.types'

vi.mock('../immersive-audio.transport', async () => {
  const actual = await vi.importActual<typeof import('../immersive-audio.transport')>('../immersive-audio.transport')
  return {
    ...actual,
    resolveAppLogoArtworkUri: vi.fn(async () => 'file://logo.png'),
  }
})

function item(id: string, title: string, audioUrl = `file://${id}.mp3`): ImmersivePlayerItem {
  return {
    id,
    kind: 'word',
    title,
    meaning: `${title}-zh`,
    mainAudioUrl: audioUrl,
    audioUsUrl: audioUrl,
  }
}

function createFakeScheduler() {
  const queue: Array<{ ms: number; resolve: (ok: boolean) => void }> = []
  const scheduler: QueueScheduler = {
    delay(ms) {
      if (ms <= 0) return Promise.resolve(true)
      return new Promise<boolean>((resolve) => {
        queue.push({ ms, resolve })
      })
    },
    cancel() {
      while (queue.length) {
        queue.shift()!.resolve(false)
      }
    },
  }
  return {
    scheduler,
    flush(ms?: number) {
      const next = queue[0]
      if (!next) return false
      if (ms != null && next.ms > ms) return false
      queue.shift()!.resolve(true)
      return true
    },
    pending() {
      return queue.map((entry) => entry.ms)
    },
  }
}

function createFakeTransport(options?: { resumeResult?: boolean }) {
  let resumeResult = options?.resumeResult ?? true
  let allowTtsDefault = true
  let queue: QueuePlayItem[] = []
  let queueIndex = -1
  let activeAssetId: string | null = null
  let trackResolve: (() => void) | null = null
  let eventHandler: ((event: ImmersiveNativeEvent) => void) | null = null

  const calls = {
    resolve: [] as string[],
    armQueue: [] as Array<{ count: number; startIndex: number; assetIds: string[] }>,
    playQueue: [] as Array<{
      count: number
      startIndex: number
      assetIds: string[]
      fileUrls: string[]
      playbackRate?: number
    }>,
    queueNext: 0,
    queuePrevious: 0,
    stop: 0,
    pause: 0,
    resume: 0,
    seekTo: [] as number[],
    clearSession: 0,
  }

  function waitTrack(assetId: string) {
    activeAssetId = assetId
    return new Promise<void>((resolve) => {
      trackResolve = resolve
    })
  }

  const transport: ImmersiveAudioTransport = {
    async resolve(segment, options) {
      calls.resolve.push(segment.id)
      if (!segment.audioUrl?.trim()) {
        if (options?.allowTts === false || !allowTtsDefault) return null
        return `tts://${segment.id}`
      }
      return segment.audioUrl
    },
    async armQueue(items, options) {
      const startIndex = options?.startIndex ?? 0
      queue = items
      queueIndex = startIndex
      activeAssetId = items[startIndex]?.assetId ?? null
      calls.armQueue.push({
        count: items.length,
        startIndex,
        assetIds: items.map((entry) => entry.assetId),
      })
    },
    async playQueue(items, options) {
      const startIndex = options?.startIndex ?? 0
      queue = items
      queueIndex = startIndex
      calls.playQueue.push({
        count: items.length,
        startIndex,
        assetIds: items.map((entry) => entry.assetId),
        fileUrls: items.map((entry) => entry.fileUrl),
        playbackRate: options?.playbackRate,
      })
      const start = items[startIndex]
      if (!start) throw new Error('empty queue')
      await waitTrack(start.assetId)
    },
    async queueNext() {
      calls.queueNext += 1
      if (queueIndex + 1 >= queue.length) return false
      queueIndex += 1
      const next = queue[queueIndex]
      eventHandler?.({
        type: 'queueChange',
        reason: 'next',
        assetId: next.assetId,
        index: queueIndex,
      })
      await waitTrack(next.assetId)
      return true
    },
    async queuePrevious() {
      calls.queuePrevious += 1
      if (queueIndex - 1 < 0) return false
      queueIndex -= 1
      const prev = queue[queueIndex]
      eventHandler?.({
        type: 'queueChange',
        reason: 'previous',
        assetId: prev.assetId,
        index: queueIndex,
      })
      await waitTrack(prev.assetId)
      return true
    },
    async pause() {
      calls.pause += 1
    },
    async resume() {
      calls.resume += 1
      return resumeResult
    },
    async stop() {
      calls.stop += 1
      trackResolve?.()
      trackResolve = null
      activeAssetId = null
    },
    async setRate() {},
    async seekTo(seconds: number) {
      calls.seekTo.push(seconds)
    },
    hasResumableAsset: () => Boolean(activeAssetId),
    getActiveAssetId: () => activeAssetId,
    getQueueIndex: () => queueIndex,
    setNativeEventHandler(handler) {
      eventHandler = handler
    },
    clearResolveCache() {},
    async clearSession() {
      calls.clearSession += 1
      queue = []
      queueIndex = -1
      activeAssetId = null
    },
    subscribeVisualState() {
      return () => undefined
    },
  }

  return {
    transport,
    calls,
    setResumeResult(value: boolean) { resumeResult = value },
    setAllowTts(value: boolean) { allowTtsDefault = value },
    complete() {
      if (!trackResolve) return false
      const resolve = trackResolve
      trackResolve = null
      activeAssetId = null
      resolve()
      return true
    },
    /** Simulate native remote skip (gap-aware) without resolving the current wait. */
    jumpTo(index: number, reason: 'remotePrevious' | 'remoteNext') {
      if (index < 0 || index >= queue.length) return false
      queueIndex = index
      activeAssetId = queue[index]?.assetId ?? null
      const assetId = activeAssetId ?? ''
      eventHandler?.({ type: 'queueChange', reason, assetId, index })
      eventHandler?.({
        type: 'playbackState',
        reason,
        assetId,
        state: 'playing',
      })
      return true
    },
    emit(event: ImmersiveNativeEvent) {
      eventHandler?.(event)
    },
    getQueueIndex: () => queueIndex,
  }
}

describe('ListeningQueueEngine', () => {
  let settings: ImmersivePlaybackSettings
  let background = false
  let fakeTransport: ReturnType<typeof createFakeTransport>
  let fakeScheduler: ReturnType<typeof createFakeScheduler>
  let engine: ListeningQueueEngine
  let indexChanges: number[]
  let loadMoreCount: number

  beforeEach(() => {
    settings = {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      pauseGapSeconds: 2,
      autoNext: true,
      loopQueue: false,
      playExample: false,
      repeatPerItem: 1,
      sleepTimerMinutes: 0,
    }
    background = false
    fakeTransport = createFakeTransport()
    fakeScheduler = createFakeScheduler()
    indexChanges = []
    loadMoreCount = 0
    engine = new ListeningQueueEngine({
      transport: fakeTransport.transport,
      getSettings: () => settings,
      scheduler: fakeScheduler.scheduler,
      isBackground: () => background,
      // Deterministic silence-file gaps (lock-screen safe; no WebView decode pad).
      resolveSilenceUrl: async (seconds) => `silence://${seconds}`,
    })
  })

  afterEach(async () => {
    await engine.dispose()
  })

  function bind(items: ImmersivePlayerItem[], index = 0, total = items.length) {
    engine.bindPlaylist({
      items,
      index,
      total,
      onIndexChange: (absolute) => {
        indexChanges.push(absolute)
        engine.bindPlaylist({
          items,
          index: absolute,
          total,
          onIndexChange: (next) => {
            indexChanges.push(next)
            engine.bindPlaylist({
              items,
              index: next,
              total,
              onIndexChange: () => undefined,
              onLoadMoreNearEnd: () => { loadMoreCount += 1 },
            })
          },
          onLoadMoreNearEnd: () => { loadMoreCount += 1 },
        })
      },
      onLoadMoreNearEnd: () => { loadMoreCount += 1 },
    })
  }

  it('plays multiple segments in one item then stops without autoNext', async () => {
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [{ en: 'Say hello', audioUrl: 'file://example.mp3' }]
    bind([word])

    const playPromise = engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // main → 1s gap → example (no trailing when not advancing)
    expect(fakeTransport.calls.playQueue[0].count).toBe(3)
    expect(fakeTransport.calls.playQueue[0].assetIds[0]).toBe('immersive:w1:main:0')
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    expect(fakeTransport.calls.playQueue[0].assetIds[2]).toBe('immersive:w1:example:0')
    expect(fakeTransport.calls.playQueue[0].fileUrls[0]).toBe('file://w1.mp3')
    expect(fakeTransport.calls.playQueue[0].fileUrls[1]).toContain('silence://')
    expect(fakeTransport.calls.playQueue[0].fileUrls[2]).toBe('file://example.mp3')
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    expect(fakeScheduler.pending()).toEqual([])
    fakeTransport.complete() // 1s gap
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    expect(engine.getState().gapActive).toBe(false)
    fakeTransport.complete() // example
    await playPromise

    // Queue done without loop → rewind to first item and arm paused (keep NP card).
    expect(engine.getState().status).toBe('paused')
    expect(engine.getState().absoluteIndex).toBe(0)
    expect(fakeTransport.calls.clearSession).toBe(0)
    expect(fakeTransport.calls.armQueue.length).toBeGreaterThan(0)
    expect(indexChanges).toEqual([0])
  })

  it('autoNext requests index change and continues after bind', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // main + trailing X gap before advance
    expect(fakeTransport.calls.playQueue[0].count).toBe(2)
    expect(fakeTransport.calls.playQueue[0].assetIds[0]).toBe('immersive:w1:main:0')
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    expect(fakeTransport.calls.playQueue[0].fileUrls[1]).toContain('silence://')
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // trailing gap
    await vi.waitFor(() => expect(indexChanges[0]).toBe(1))
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(2))
    fakeTransport.complete()
    await vi.waitFor(() => expect(engine.getState().status).toBe('paused'))
    expect(engine.getState().absoluteIndex).toBe(0)
    expect(indexChanges).toContain(0)
    expect(fakeTransport.calls.clearSession).toBe(0)
  })

  it('loopQueue wraps to 0 at end', async () => {
    settings.loopQueue = true
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items, 1)

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // trailing gap
    await vi.waitFor(() => expect(indexChanges).toContain(0))
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(2))
    expect(engine.getState().status).not.toBe('paused')
  })

  it('inserts silence gap for word→example when background (lock screen)', async () => {
    background = true
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [{ en: 'ex', audioUrl: 'file://ex.mp3' }]
    bind([word])

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(fakeTransport.calls.playQueue[0].count).toBe(3)
    expect(fakeTransport.calls.playQueue[0].fileUrls[0]).toBe('file://w1.mp3')
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    expect(fakeTransport.calls.playQueue[0].fileUrls[2]).toBe('file://ex.mp3')
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    expect(fakeScheduler.pending()).toEqual([])
    fakeTransport.complete() // gap
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    fakeTransport.complete() // example
  })

  it('inserts trailing X gap between words while background', async () => {
    background = true
    settings.autoNext = true
    const items = [item('w1', 'one'), item('w2', 'two'), item('w3', 'three')]
    bind(items)

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(fakeTransport.calls.playQueue[0].count).toBe(2)
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // trailing gap
    await vi.waitFor(() => expect(indexChanges[0]).toBe(1))
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(2))
    // Second word still needs gap before third — even while lock-screen background.
    expect(fakeTransport.calls.playQueue[1].count).toBe(2)
    expect(fakeTransport.calls.playQueue[1].assetIds[1]).toContain('immersive:gap:')
  })

  it('skips segments without audio when background (no TTS)', async () => {
    background = true
    settings.autoNext = false
    const word: ImmersivePlayerItem = {
      id: 'w1',
      kind: 'chunk',
      title: 'need tts',
    }
    bind([word])
    await engine.play()
    expect(fakeTransport.calls.playQueue).toEqual([])
    // No playable audio → still rewind to first and stay paused (no clearSession).
    expect(engine.getState().status).toBe('paused')
    expect(engine.getState().absoluteIndex).toBe(0)
  })

  it('expands repeatPerItem=2 into two plays of main', async () => {
    settings.repeatPerItem = 2
    settings.autoNext = false
    bind([item('w1', 'hello')])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // main0 → gap X → main1 (no trailing on last when not advancing)
    expect(fakeTransport.calls.playQueue[0].count).toBe(3)
    expect(fakeTransport.calls.playQueue[0].assetIds[0]).toBe('immersive:w1:main:0')
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    expect(fakeTransport.calls.playQueue[0].assetIds[2]).toBe('immersive:w1:main:1')
    expect(fakeTransport.calls.playQueue[0].fileUrls[2]).toBe('file://w1.mp3')
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // gap
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    fakeTransport.complete() // second main
    await vi.waitFor(() => expect(engine.getState().status).toBe('paused'))
    expect(engine.getState().absoluteIndex).toBe(0)
  })

  it('next cancels current play via generation', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    await engine.next(true)
    expect(indexChanges).toContain(1)
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBeGreaterThanOrEqual(2))
  })

  it('seek race: old complete does not advance stale generation', async () => {
    const items = [item('w1', 'one'), item('w2', 'two'), item('w3', 'three')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    const before = fakeTransport.calls.playQueue.length
    await engine.seekTo(2, true)
    fakeTransport.complete()
    await vi.waitFor(() => expect(indexChanges).toContain(2))
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBeGreaterThan(before))
    expect(engine.getState().absoluteIndex).toBe(2)
  })

  it('triggers onLoadMoreNearEnd near the end', async () => {
    const items = Array.from({ length: 6 }, (_, i) => item(`w${i}`, `t${i}`))
    bind(items, 4, 20)
    void engine.play()
    await vi.waitFor(() => expect(loadMoreCount).toBeGreaterThan(0))
    fakeTransport.complete()
  })

  it('sleep timer stops playback', async () => {
    vi.useFakeTimers()
    settings.sleepTimerMinutes = 15
    settings.autoNext = false
    bind([item('w1', 'hello')])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)
    await vi.waitFor(() => expect(engine.getState().status).toBe('ended'))
    vi.useRealTimers()
  })

  it('bindPlaylist is idempotent while playing same index', async () => {
    bind([item('w1', 'hello')])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    const plays = fakeTransport.calls.playQueue.length
    engine.bindPlaylist({
      items: [item('w1', 'hello')],
      index: 0,
      total: 1,
      onIndexChange: () => undefined,
    })
    expect(fakeTransport.calls.playQueue.length).toBe(plays)
    fakeTransport.complete()
  })

  it('pause on example segment then resume keeps locked snapshot', async () => {
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [
      { en: 'ex-a', audioUrl: 'file://ex-a.mp3' },
      { en: 'ex-b', audioUrl: 'file://ex-b.mp3' },
    ]
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    bind([word])

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // 1s gap before example
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    expect(engine.getState().currentSegment?.role).toBe('example')
    expect(engine.getState().currentSegment?.text).toBe('ex-a')
    const locked = engine.getItemSegmentSnapshot()
    expect(locked).toEqual(['w1:main:0', 'w1:example:0'])

    randomSpy.mockReturnValue(0.9)
    await engine.pause()
    const resolveBefore = fakeTransport.calls.resolve.length
    const ok = await engine.resume()
    expect(ok).toBe(true)
    expect(fakeTransport.calls.resume).toBe(1)
    expect(engine.getItemSegmentSnapshot()).toEqual(locked)
    expect(engine.getState().currentSegment?.text).toBe('ex-a')
    expect(fakeTransport.calls.resolve.length).toBe(resolveBefore)
    fakeTransport.complete()
    randomSpy.mockRestore()
  })

  it('resume failure soft-restarts current snapshot and ignores stale complete', async () => {
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [
      { en: 'ex-a', audioUrl: 'file://ex-a.mp3' },
      { en: 'ex-b', audioUrl: 'file://ex-b.mp3' },
    ]
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    bind([word])

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // 1s gap before example
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    const locked = engine.getItemSegmentSnapshot()
    expect(locked[1]).toBe('w1:example:0')
    expect(engine.getState().currentSegment?.text).toBe('ex-a')

    await engine.pause()
    fakeTransport.setResumeResult(false)
    randomSpy.mockReturnValue(0.9)
    const stopBefore = fakeTransport.calls.stop
    const playBefore = fakeTransport.calls.playQueue.length

    const resumePromise = engine.resume()
    await vi.waitFor(() => expect(fakeTransport.calls.stop).toBeGreaterThan(stopBefore))
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBeGreaterThan(playBefore))
    expect(engine.getItemSegmentSnapshot()).toEqual(locked)
    expect(engine.getState().currentSegment?.id).toBe('w1:example:0')
    expect(engine.getState().currentSegment?.text).toBe('ex-a')

    const playsAtSoftRestart = fakeTransport.calls.playQueue.length
    fakeTransport.complete()
    await resumePromise
    expect(engine.getItemSegmentSnapshot()).toEqual(locked)
    expect(fakeTransport.calls.playQueue.length).toBe(playsAtSoftRestart)
    randomSpy.mockRestore()
  })

  it('keeps locked segment ids for the same item after soft restart', async () => {
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [
      { en: 'alpha', audioUrl: 'file://alpha.mp3' },
      { en: 'beta', audioUrl: 'file://beta.mp3' },
    ]
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    bind([word])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    const firstSnapshot = engine.getItemSegmentSnapshot()
    expect(firstSnapshot).toEqual(['w1:main:0', 'w1:example:0'])
    expect(engine.getState().currentSegment?.text).toBe('hello')

    await engine.pause()
    fakeTransport.setResumeResult(false)
    randomSpy.mockReturnValue(0.99)
    void engine.resume()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBeGreaterThan(1))
    expect(engine.getItemSegmentSnapshot()).toEqual(firstSnapshot)
    fakeTransport.complete() // restart main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBeGreaterThan(0))
    // Skip silence gap between main and example if present.
    const ids = fakeTransport.calls.playQueue.at(-1)?.assetIds ?? []
    if (ids.some((id) => id.includes('immersive:gap:'))) {
      fakeTransport.complete()
      await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBeGreaterThan(1))
    }
    await vi.waitFor(() => expect(engine.getState().currentSegment?.role).toBe('example'))
    expect(engine.getState().currentSegment?.text).toBe('alpha')
    expect(ids.some((id) => id.includes('example'))).toBe(true)
    fakeTransport.complete()
    randomSpy.mockRestore()
  })

  it('advances with queueNext through content and silence gap tracks', async () => {
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [{ en: 'ex', audioUrl: 'file://ex.mp3' }]
    bind([word])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(fakeTransport.calls.playQueue[0].assetIds[0]).toBe('immersive:w1:main:0')
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    expect(fakeTransport.calls.playQueue[0].assetIds[2]).toBe('immersive:w1:example:0')
    expect(fakeTransport.calls.playQueue[0].fileUrls[0]).toBe('file://w1.mp3')
    expect(fakeTransport.calls.playQueue[0].fileUrls[1]).toContain('silence://')
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    expect(engine.getState().gapActive).toBe(true)
    expect(fakeScheduler.pending()).toEqual([])
    fakeTransport.complete() // gap
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    expect(engine.getState().gapActive).toBe(false)
    fakeTransport.complete() // example
  })

  it('falls back to timer gap when silence file is missing', async () => {
    await engine.dispose()
    engine = new ListeningQueueEngine({
      transport: fakeTransport.transport,
      getSettings: () => settings,
      scheduler: fakeScheduler.scheduler,
      isBackground: () => background,
      resolveSilenceUrl: async () => null,
    })
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [{ en: 'ex', audioUrl: 'file://ex.mp3' }]
    bind([word])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(fakeTransport.calls.playQueue[0].count).toBe(2)
    expect(fakeTransport.calls.playQueue[0].fileUrls[0]).toBe('file://w1.mp3')
    expect(fakeTransport.calls.playQueue[0].fileUrls[1]).toBe('file://ex.mp3')
    expect(fakeTransport.calls.playQueue[0].assetIds[0]).toBe('immersive:w1:main:0')
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toBe('immersive:w1:example:0')
    fakeTransport.complete()
    // word→example 1s — timer before queueNext when silence file missing
    await vi.waitFor(() => expect(fakeScheduler.pending().length).toBe(1))
    expect(fakeScheduler.pending()[0]).toBe(1000)
    fakeScheduler.flush()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete()
  })

  it('remoteNext at last window track seeks next learning item', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // Advance onto trailing gap (last native slot), then remoteNext at edge.
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.emit({
      type: 'playbackState',
      reason: 'remoteNext',
      assetId: 'immersive:gap:2s:r1:after:w1:main:0',
      state: 'playing',
    })
    await vi.waitFor(() => expect(indexChanges).toContain(1))
  })

  it('remotePrevious mid-example follows live index and does not fight with queueNext', async () => {
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [{ en: 'ex', audioUrl: 'file://ex.mp3' }]
    bind([word])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    const ids = fakeTransport.calls.playQueue[0].assetIds
    expect(ids[0]).toBe('immersive:w1:main:0')
    expect(ids[1]).toContain('immersive:gap:')
    expect(ids[2]).toBe('immersive:w1:example:0')

    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // gap
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    expect(engine.getState().currentSegment?.role).toBe('example')

    const queueNextBefore = fakeTransport.calls.queueNext
    // Native skip_gaps: example (2) → main (0), waiter stays open until new track ends.
    expect(fakeTransport.jumpTo(0, 'remotePrevious')).toBe(true)
    expect(fakeTransport.getQueueIndex()).toBe(0)
    expect(engine.getState().currentSegment?.role).toBe('main')

    fakeTransport.complete() // main finished after remote previous
    // Engine must resume the window from live index 0 (main→gap→example), not jump ahead.
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBeGreaterThan(queueNextBefore))
    expect(fakeTransport.getQueueIndex()).toBeGreaterThanOrEqual(0)
    expect(indexChanges).not.toContain(1) // did not cross to next learning item
    fakeTransport.complete() // gap
    await vi.waitFor(() => expect(engine.getState().currentSegment?.role).toBe('example'))
  })

  it('remotePrevious while windowLength is 0 does not seek previous learning item', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // Force empty window metadata (rebuild / advanceAfterItem race).
    ;(engine as unknown as { windowLength: number }).windowLength = 0
    const playCount = fakeTransport.calls.playQueue.length
    fakeTransport.emit({
      type: 'playbackState',
      reason: 'remotePrevious',
      assetId: 'immersive:gap:1s:r1:after:w1:main:0',
      state: 'playing',
    })
    await Promise.resolve()
    expect(fakeTransport.calls.playQueue.length).toBe(playCount)
    expect(indexChanges).not.toContain(0)
  })

  it('remotePause / remotePlay sync Engine state without double transport pause/resume', async () => {
    settings.autoNext = false
    bind([item('w1', 'hello')])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(engine.getState().status).toBe('playing')

    fakeTransport.emit({
      type: 'playbackState',
      reason: 'remotePause',
      assetId: 'immersive:w1:main:0',
      state: 'paused',
    })
    await vi.waitFor(() => expect(engine.getState().status).toBe('paused'))
    // Capgo remote handler already paused — Engine must not call transport.pause again.
    expect(fakeTransport.calls.pause).toBe(0)

    fakeTransport.emit({
      type: 'playbackState',
      reason: 'remotePlay',
      assetId: 'immersive:w1:main:0',
      state: 'playing',
    })
    await vi.waitFor(() => expect(engine.getState().status).toBe('playing'))
    // Capgo remote handler already resumed — Engine must not call transport.resume again.
    expect(fakeTransport.calls.resume).toBe(0)
    expect(fakeTransport.calls.playQueue.length).toBe(1)
    fakeTransport.complete()
  })

  it('armSession resolves first segment and arms paused queue', async () => {
    bind([item('w1', 'hello')])
    await engine.armSession()
    expect(fakeTransport.calls.armQueue.length).toBe(1)
    expect(fakeTransport.calls.armQueue[0].assetIds[0]).toContain('immersive:w1')
    expect(engine.getState().status).toBe('paused')
    expect(fakeTransport.calls.playQueue.length).toBe(0)
  })

  it('remotePlay while armed starts Engine play loop', async () => {
    settings.autoNext = false
    bind([item('w1', 'hello')])
    await engine.armSession()
    expect(fakeTransport.calls.armQueue.length).toBe(1)

    fakeTransport.emit({
      type: 'playbackState',
      reason: 'remotePlay',
      assetId: 'immersive:w1:main:0',
      state: 'playing',
    })
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(engine.getState().status).toBe('playing')
    fakeTransport.complete()
  })
})

describe('buildPlaybackSegments integration via engine settings', () => {
  it('does not play when playMainText is false and no example', async () => {
    const fakeTransport = createFakeTransport()
    const fakeScheduler = createFakeScheduler()
    const settings: ImmersivePlaybackSettings = {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      playMainText: false,
      playExample: false,
      autoNext: false,
    }
    const engine = new ListeningQueueEngine({
      transport: fakeTransport.transport,
      getSettings: () => settings,
      scheduler: fakeScheduler.scheduler,
      isBackground: () => false,
    })
    engine.bindPlaylist({
      items: [item('w1', 'hello')],
      index: 0,
      total: 1,
      onIndexChange: () => undefined,
    })
    await engine.play()
    expect(fakeTransport.calls.playQueue).toEqual([])
    expect(engine.getState().status).toBe('idle')
    await engine.dispose()
  })
})

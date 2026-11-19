import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImmersiveAudioTransport, ImmersiveNativeEvent, QueuePlayItem } from '../immersive-audio.transport'
import { ListeningQueueEngine, type QueueScheduler } from '../listening-queue.engine'
import { DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS } from '../immersive-player.store'
import type { ImmersivePlaybackSettings, ImmersivePlayerItem } from '../immersive-player.types'

const mediaSessionMock = vi.hoisted(() => ({
  ensureMediaSessionHandlers: vi.fn(async () => undefined),
  setMediaSessionMeta: vi.fn(async () => undefined),
  setMediaSessionPlaying: vi.fn(async () => undefined),
  setMediaSessionPaused: vi.fn(async () => undefined),
  clearMediaSession: vi.fn(async () => undefined),
  handlers: null as null | {
    play: () => void
    pause: () => void
    next: () => void
    prev: () => void
    seekTo: (seconds: number) => void
  },
}))

vi.mock('../immersive-media-session', () => ({
  ensureMediaSessionHandlers: vi.fn(async (handlers: typeof mediaSessionMock.handlers) => {
    mediaSessionMock.handlers = handlers
    return mediaSessionMock.ensureMediaSessionHandlers(handlers)
  }),
  setMediaSessionMeta: mediaSessionMock.setMediaSessionMeta,
  setMediaSessionPlaying: mediaSessionMock.setMediaSessionPlaying,
  setMediaSessionPaused: mediaSessionMock.setMediaSessionPaused,
  clearMediaSession: mediaSessionMock.clearMediaSession,
}))

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
    playQueue: [] as Array<{ count: number; startIndex: number; assetIds: string[] }>,
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
    async playQueue(items, options) {
      const startIndex = options?.startIndex ?? 0
      queue = items
      queueIndex = startIndex
      calls.playQueue.push({
        count: items.length,
        startIndex,
        assetIds: items.map((entry) => entry.assetId),
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
    mediaSessionMock.handlers = null
    mediaSessionMock.ensureMediaSessionHandlers.mockClear()
    mediaSessionMock.setMediaSessionMeta.mockClear()
    mediaSessionMock.setMediaSessionPlaying.mockClear()
    mediaSessionMock.setMediaSessionPaused.mockClear()
    mediaSessionMock.clearMediaSession.mockClear()
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
      // Deterministic silence tracks — exercises official-queue gap path (not timer fallback).
      resolveSilenceUrl: async (seconds) => `silence://gap-${seconds}s.wav`,
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
    // main + silence gap + example (no trailing gap when not advancing)
    expect(fakeTransport.calls.playQueue[0].count).toBe(3)
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    expect(fakeScheduler.pending()).toEqual([])
    expect(engine.getState().gapActive).toBe(true)
    fakeTransport.complete() // silence
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    fakeTransport.complete() // example
    await playPromise

    expect(engine.getState().status).toBe('ended')
    expect(indexChanges).toEqual([])
  })

  it('autoNext requests index change and continues after bind', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // single main + trailing silence before advance
    expect(fakeTransport.calls.playQueue[0].count).toBe(2)
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // trailing silence
    await vi.waitFor(() => expect(indexChanges[0]).toBe(1))
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(2))
    fakeTransport.complete()
    await vi.waitFor(() => expect(engine.getState().status).toBe('ended'))
  })

  it('loopQueue wraps to 0 at end', async () => {
    settings.loopQueue = true
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items, 1)

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    fakeTransport.complete() // main
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // trailing silence
    await vi.waitFor(() => expect(indexChanges).toContain(0))
  })

  it('uses zero gap when background', async () => {
    background = true
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [{ en: 'ex', audioUrl: 'file://ex.mp3' }]
    bind([word])

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(fakeTransport.calls.playQueue[0].count).toBe(2)
    expect(fakeTransport.calls.playQueue[0].assetIds.every((id) => !id.includes(':gap:'))).toBe(true)
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    expect(fakeScheduler.pending()).toEqual([])
    fakeTransport.complete()
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
    expect(engine.getState().status).toBe('ended')
  })

  it('expands repeatPerItem=2 into two plays of main', async () => {
    settings.repeatPerItem = 2
    settings.autoNext = false
    bind([item('w1', 'hello')])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // two mains with silence between (no trailing — not advancing / not infinite)
    expect(fakeTransport.calls.playQueue[0].count).toBe(3)
    expect(fakeTransport.calls.playQueue[0].assetIds[1]).toContain('immersive:gap:')
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete() // silence
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    fakeTransport.complete() // second main
    await vi.waitFor(() => expect(engine.getState().status).toBe('ended'))
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
    fakeTransport.complete() // silence gap
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
    fakeTransport.complete() // silence
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
    fakeTransport.complete() // silence after main
    await vi.waitFor(() => expect(engine.getState().currentSegment?.role).toBe('example'))
    expect(engine.getState().currentSegment?.text).toBe('alpha')
    expect(fakeTransport.calls.playQueue.at(-1)?.assetIds.some((id) => id.includes('example'))).toBe(true)
    fakeTransport.complete()
    randomSpy.mockRestore()
  })

  it('advances with queueNext through silence gap tracks', async () => {
    settings.autoNext = false
    settings.playExample = true
    const word = item('w1', 'hello')
    word.examples = [{ en: 'ex', audioUrl: 'file://ex.mp3' }]
    bind([word])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    expect(fakeTransport.calls.playQueue[0].assetIds).toEqual([
      'immersive:w1:main:0',
      'immersive:gap:2s:after:w1:main:0',
      'immersive:w1:example:0',
    ])
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    expect(engine.getState().gapActive).toBe(true)
    expect(fakeScheduler.pending()).toEqual([])
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(2))
    expect(engine.getState().gapActive).toBe(false)
    fakeTransport.complete()
  })

  it('falls back to timer gap when silence URL is unavailable', async () => {
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
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeScheduler.pending().length).toBe(1))
    fakeScheduler.flush()
    await vi.waitFor(() => expect(fakeTransport.calls.queueNext).toBe(1))
    fakeTransport.complete()
  })

  it('remoteNext at last window track seeks next learning item', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    // Window is [main, trailing silence]. Move to last slot then remoteNext again.
    fakeTransport.emit({
      type: 'queueChange',
      reason: 'remoteNext',
      assetId: 'immersive:gap:2s:after:w1:main:0',
      index: 1,
    })
    fakeTransport.emit({
      type: 'queueChange',
      reason: 'remoteNext',
      assetId: 'immersive:gap:2s:after:w1:main:0',
      index: 1,
    })
    await vi.waitFor(() => expect(indexChanges).toContain(1))
  })

  it('remotePause / remotePlay only sync state and do not call transport pause/resume', async () => {
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
    expect(engine.getState().status).toBe('paused')
    expect(fakeTransport.calls.resume).toBe(0)
    // transport.pause must not be invoked — native already paused
    expect(fakeTransport.calls.stop).toBe(0)

    const pauseSpy = vi.spyOn(fakeTransport.transport, 'pause')
    const resumeSpy = vi.spyOn(fakeTransport.transport, 'resume')
    fakeTransport.emit({
      type: 'playbackState',
      reason: 'remotePause',
      assetId: 'immersive:w1:main:0',
      state: 'paused',
    })
    expect(pauseSpy).not.toHaveBeenCalled()

    fakeTransport.emit({
      type: 'playbackState',
      reason: 'remotePlay',
      assetId: 'immersive:w1:main:0',
      state: 'playing',
    })
    expect(engine.getState().status).toBe('playing')
    expect(resumeSpy).not.toHaveBeenCalled()
    expect(fakeTransport.calls.playQueue.length).toBe(1)
    pauseSpy.mockRestore()
    resumeSpy.mockRestore()
    fakeTransport.complete()
  })

  it('MediaSession handlers drive pause/resume/next/prev/seekTo', async () => {
    settings.autoNext = false
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playQueue.length).toBe(1))
    await vi.waitFor(() => expect(mediaSessionMock.handlers).toBeTruthy())

    mediaSessionMock.handlers!.pause()
    await vi.waitFor(() => expect(fakeTransport.calls.pause).toBe(1))
    expect(engine.getState().status).toBe('paused')

    mediaSessionMock.handlers!.play()
    await vi.waitFor(() => expect(fakeTransport.calls.resume).toBe(1))
    expect(engine.getState().status).toBe('playing')

    mediaSessionMock.handlers!.seekTo(1.5)
    await vi.waitFor(() => expect(fakeTransport.calls.seekTo).toEqual([1.5]))

    mediaSessionMock.handlers!.next()
    await vi.waitFor(() => expect(indexChanges).toContain(1))
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

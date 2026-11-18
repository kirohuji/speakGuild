import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImmersiveAudioTransport, TransportSlot } from '../immersive-audio.transport'
import { ListeningQueueEngine, type QueueScheduler } from '../listening-queue.engine'
import { DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS } from '../immersive-player.store'
import type { ImmersivePlaybackSettings, ImmersivePlayerItem, PlaybackSegment } from '../immersive-player.types'

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

function createFakeTransport() {
  const prepared = new Map<TransportSlot, string>()
  const playResolvers = new Map<TransportSlot, () => void>()
  const calls = {
    resolve: [] as string[],
    prepare: [] as Array<{ slot: TransportSlot; url: string }>,
    playSlot: [] as TransportSlot[],
    stop: 0,
    loadMore: 0,
  }
  let allowTtsDefault = true
  const transport: ImmersiveAudioTransport = {
    otherSlot: (slot) => (slot === 'a' ? 'b' : 'a'),
    async resolve(segment, options) {
      calls.resolve.push(segment.id)
      if (!segment.audioUrl?.trim()) {
        if (options?.allowTts === false || !allowTtsDefault) return null
        return `tts://${segment.id}`
      }
      return segment.audioUrl
    },
    async prepare(slot, fileUrl) {
      calls.prepare.push({ slot, url: fileUrl })
      prepared.set(slot, fileUrl)
    },
    async playSlot(slot) {
      calls.playSlot.push(slot)
      if (!prepared.has(slot)) throw new Error(`not prepared ${slot}`)
      await new Promise<void>((resolve) => {
        playResolvers.set(slot, resolve)
      })
      prepared.delete(slot)
    },
    async pause() {},
    async resume() { return true },
    async stop() {
      calls.stop += 1
      for (const [slot, resolve] of playResolvers) {
        playResolvers.delete(slot)
        resolve()
      }
    },
    async setRate() {},
    hasResumableAsset: () => playResolvers.size > 0,
    async setMediaMetadata() {},
    async registerMediaActions() {},
    async setIosGapTrackControls() {},
    setNativeStateHandler() {},
    clearResolveCache() {},
    async clearSession() {},
    subscribeVisualState() { return () => undefined },
  }
  return {
    transport,
    calls,
    setAllowTts(value: boolean) { allowTtsDefault = value },
    complete(slot?: TransportSlot) {
      if (slot) {
        const resolve = playResolvers.get(slot)
        if (!resolve) return false
        playResolvers.delete(slot)
        resolve()
        return true
      }
      const first = playResolvers.keys().next().value as TransportSlot | undefined
      if (!first) return false
      return this.complete(first)
    },
    playingSlots() {
      return [...playResolvers.keys()]
    },
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
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeScheduler.pending().length).toBe(1))
    fakeScheduler.flush()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(2))
    fakeTransport.complete()
    await playPromise

    expect(engine.getState().status).toBe('ended')
    expect(indexChanges).toEqual([])
  })

  it('autoNext requests index change and continues after bind', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    fakeTransport.complete()
    // gap before advance
    await vi.waitFor(() => expect(fakeScheduler.pending().length).toBe(1))
    fakeScheduler.flush()
    await vi.waitFor(() => expect(indexChanges[0]).toBe(1))
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(2))
    fakeTransport.complete()
    await vi.waitFor(() => expect(engine.getState().status).toBe('ended'))
  })

  it('loopQueue wraps to 0 at end', async () => {
    settings.loopQueue = true
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items, 1)

    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeScheduler.pending().length).toBe(1))
    fakeScheduler.flush()
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
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(2))
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
      // no audio urls → resolve returns null in background
    }
    bind([word])
    await engine.play()
    expect(fakeTransport.calls.playSlot).toEqual([])
    expect(engine.getState().status).toBe('ended')
  })

  it('expands repeatPerItem=2 into two plays of main', async () => {
    settings.repeatPerItem = 2
    settings.autoNext = false
    bind([item('w1', 'hello')])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    fakeTransport.complete()
    await vi.waitFor(() => expect(fakeScheduler.pending().length).toBe(1))
    fakeScheduler.flush()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(2))
    fakeTransport.complete()
    await vi.waitFor(() => expect(engine.getState().status).toBe('ended'))
  })

  it('next cancels current play via generation', async () => {
    const items = [item('w1', 'one'), item('w2', 'two')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    await engine.next(true)
    expect(indexChanges).toContain(1)
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBeGreaterThanOrEqual(2))
  })

  it('seek race: old complete does not advance stale generation', async () => {
    const items = [item('w1', 'one'), item('w2', 'two'), item('w3', 'three')]
    bind(items)
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    const before = fakeTransport.calls.playSlot.length
    await engine.seekTo(2, true)
    // Completing the cancelled slot should not schedule extra plays beyond the seek target.
    fakeTransport.complete('a')
    fakeTransport.complete('b')
    await vi.waitFor(() => expect(indexChanges).toContain(2))
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBeGreaterThan(before))
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
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)
    await vi.waitFor(() => expect(engine.getState().status).toBe('ended'))
    vi.useRealTimers()
  })

  it('bindPlaylist is idempotent while playing same index', async () => {
    bind([item('w1', 'hello')])
    void engine.play()
    await vi.waitFor(() => expect(fakeTransport.calls.playSlot.length).toBe(1))
    const plays = fakeTransport.calls.playSlot.length
    engine.bindPlaylist({
      items: [item('w1', 'hello')],
      index: 0,
      total: 1,
      onIndexChange: () => undefined,
    })
    expect(fakeTransport.calls.playSlot.length).toBe(plays)
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
    expect(fakeTransport.calls.playSlot).toEqual([])
    expect(engine.getState().status).toBe('idle')
    await engine.dispose()
  })
})

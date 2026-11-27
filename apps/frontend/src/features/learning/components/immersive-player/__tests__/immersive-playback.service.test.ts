import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeListeners = new Map<string, Set<(payload: unknown) => void>>()

const { LOGO_FILE_URI, fsMock } = vi.hoisted(() => {
  const LOGO_FILE_URI = 'file:///var/mobile/Library/Caches/immersive/app-logo.png'
  return {
    LOGO_FILE_URI,
    fsMock: {
      stat: vi.fn(async () => ({ type: 'file', size: 12, ctime: 0, mtime: 0, uri: LOGO_FILE_URI })),
      getUri: vi.fn(async () => ({ uri: LOGO_FILE_URI })),
      writeFile: vi.fn(async () => ({ uri: LOGO_FILE_URI })),
    },
  }
})

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: fsMock,
}))

vi.mock('@capgo/capacitor-native-audio', () => {
  const NativeAudio = {
    configure: vi.fn(async () => undefined),
    setQueue: vi.fn(async (options: { items: Array<{ assetId: string }>; startIndex?: number }) => ({
      assetId: options.items[options.startIndex ?? 0]?.assetId ?? '',
      index: options.startIndex ?? 0,
      count: options.items.length,
      assetIds: options.items.map((item) => item.assetId),
    })),
    clearQueue: vi.fn(async () => undefined),
    queueNext: vi.fn(async () => ({ assetId: 'immersive:next', index: 1, count: 2, assetIds: ['a', 'b'] })),
    queuePrevious: vi.fn(async () => ({ assetId: 'immersive:prev', index: 0, count: 2, assetIds: ['a', 'b'] })),
    play: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    unload: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    setRate: vi.fn(async () => undefined),
    setCurrentTime: vi.fn(async () => undefined),
    getCurrentTime: vi.fn(async () => ({ currentTime: 1.25 })),
    getDuration: vi.fn(async () => ({ duration: 4 })),
    addListener: vi.fn(async (event: string, handler: (payload: unknown) => void) => {
      if (!nativeListeners.has(event)) nativeListeners.set(event, new Set())
      nativeListeners.get(event)!.add(handler)
      return {
        remove: async () => {
          nativeListeners.get(event)?.delete(handler)
        },
      }
    }),
  }
  return { NativeAudio }
})

vi.mock('@/lib/native', () => ({
  isNative: () => true,
  isIOS: () => true,
}))

vi.mock('@/lib/offline/playback-audio', () => ({
  resolvePlaybackAudio: vi.fn(async ({ url }: { url: string }) => `file://resolved/${url}`),
}))

vi.mock('@/lib/offline/audio-playback-diag', () => ({
  audioDiag: () => undefined,
}))

vi.mock('@/lib/tts-api', () => ({
  synthesizeAsset: vi.fn(async () => ({ url: 'https://tts.test/x.mp3', assetId: 'tts-1' })),
}))

vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual<typeof import('@capacitor/core')>('@capacitor/core')
  return {
    ...actual,
    Capacitor: {
      getPlatform: () => 'ios',
      isNativePlatform: () => true,
    },
  }
})

vi.mock('../immersive-audio.transport', async () => {
  const actual = await vi.importActual<typeof import('../immersive-audio.transport')>('../immersive-audio.transport')
  return {
    ...actual,
    resolveAppLogoArtworkUri: vi.fn(async () => LOGO_FILE_URI),
  }
})

const { NativeAudio } = await import('@capgo/capacitor-native-audio')
const { resolvePlaybackAudio } = await import('@/lib/offline/playback-audio')
const { resetAppLogoArtworkCache } = await import('../immersive-audio.transport')
const { immersivePlaybackService, resetImmersiveArtworkCacheForTests } = await import('../immersive-playback.service')

function emit(event: string, payload: unknown) {
  for (const handler of nativeListeners.get(event) ?? []) {
    handler(payload)
  }
}

describe('immersivePlaybackService setQueue transport', () => {
  beforeEach(async () => {
    nativeListeners.clear()
    vi.mocked(NativeAudio.configure).mockClear()
    vi.mocked(NativeAudio.setQueue).mockClear()
    vi.mocked(NativeAudio.clearQueue).mockClear()
    vi.mocked(NativeAudio.queueNext).mockClear()
    vi.mocked(NativeAudio.queuePrevious).mockClear()
    vi.mocked(NativeAudio.pause).mockClear()
    vi.mocked(NativeAudio.resume).mockClear()
    vi.mocked(NativeAudio.stop).mockClear()
    vi.mocked(NativeAudio.setRate).mockClear()
    vi.mocked(NativeAudio.setCurrentTime).mockClear()
    vi.mocked(NativeAudio.addListener).mockClear()
    vi.mocked(resolvePlaybackAudio).mockClear()
    fsMock.stat.mockClear()
    fsMock.getUri.mockClear()
    fsMock.writeFile.mockClear()
    fsMock.stat.mockResolvedValue({ type: 'file', size: 12, ctime: 0, mtime: 0, uri: LOGO_FILE_URI })
    fsMock.getUri.mockResolvedValue({ uri: LOGO_FILE_URI })
    resetAppLogoArtworkCache()
    resetImmersiveArtworkCacheForTests()
    await immersivePlaybackService.stop({ clearSession: true })
    immersivePlaybackService.clearResolveCache()
    // stop() itself clears the native queue — ignore that for per-test assertions.
    vi.mocked(NativeAudio.clearQueue).mockClear()
    vi.mocked(NativeAudio.configure).mockClear()
    vi.mocked(NativeAudio.setQueue).mockClear()
  })

  it('resolves as file:// and plays via setQueue with notificationMetadata', async () => {
    const segment = {
      id: 'seg-1',
      itemId: 'item-1',
      role: 'main' as const,
      text: 'hello',
      lang: 'en' as const,
      audioUrl: 'https://cdn.test/a.mp3',
      title: 'hello',
    }

    const url = await immersivePlaybackService.resolve(segment)
    expect(resolvePlaybackAudio).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://cdn.test/a.mp3',
      asFileUri: true,
    }))
    expect(url).toBe('file://resolved/https://cdn.test/a.mp3')

    const playPromise = immersivePlaybackService.playQueue([
      {
        assetId: 'immersive:seg-1',
        fileUrl: url!,
        title: 'hello',
        artist: '漫语町',
        album: '听力',
        segmentId: 'seg-1',
      },
    ], { startIndex: 0, playbackRate: 1 })

    await vi.waitFor(() => {
      expect(NativeAudio.setQueue).toHaveBeenCalledWith(expect.objectContaining({
        startIndex: 0,
        autoPlay: true,
        items: [expect.objectContaining({
          assetId: 'immersive:seg-1',
          assetPath: url,
          isUrl: true,
          notificationMetadata: expect.objectContaining({
            title: 'hello',
            artist: '漫语町',
            album: '听力',
            artworkUrl: LOGO_FILE_URI,
          }),
        })],
      }))
    })
    expect(NativeAudio.configure).toHaveBeenCalledWith(expect.objectContaining({
      showNotification: true,
    }))
    // R5: playQueue must not clearQueue before setQueue (avoids blank Now Playing).
    expect(NativeAudio.clearQueue).not.toHaveBeenCalled()

    emit('complete', { assetId: 'immersive:seg-1' })
    await playPromise
  })

  it('armQueue uses autoPlay false and notificationMetadata', async () => {
    await immersivePlaybackService.armQueue([
      {
        assetId: 'immersive:a',
        fileUrl: 'file://a.mp3',
        title: 'a',
        artist: 'app',
        album: 'album',
        segmentId: 'a',
      },
    ])
    expect(NativeAudio.setQueue).toHaveBeenCalledWith(expect.objectContaining({
      autoPlay: false,
      items: [expect.objectContaining({
        notificationMetadata: expect.objectContaining({
          title: 'a',
          artworkUrl: LOGO_FILE_URI,
        }),
      })],
    }))
  })

  it('stop invalidates in-flight playQueue and clearQueue', async () => {
    const playPromise = immersivePlaybackService.playQueue([
      {
        assetId: 'immersive:a',
        fileUrl: 'file://a.mp3',
        title: 'a',
        segmentId: 'a',
      },
    ])
    await vi.waitFor(() => expect(NativeAudio.setQueue).toHaveBeenCalled())
    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
    expect(NativeAudio.clearQueue).toHaveBeenCalled()
  })

  it('queueNext waits for the next track complete', async () => {
    const playPromise = immersivePlaybackService.playQueue([
      { assetId: 'immersive:a', fileUrl: 'file://a.mp3', title: 'a', segmentId: 'a' },
      { assetId: 'immersive:b', fileUrl: 'file://b.mp3', title: 'b', segmentId: 'b' },
    ])
    await vi.waitFor(() => expect(NativeAudio.setQueue).toHaveBeenCalled())
    emit('complete', { assetId: 'immersive:a' })
    await playPromise

    vi.mocked(NativeAudio.queueNext).mockResolvedValueOnce({
      assetId: 'immersive:b',
      index: 1,
      count: 2,
      assetIds: ['immersive:a', 'immersive:b'],
    })

    const nextPromise = immersivePlaybackService.queueNext()
    await vi.waitFor(() => expect(NativeAudio.queueNext).toHaveBeenCalled())
    emit('complete', { assetId: 'immersive:b' })
    await expect(nextPromise).resolves.toBe(true)
  })

  it('pause and resume use NativeAudio asset id', async () => {
    const playPromise = immersivePlaybackService.playQueue([
      { assetId: 'immersive:a', fileUrl: 'file://a.mp3', title: 'a', segmentId: 'a' },
    ])
    await vi.waitFor(() => expect(NativeAudio.setQueue).toHaveBeenCalled())
    await immersivePlaybackService.pause()
    expect(NativeAudio.pause).toHaveBeenCalledWith({ assetId: 'immersive:a' })
    const ok = await immersivePlaybackService.resume()
    expect(ok).toBe(true)
    expect(NativeAudio.resume).toHaveBeenCalledWith({ assetId: 'immersive:a' })
    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
    expect(NativeAudio.clearQueue).toHaveBeenCalled()
  })

  it('progress does not write Now Playing; seekTo sets current time', async () => {
    const playPromise = immersivePlaybackService.playQueue([
      { assetId: 'immersive:a', fileUrl: 'file://a.mp3', title: 'a', segmentId: 'a' },
    ])
    await vi.waitFor(() => expect(NativeAudio.setQueue).toHaveBeenCalled())

    emit('progress', { assetId: 'immersive:a', position: 1.25, duration: 4 })
    // Allow microtasks; MediaSession path is gone — progress is JS/UI only.
    await Promise.resolve()

    await immersivePlaybackService.seekTo(2.5)
    expect(NativeAudio.setCurrentTime).toHaveBeenCalledWith({ assetId: 'immersive:a', time: 2.5 })

    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
  })

  it('forwards playQueue playbackRate to NativeAudio.setRate', async () => {
    const playPromise = immersivePlaybackService.playQueue([
      { assetId: 'immersive:a', fileUrl: 'file://a.mp3', title: 'a', segmentId: 'a' },
    ], { playbackRate: 1.5 })
    await vi.waitFor(() => expect(NativeAudio.setRate).toHaveBeenCalledWith({
      assetId: 'immersive:a',
      rate: 1.5,
    }))
    emit('complete', { assetId: 'immersive:a' })
    await playPromise
  })

  it('rebinds track waiter on remote queueChange', async () => {
    const playPromise = immersivePlaybackService.playQueue([
      { assetId: 'immersive:a', fileUrl: 'file://a.mp3', title: 'a', segmentId: 'a' },
      { assetId: 'immersive:b', fileUrl: 'file://b.mp3', title: 'b', segmentId: 'b' },
    ])
    await vi.waitFor(() => expect(NativeAudio.setQueue).toHaveBeenCalled())

    emit('queueChange', {
      assetId: 'immersive:b',
      index: 1,
      reason: 'remoteNext',
    })
    emit('complete', { assetId: 'immersive:b' })
    await playPromise
    expect(immersivePlaybackService.getQueueIndex()).toBe(1)
  })
})

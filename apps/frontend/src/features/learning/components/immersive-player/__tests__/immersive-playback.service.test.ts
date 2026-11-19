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

const mediaSessionApi = vi.hoisted(() => ({
  setMediaSessionPosition: vi.fn(async () => undefined),
  setMediaSessionPlaying: vi.fn(async () => undefined),
  setMediaSessionPaused: vi.fn(async () => undefined),
  clearMediaSession: vi.fn(async () => undefined),
}))

vi.mock('../immersive-media-session', () => mediaSessionApi)

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

const { NativeAudio } = await import('@capgo/capacitor-native-audio')
const { resolvePlaybackAudio } = await import('@/lib/offline/playback-audio')
const { resetAppLogoArtworkCache } = await import('../immersive-audio.transport')
const { immersivePlaybackService } = await import('../immersive-playback.service')

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
    mediaSessionApi.setMediaSessionPosition.mockClear()
    mediaSessionApi.setMediaSessionPlaying.mockClear()
    mediaSessionApi.setMediaSessionPaused.mockClear()
    mediaSessionApi.clearMediaSession.mockClear()
    fsMock.stat.mockClear()
    fsMock.getUri.mockClear()
    fsMock.writeFile.mockClear()
    fsMock.stat.mockResolvedValue({ type: 'file', size: 12, ctime: 0, mtime: 0, uri: LOGO_FILE_URI })
    fsMock.getUri.mockResolvedValue({ uri: LOGO_FILE_URI })
    resetAppLogoArtworkCache()
    await immersivePlaybackService.stop({ clearSession: true })
    immersivePlaybackService.clearResolveCache()
  })

  it('resolves as file:// and plays via setQueue', async () => {
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
        })],
      }))
    })
    const queued = vi.mocked(NativeAudio.setQueue).mock.calls[0]?.[0]
    expect(queued?.items[0]).not.toHaveProperty('notificationMetadata')
    expect(NativeAudio.configure).toHaveBeenCalledWith(expect.objectContaining({
      showNotification: false,
    }))

    emit('complete', { assetId: 'immersive:seg-1' })
    await playPromise
  })

  it('stop invalidates in-flight playQueue', async () => {
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
    expect(mediaSessionApi.setMediaSessionPaused).toHaveBeenCalled()
    const ok = await immersivePlaybackService.resume()
    expect(ok).toBe(true)
    expect(NativeAudio.resume).toHaveBeenCalledWith({ assetId: 'immersive:a' })
    expect(mediaSessionApi.setMediaSessionPlaying).toHaveBeenCalled()
    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
    expect(mediaSessionApi.clearMediaSession).toHaveBeenCalled()
  })

  it('progress updates MediaSession position and seekTo sets current time', async () => {
    const playPromise = immersivePlaybackService.playQueue([
      { assetId: 'immersive:a', fileUrl: 'file://a.mp3', title: 'a', segmentId: 'a' },
    ])
    await vi.waitFor(() => expect(NativeAudio.setQueue).toHaveBeenCalled())
    mediaSessionApi.setMediaSessionPosition.mockClear()

    emit('progress', { assetId: 'immersive:a', position: 1.25, duration: 4 })
    await vi.waitFor(() => {
      expect(mediaSessionApi.setMediaSessionPosition).toHaveBeenCalledWith({
        position: 1.25,
        duration: 4,
        playbackRate: 1,
      })
    })

    await immersivePlaybackService.seekTo(2.5)
    expect(NativeAudio.setCurrentTime).toHaveBeenCalledWith({ assetId: 'immersive:a', time: 2.5 })
    expect(mediaSessionApi.setMediaSessionPosition).toHaveBeenCalledWith({
      position: 2.5,
      duration: 4,
      playbackRate: 1,
    })

    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
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

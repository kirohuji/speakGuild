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
    preload: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    unload: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    setRate: vi.fn(async () => undefined),
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

vi.mock('@capgo/capacitor-media-session', () => ({
  MediaSession: {
    setMetadata: vi.fn(async () => undefined),
    setPlaybackState: vi.fn(async () => undefined),
    setPositionState: vi.fn(async () => undefined),
    setActionHandler: vi.fn(async () => undefined),
  },
}))

vi.mock('@/lib/native', () => ({
  isNative: () => true,
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
const { MediaSession } = await import('@capgo/capacitor-media-session')
const { resolvePlaybackAudio } = await import('@/lib/offline/playback-audio')
const { resetAppLogoArtworkCache } = await import('../immersive-audio.transport')
const { immersivePlaybackService } = await import('../immersive-playback.service')

describe('immersivePlaybackService dual-buffer transport', () => {
  beforeEach(async () => {
    nativeListeners.clear()
    vi.clearAllMocks()
    resetAppLogoArtworkCache()
    await immersivePlaybackService.stop({ clearSession: true })
    immersivePlaybackService.clearResolveCache()
  })

  it('preloads both slots and settles playSlot on matching complete', async () => {
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

    await immersivePlaybackService.prepare('a', url!, { title: 'hello' })
    expect(NativeAudio.preload).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'immersive-a',
      assetPath: url,
      isUrl: true,
    }))

    await immersivePlaybackService.prepare('b', 'file://next.mp3', { title: 'next' })
    expect(NativeAudio.preload).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'immersive-b',
    }))

    const playPromise = immersivePlaybackService.playSlot('a', 1)
    await vi.waitFor(() => {
      expect(NativeAudio.play).toHaveBeenCalledWith(expect.objectContaining({
        assetId: 'immersive-a',
      }))
    })

    const completeHandlers = [...(nativeListeners.get('complete') ?? [])]
    for (const handler of completeHandlers) {
      handler({ assetId: 'immersive-b' })
    }
    let settled = false
    playPromise.then(() => { settled = true }).catch(() => undefined)
    await Promise.resolve()
    expect(settled).toBe(false)

    for (const handler of completeHandlers) {
      handler({ assetId: 'immersive-a' })
    }
    await playPromise
    expect(settled).toBe(true)
  })

  it('stop invalidates in-flight playSlot', async () => {
    await immersivePlaybackService.prepare('a', 'file://a.mp3', { title: 'a' })
    expect(NativeAudio.preload).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'immersive-a',
      assetPath: 'file://a.mp3',
    }))
    const playPromise = immersivePlaybackService.playSlot('a', 1)
    await vi.waitFor(() => expect(NativeAudio.play).toHaveBeenCalled())
    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
  })

  it('pause seeds position before flipping playbackState', async () => {
    await immersivePlaybackService.prepare('a', 'file://a.mp3', { title: 'a' })
    const playPromise = immersivePlaybackService.playSlot('a', 1)
    await vi.waitFor(() => expect(NativeAudio.play).toHaveBeenCalled())
    vi.mocked(MediaSession.setPositionState).mockClear()
    vi.mocked(MediaSession.setPlaybackState).mockClear()

    await immersivePlaybackService.pause()

    const positionOrder = vi.mocked(MediaSession.setPositionState).mock.invocationCallOrder[0]
    const stateOrder = vi.mocked(MediaSession.setPlaybackState).mock.invocationCallOrder[0]
    expect(positionOrder).toBeLessThan(stateOrder)
    expect(MediaSession.setPlaybackState).toHaveBeenCalledWith({ playbackState: 'paused' })
    expect(MediaSession.setPositionState).toHaveBeenCalledWith(expect.objectContaining({
      duration: 4,
      position: 1.25,
      playbackRate: 0,
    }))
    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
  })

  it('resume seeds position before flipping playbackState to playing', async () => {
    await immersivePlaybackService.prepare('a', 'file://a.mp3', { title: 'a' })
    const playPromise = immersivePlaybackService.playSlot('a', 1)
    await vi.waitFor(() => expect(NativeAudio.play).toHaveBeenCalled())
    await immersivePlaybackService.pause()
    vi.mocked(MediaSession.setPositionState).mockClear()
    vi.mocked(MediaSession.setPlaybackState).mockClear()

    const ok = await immersivePlaybackService.resume()
    expect(ok).toBe(true)
    const positionOrder = vi.mocked(MediaSession.setPositionState).mock.invocationCallOrder[0]
    const stateOrder = vi.mocked(MediaSession.setPlaybackState).mock.invocationCallOrder[0]
    expect(positionOrder).toBeLessThan(stateOrder)
    expect(MediaSession.setPositionState).toHaveBeenCalledWith(expect.objectContaining({
      duration: 4,
      position: 1.25,
      playbackRate: 1,
    }))
    expect(MediaSession.setPlaybackState).toHaveBeenCalledWith({ playbackState: 'playing' })

    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
  })

  it('setMediaMetadata uses file:// logo artwork for iOS loaders', async () => {
    const segment = {
      id: 'seg-1',
      itemId: 'item-1',
      role: 'main' as const,
      text: 'hello',
      lang: 'en' as const,
      audioUrl: 'https://cdn.test/a.mp3',
      title: 'hello',
      subtitle: 'word',
    }
    await immersivePlaybackService.setMediaMetadata(segment, 1, 'playing')
    expect(MediaSession.setMetadata).toHaveBeenCalledWith(expect.objectContaining({
      title: 'hello',
      artist: 'word',
      artwork: [expect.objectContaining({
        src: LOGO_FILE_URI,
        sizes: '512x512',
        type: 'image/png',
      })],
    }))
  })

  it('preload notificationMetadata uses file:// artworkUrl', async () => {
    await immersivePlaybackService.prepare('a', 'file://a.mp3', { title: 'hello', artist: 'ManYuDing' })
    expect(NativeAudio.preload).toHaveBeenCalledWith(expect.objectContaining({
      notificationMetadata: expect.objectContaining({
        title: 'hello',
        artworkUrl: LOGO_FILE_URI,
      }),
    }))
  })

  it('holdPositionForGap keeps last duration at end position', async () => {
    await immersivePlaybackService.prepare('a', 'file://a.mp3', { title: 'a' })
    const playPromise = immersivePlaybackService.playSlot('a', 1)
    await vi.waitFor(() => expect(NativeAudio.play).toHaveBeenCalled())
    await immersivePlaybackService.holdPositionForGap()
    expect(MediaSession.setPlaybackState).toHaveBeenCalledWith({ playbackState: 'paused' })
    expect(MediaSession.setPositionState).toHaveBeenCalledWith(expect.objectContaining({
      duration: 4,
      position: 4,
    }))
    await immersivePlaybackService.stop({ clearSession: true })
    await expect(playPromise).resolves.toBeUndefined()
  })
})

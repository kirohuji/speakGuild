import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeListeners = new Map<string, Set<(payload: unknown) => void>>()

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
const { resolvePlaybackAudio } = await import('@/lib/offline/playback-audio')
const { immersivePlaybackService } = await import('../immersive-playback.service')

describe('immersivePlaybackService dual-buffer transport', () => {
  beforeEach(async () => {
    nativeListeners.clear()
    vi.clearAllMocks()
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
})

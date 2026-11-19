import { beforeEach, describe, expect, it, vi } from 'vitest'

const MediaSession = vi.hoisted(() => ({
  setMetadata: vi.fn(async () => undefined),
  setPlaybackState: vi.fn(async () => undefined),
  setPositionState: vi.fn(async () => undefined),
  setActionHandler: vi.fn(async () => undefined),
}))

const platform = vi.hoisted(() => ({
  ios: true,
}))

vi.mock('@capgo/capacitor-media-session', () => ({
  MediaSession,
}))

vi.mock('@/lib/native', () => ({
  isIOS: () => platform.ios,
  isNative: () => platform.ios,
  getPlatform: () => (platform.ios ? 'ios' : 'web'),
}))

const {
  clearMediaSession,
  ensureMediaSessionHandlers,
  resetMediaSessionForTests,
  setMediaSessionMeta,
  setMediaSessionPaused,
  setMediaSessionPlaying,
  setMediaSessionPosition,
} = await import('../immersive-media-session')

describe('immersive-media-session', () => {
  beforeEach(() => {
    platform.ios = true
    resetMediaSessionForTests()
    MediaSession.setMetadata.mockClear()
    MediaSession.setPlaybackState.mockClear()
    MediaSession.setPositionState.mockClear()
    MediaSession.setActionHandler.mockClear()
  })

  it('registers play/pause/next/prev/seekto and not ±15', async () => {
    const handlers = {
      play: vi.fn(),
      pause: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
      seekTo: vi.fn(),
    }
    await ensureMediaSessionHandlers(handlers)

    const actions = MediaSession.setActionHandler.mock.calls.map((call) => call[0].action)
    expect(actions).toEqual(['play', 'pause', 'nexttrack', 'previoustrack', 'seekto'])
    expect(actions).not.toContain('seekbackward')
    expect(actions).not.toContain('seekforward')

    const seekHandler = MediaSession.setActionHandler.mock.calls.find(
      (call) => call[0].action === 'seekto',
    )?.[1]
    seekHandler?.({ action: 'seekto', seekTime: 2.5 })
    expect(handlers.seekTo).toHaveBeenCalledWith(2.5)
  })

  it('no-ops off iOS', async () => {
    platform.ios = false
    await setMediaSessionMeta({ title: 'x' })
    await setMediaSessionPosition({ position: 1, duration: 2 })
    await setMediaSessionPlaying()
    await setMediaSessionPaused()
    await clearMediaSession()
    await ensureMediaSessionHandlers({
      play: () => undefined,
      pause: () => undefined,
      next: () => undefined,
      prev: () => undefined,
      seekTo: () => undefined,
    })
    expect(MediaSession.setMetadata).not.toHaveBeenCalled()
    expect(MediaSession.setPositionState).not.toHaveBeenCalled()
    expect(MediaSession.setPlaybackState).not.toHaveBeenCalled()
    expect(MediaSession.setActionHandler).not.toHaveBeenCalled()
  })

  it('updates meta/position/state on iOS', async () => {
    await setMediaSessionMeta({ title: 'hello', artworkSrc: 'file://logo.png' })
    expect(MediaSession.setMetadata).toHaveBeenCalledWith({
      title: 'hello',
      artist: undefined,
      album: undefined,
      artwork: [{ src: 'file://logo.png' }],
    })

    await setMediaSessionPosition({ position: 1.2, duration: 4, playbackRate: 1 })
    expect(MediaSession.setPositionState).toHaveBeenCalledWith({
      position: 1.2,
      duration: 4,
      playbackRate: 1,
    })

    await setMediaSessionPlaying()
    await setMediaSessionPaused()
    await clearMediaSession()
    expect(MediaSession.setPlaybackState).toHaveBeenCalledWith({ playbackState: 'playing' })
    expect(MediaSession.setPlaybackState).toHaveBeenCalledWith({ playbackState: 'paused' })
    expect(MediaSession.setPlaybackState).toHaveBeenCalledWith({ playbackState: 'none' })
  })
})

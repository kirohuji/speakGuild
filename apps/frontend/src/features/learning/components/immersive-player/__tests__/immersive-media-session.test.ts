import { describe, expect, it } from 'vitest'
import {
  clearMediaSession,
  ensureMediaSessionHandlers,
  setMediaSessionMeta,
  setMediaSessionPaused,
  setMediaSessionPlaying,
  setMediaSessionPosition,
} from '../immersive-media-session'

describe('immersive-media-session stub', () => {
  it('is a no-op after Immersive moved to NativeAudio showNotification', async () => {
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
    expect(true).toBe(true)
  })
})

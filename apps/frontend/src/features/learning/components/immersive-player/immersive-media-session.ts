/**
 * @deprecated Immersive Now Playing is owned solely by `@capgo/capacitor-native-audio`
 * (`showNotification: true` + `notificationMetadata`). See docs/沉浸式iOS锁屏播放器.md.
 * This stub remains only so accidental imports fail loudly in tests / typecheck.
 */

export type ImmersiveMediaSessionHandlers = {
  play: () => void
  pause: () => void
  next: () => void
  prev: () => void
  seekTo: (seconds: number) => void
}

export async function setMediaSessionMeta(_options: {
  title?: string
  artist?: string
  album?: string
  artworkSrc?: string
}) {
  // no-op — MediaSession removed from Immersive path
}

export async function setMediaSessionPosition(_options: {
  position: number
  duration?: number
  playbackRate?: number
}) {
  // no-op
}

export async function setMediaSessionPlaying() {
  // no-op
}

export async function setMediaSessionPaused() {
  // no-op
}

export async function clearMediaSession() {
  // no-op
}

export async function ensureMediaSessionHandlers(_handlers: ImmersiveMediaSessionHandlers) {
  // no-op
}

/** Test helper */
export function resetMediaSessionForTests() {
  // no-op
}

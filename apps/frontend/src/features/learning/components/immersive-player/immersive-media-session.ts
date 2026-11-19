import { MediaSession } from '@capgo/capacitor-media-session'
import { isIOS } from '@/lib/native'
import { immersiveLog } from './immersive-audio.transport'

export type ImmersiveMediaSessionHandlers = {
  play: () => void
  pause: () => void
  next: () => void
  prev: () => void
  seekTo: (seconds: number) => void
}

let handlersReady = false
let callbacks: ImmersiveMediaSessionHandlers | null = null

function enabled() {
  return isIOS()
}

export async function setMediaSessionMeta(options: {
  title?: string
  artist?: string
  album?: string
  artworkSrc?: string
}) {
  if (!enabled()) return
  immersiveLog('mediaSession.setMeta', { title: options.title })
  await MediaSession.setMetadata({
    title: options.title,
    artist: options.artist,
    album: options.album,
    artwork: options.artworkSrc ? [{ src: options.artworkSrc }] : undefined,
  }).catch(() => undefined)
}

export async function setMediaSessionPosition(options: {
  position: number
  duration?: number
  playbackRate?: number
}) {
  if (!enabled()) return
  const position = Math.max(0, options.position)
  const duration = options.duration != null ? Math.max(0, options.duration) : undefined
  await MediaSession.setPositionState({
    position,
    duration,
    playbackRate: options.playbackRate ?? 1,
  }).catch(() => undefined)
}

export async function setMediaSessionPlaying() {
  if (!enabled()) return
  await MediaSession.setPlaybackState({ playbackState: 'playing' }).catch(() => undefined)
}

export async function setMediaSessionPaused() {
  if (!enabled()) return
  await MediaSession.setPlaybackState({ playbackState: 'paused' }).catch(() => undefined)
}

export async function clearMediaSession() {
  if (!enabled()) return
  immersiveLog('mediaSession.clear')
  await MediaSession.setPlaybackState({ playbackState: 'none' }).catch(() => undefined)
  await MediaSession.setPositionState({ position: 0, duration: 0, playbackRate: 1 }).catch(() => undefined)
}

/**
 * Register lock-screen actions once; later calls only refresh the callback refs.
 * Actions: play / pause / nexttrack / previoustrack / seekto (no ±15).
 */
export async function ensureMediaSessionHandlers(handlers: ImmersiveMediaSessionHandlers) {
  callbacks = handlers
  if (!enabled() || handlersReady) return
  handlersReady = true
  immersiveLog('mediaSession.ensureHandlers')

  await MediaSession.setActionHandler({ action: 'play' }, () => {
    callbacks?.play()
  }).catch(() => undefined)

  await MediaSession.setActionHandler({ action: 'pause' }, () => {
    callbacks?.pause()
  }).catch(() => undefined)

  await MediaSession.setActionHandler({ action: 'nexttrack' }, () => {
    callbacks?.next()
  }).catch(() => undefined)

  await MediaSession.setActionHandler({ action: 'previoustrack' }, () => {
    callbacks?.prev()
  }).catch(() => undefined)

  await MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
    if (details.seekTime == null || Number.isNaN(details.seekTime)) return
    callbacks?.seekTo(details.seekTime)
  }).catch(() => undefined)
}

/** Test helper */
export function resetMediaSessionForTests() {
  handlersReady = false
  callbacks = null
}

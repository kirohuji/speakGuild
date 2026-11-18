import { Directory, Filesystem } from '@capacitor/filesystem'
import type { MediaSessionAction } from '@capgo/capacitor-media-session'
import type { PlaybackStateEvent } from '@capgo/capacitor-native-audio'
import type { PlaybackSegment } from './immersive-player.types'

export type TransportSlot = 'a' | 'b'

export type MediaMetadataLabels = {
  artist?: string
  album?: string
}

export type ImmersivePlaybackVisualState = {
  state: 'idle' | 'loading' | 'playing' | 'paused'
  media: HTMLAudioElement | null
}

export type ImmersiveAudioTransport = {
  resolve(segment: PlaybackSegment, options?: { allowTts?: boolean }): Promise<string | null>
  prepare(
    slot: TransportSlot,
    fileUrl: string,
    meta: { title: string; artist?: string; album?: string },
  ): Promise<void>
  /** Plays prepared slot; resolves when that asset completes (or is stopped). */
  playSlot(slot: TransportSlot, playbackRate: number): Promise<void>
  pause(): Promise<void>
  resume(): Promise<boolean>
  stop(options?: { clearSession?: boolean }): Promise<void>
  setRate(playbackRate: number): Promise<void>
  hasResumableAsset(): boolean
  setMediaMetadata(
    segment: PlaybackSegment,
    playbackRate: number,
    state: 'none' | 'paused' | 'playing',
    labels?: MediaMetadataLabels,
  ): Promise<void>
  /** Keep last duration/position visible during inter-segment gap (avoid -:--). */
  holdPositionForGap(): Promise<void>
  registerMediaActions(
    handlers: Partial<Record<MediaSessionAction, () => void>>,
    options?: { includeTrackSkip?: boolean },
  ): Promise<void>
  setIosGapTrackControls(
    enabled: boolean,
    handlers?: Partial<Record<'previoustrack' | 'nexttrack', () => void>>,
  ): Promise<void>
  setNativeStateHandler(handler: ((event: PlaybackStateEvent) => void) | null): void
  clearResolveCache(): void
  clearSession(): Promise<void>
  subscribeVisualState(listener: (state: ImmersivePlaybackVisualState) => void): () => void
  otherSlot(slot: TransportSlot): TransportSlot
}

const LOGO_CACHE_PATH = 'immersive/app-logo.png'

let logoArtworkUriPromise: Promise<string> | null = null

/** Web / fallback absolute URL. Native Now Playing cannot load capacitor:// from this. */
export function resolveAppLogoUrl() {
  if (typeof window === 'undefined') return '/logo.png'
  try {
    return new URL('/logo.png', window.location.href).href
  } catch {
    return '/logo.png'
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 32766
  let result = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    result += btoa(String.fromCharCode(...chunk))
  }
  return result
}

async function materializeLogoFileUri(): Promise<string> {
  try {
    await Filesystem.stat({ path: LOGO_CACHE_PATH, directory: Directory.Cache })
    const cached = await Filesystem.getUri({ path: LOGO_CACHE_PATH, directory: Directory.Cache })
    if (cached.uri) return cached.uri
  } catch {
    // not cached yet
  }

  const response = await fetch(resolveAppLogoUrl())
  if (!response.ok) {
    throw new Error(`Failed to fetch app logo (${response.status})`)
  }
  const base64 = arrayBufferToBase64(await response.arrayBuffer())
  await Filesystem.writeFile({
    path: LOGO_CACHE_PATH,
    directory: Directory.Cache,
    data: base64,
    recursive: true,
  })
  const written = await Filesystem.getUri({ path: LOGO_CACHE_PATH, directory: Directory.Cache })
  if (!written.uri) throw new Error('Failed to resolve logo file URI')
  return written.uri
}

/**
 * iOS NativeAudio / MediaSession artwork must be file:// or http(s).
 * Capacitor WebView URLs (capacitor:// / https://localhost) fail in native image loaders.
 */
export async function resolveAppLogoArtworkUri(): Promise<string> {
  if (typeof window === 'undefined') return '/logo.png'
  if (!logoArtworkUriPromise) {
    logoArtworkUriPromise = materializeLogoFileUri().catch((error) => {
      logoArtworkUriPromise = null
      throw error
    })
  }
  try {
    return await logoArtworkUriPromise
  } catch {
    return resolveAppLogoUrl()
  }
}

/** Test helper */
export function resetAppLogoArtworkCache() {
  logoArtworkUriPromise = null
}

import { Directory, Filesystem } from '@capacitor/filesystem'
import type { PlaybackSegment } from './immersive-player.types'

export const IMMERSIVE_LOG_PREFIX = '[MANYU_IMMERSIVE]'

export function immersiveLog(step: string, data?: Record<string, unknown>) {
  if (data) console.log(IMMERSIVE_LOG_PREFIX, step, data)
  else console.log(IMMERSIVE_LOG_PREFIX, step)
}

export type MediaMetadataLabels = {
  artist?: string
  album?: string
}

export type ImmersivePlaybackVisualState = {
  state: 'idle' | 'loading' | 'playing' | 'paused'
  media: HTMLAudioElement | null
}

/** One ready-to-play track for NativeAudio.setQueue / Web sequential play. */
export type QueuePlayItem = {
  assetId: string
  fileUrl: string
  title: string
  artist?: string
  album?: string
  /** Learning segment id; for gap tracks, the segment that just finished. */
  segmentId: string
  /** Silence spacer between segments so Now Playing keeps a real duration (no -:--). */
  kind?: 'segment' | 'gap'
}

export type ImmersiveNativeEvent =
  | {
      type: 'playbackState'
      reason: string
      assetId: string
      state: 'playing' | 'paused' | 'stopped'
    }
  | {
      type: 'queueChange'
      reason: string
      assetId: string
      index: number
    }
  | {
      type: 'complete'
      assetId: string
    }

export type ImmersiveAudioTransport = {
  resolve(segment: PlaybackSegment, options?: { allowTts?: boolean }): Promise<string | null>
  /**
   * Replace the active queue and start at startIndex.
   * Resolves when the started track completes (or is stopped).
   */
  playQueue(
    items: QueuePlayItem[],
    options?: { startIndex?: number; playbackRate?: number },
  ): Promise<void>
  /**
   * Advance to the next queue item and wait for it to complete.
   * Returns false when there is no next item.
   */
  queueNext(): Promise<boolean>
  /**
   * Move to the previous queue item and wait for it to complete.
   * Returns false when there is no previous item.
   */
  queuePrevious(): Promise<boolean>
  pause(): Promise<void>
  resume(): Promise<boolean>
  stop(options?: { clearSession?: boolean }): Promise<void>
  setRate(playbackRate: number): Promise<void>
  /** Seek within the active asset (lock-screen scrubber). */
  seekTo(seconds: number): Promise<void>
  hasResumableAsset(): boolean
  getActiveAssetId(): string | null
  getQueueIndex(): number
  setNativeEventHandler(handler: ((event: ImmersiveNativeEvent) => void) | null): void
  clearResolveCache(): void
  clearSession(): Promise<void>
  subscribeVisualState(listener: (state: ImmersivePlaybackVisualState) => void): () => void
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
 * iOS NativeAudio artwork must be file:// or http(s).
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

export function toQueueAssetId(segmentId: string) {
  return `immersive:${segmentId}`
}

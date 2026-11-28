import { Directory, Filesystem } from '@capacitor/filesystem'
import type { PlaybackSegment } from './immersive-player.types'

/**
 * Unified immersive debug prefix — same string as Capgo native (`[MANYU_IMMERSIVE]`).
 * Filter Xcode + Safari with that token. Events are `js.*` here and `native.*` in Swift.
 *
 * Clock-related fields (when present):
 * - player / visual / deltaVP — AVAudioPlayer vs NP wall-clock bar (+ = bar ahead)
 * - lastNp / npRate / npAge — last NP write baseline
 * - pin / pinSource / staleClock — pause freeze decision
 */
export const IMMERSIVE_LOG_PREFIX = '[MANYU_IMMERSIVE]'

function formatLogValue(value: unknown): string {
  if (value === null || value === undefined) return 'nil'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    if (Number.isInteger(value)) return String(value)
    return value.toFixed(4).replace(/\.?0+$/, '') || '0'
  }
  if (typeof value === 'string') {
    return /\s/.test(value) ? JSON.stringify(value) : value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** One-line logs so Xcode + Web Inspector share the same readable stream. */
export function immersiveLog(step: string, data?: Record<string, unknown>) {
  const event = step.startsWith('js.') || step.startsWith('native.') ? step : `js.${step}`
  if (!data || Object.keys(data).length === 0) {
    console.log(`${IMMERSIVE_LOG_PREFIX} ${event}`)
    return
  }
  const body = Object.entries(data)
    .map(([key, value]) => `${key}=${formatLogValue(value)}`)
    .join(' ')
  console.log(`${IMMERSIVE_LOG_PREFIX} ${event} ${body}`)
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

/** Allowed immersive playback rates (settings UI + Now Playing). */
export const IMMERSIVE_PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const
export type ImmersivePlaybackRate = (typeof IMMERSIVE_PLAYBACK_RATES)[number]

export function normalizeImmersivePlaybackRate(rate: number | undefined): ImmersivePlaybackRate {
  if (rate === 0.75 || rate === 1 || rate === 1.25 || rate === 1.5) return rate
  return 1
}

export type ImmersiveAudioTransport = {
  resolve(segment: PlaybackSegment, options?: { allowTts?: boolean }): Promise<string | null>
  /**
   * Arm Now Playing with a paused card before the user presses play (docs §3).
   * Uses setQueue({ autoPlay: false }) + notificationMetadata; native patch writes rate=0.
   */
  armQueue(
    items: QueuePlayItem[],
    options?: { startIndex?: number },
  ): Promise<void>
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
 * iOS NativeAudio artwork must be file://.
 * Capacitor WebView / bare http(s) URLs often fail in MPNowPlayingInfoCenter loaders.
 * Retries materialization; throws if no file:// URI (caller omits artworkUrl).
 */
export async function resolveAppLogoArtworkUri(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('logo artwork requires browser/native runtime')
  }
  const attempt = async () => {
    if (!logoArtworkUriPromise) {
      logoArtworkUriPromise = materializeLogoFileUri().catch((error) => {
        logoArtworkUriPromise = null
        throw error
      })
    }
    return logoArtworkUriPromise
  }
  try {
    const uri = await attempt()
    if (uri.startsWith('file://')) return uri
    throw new Error(`logo artwork is not file:// (${uri.slice(0, 32)})`)
  } catch (firstError) {
    logoArtworkUriPromise = null
    immersiveLog('artwork.retry', {
      message: firstError instanceof Error ? firstError.message : String(firstError),
    })
    const uri = await attempt()
    if (uri.startsWith('file://')) return uri
    throw new Error(`logo artwork is not file:// after retry`)
  }
}

/** Test helper */
export function resetAppLogoArtworkCache() {
  logoArtworkUriPromise = null
}

export function toQueueAssetId(segmentId: string) {
  return `immersive:${segmentId}`
}

/**
 * Capgo caches AudioAsset by assetId and will not reload when only assetPath
 * changes. Arm uses the bare id (unpadded); play must use a distinct id whenever
 * leading/trailing silence is baked, or the padded file never reaches the player.
 */
export function toPaddedQueueAssetId(
  segmentId: string,
  leadingSilenceSec: number,
  trailingSilenceSec: number,
  playbackRate: number,
) {
  const lead = Math.max(0, leadingSilenceSec)
  const trail = Math.max(0, trailingSilenceSec)
  if (lead <= 0 && trail <= 0) return toQueueAssetId(segmentId)
  const rate = normalizeImmersivePlaybackRate(playbackRate)
  return `immersive:${segmentId}:pad:L${lead}:T${trail}:r${rate}`
}

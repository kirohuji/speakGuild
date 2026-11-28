import { Directory, Filesystem } from '@capacitor/filesystem'
import { isNative } from '@/lib/native/platform'
import { IMMERSIVE_PAUSE_GAP_SECONDS, type ImmersivePauseGapSeconds } from './immersive-player.types'
import { immersiveLog } from './immersive-audio.transport'

const SILENCE_CACHE_DIR = 'immersive/silence'
const SAMPLE_RATE = 8000

const fileUriCache = new Map<number, Promise<string>>()
const webBlobUrlCache = new Map<number, string>()

/** Test override — bypass Filesystem / Blob materialization. */
let silenceUrlOverride: ((seconds: number) => Promise<string | null>) | null = null

export function setSilenceUrlResolverForTests(
  resolver: ((seconds: number) => Promise<string | null>) | null,
) {
  silenceUrlOverride = resolver
}

/** Test helper */
export function resetSilenceUrlCache() {
  fileUriCache.clear()
  for (const url of webBlobUrlCache.values()) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }
  webBlobUrlCache.clear()
}

export function normalizePauseGapSeconds(seconds: number): ImmersivePauseGapSeconds {
  return IMMERSIVE_PAUSE_GAP_SECONDS.includes(seconds as ImmersivePauseGapSeconds)
    ? (seconds as ImmersivePauseGapSeconds)
    : 2
}

export function toGapAssetId(afterSegmentId: string, seconds: number, playbackRate = 1) {
  const sec = Number(Math.max(0, seconds).toFixed(3))
  const rate = Number(Math.max(0.01, playbackRate).toFixed(2))
  return `immersive:gap:${sec}s:r${rate}:after:${afterSegmentId}`
}

export function isGapAssetId(assetId: string) {
  return assetId.startsWith('immersive:gap:')
}

/**
 * Build a mono 16-bit PCM WAV of pure silence.
 * NativeAudio / HTMLAudio both accept WAV; duration is exact for Now Playing scrubber.
 */
export function buildSilentWavBytes(durationSeconds: number, sampleRate = SAMPLE_RATE): Uint8Array {
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate))
  const dataSize = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  // samples stay 0 (silence)

  return new Uint8Array(buffer)
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 32766
  let result = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    result += btoa(String.fromCharCode(...chunk))
  }
  return result
}

async function materializeNativeSilenceUri(seconds: number): Promise<string> {
  const stamp = Number(seconds.toFixed(3)).toString().replace('.', 'p')
  const path = `${SILENCE_CACHE_DIR}/${stamp}s.wav`
  try {
    await Filesystem.stat({ path, directory: Directory.Cache })
    const cached = await Filesystem.getUri({ path, directory: Directory.Cache })
    if (cached.uri) return cached.uri
  } catch {
    // not cached yet
  }

  const bytes = buildSilentWavBytes(seconds)
  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: bytesToBase64(bytes),
    recursive: true,
  })
  const written = await Filesystem.getUri({ path, directory: Directory.Cache })
  if (!written.uri) throw new Error('Failed to resolve silence file URI')
  return written.uri
}

/**
 * Resolve a playable silence URL for an exact duration (may be rate-compensated).
 * Native → Cache `file://` WAV; Web → blob: WAV.
 * Returns null when materialization fails (caller may fall back to timer gap).
 */
export async function resolveSilenceFileUrlForDuration(seconds: number): Promise<string | null> {
  const duration = Math.max(0.05, Number(seconds.toFixed(3)))
  if (silenceUrlOverride) {
    return silenceUrlOverride(duration)
  }

  // Cache key in centiseconds so 2.5s / 3s stay distinct.
  const cacheKey = Math.round(duration * 100)

  if (isNative()) {
    let pending = fileUriCache.get(cacheKey)
    if (!pending) {
      pending = materializeNativeSilenceUri(duration)
        .then((uri) => {
          immersiveLog('silence.nativeUri', { seconds: duration, uri })
          return uri
        })
        .catch((error) => {
          fileUriCache.delete(cacheKey)
          throw error
        })
      fileUriCache.set(cacheKey, pending)
    }
    try {
      return await pending
    } catch (error) {
      immersiveLog('silence.nativeFailed', {
        seconds: duration,
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  try {
    // Web: reuse exact-duration blob cache via Map keyed by centiseconds.
    const cached = webBlobUrlCache.get(cacheKey)
    if (cached) {
      immersiveLog('silence.webUrl', { seconds: duration, cached: true })
      return cached
    }
    const bytes = buildSilentWavBytes(duration)
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'audio/wav' }))
    webBlobUrlCache.set(cacheKey, url)
    immersiveLog('silence.webUrl', { seconds: duration })
    return url
  } catch (error) {
    immersiveLog('silence.webFailed', {
      seconds: duration,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Resolve silence for a settings gap value (1/2/3/5s).
 * Prefer {@link resolveSilenceFileUrlForDuration} when rate-compensating.
 */
export async function resolveSilenceFileUrl(seconds: number): Promise<string | null> {
  return resolveSilenceFileUrlForDuration(normalizePauseGapSeconds(seconds))
}

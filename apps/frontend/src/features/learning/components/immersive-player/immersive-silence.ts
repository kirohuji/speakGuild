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

export function toGapAssetId(afterSegmentId: string, seconds: number) {
  return `immersive:gap:${seconds}s:after:${afterSegmentId}`
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
  const path = `${SILENCE_CACHE_DIR}/${seconds}s.wav`
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

function materializeWebSilenceUrl(seconds: number): string {
  const cached = webBlobUrlCache.get(seconds)
  if (cached) return cached
  const bytes = buildSilentWavBytes(seconds)
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'audio/wav' }))
  webBlobUrlCache.set(seconds, url)
  return url
}

/**
 * Resolve a playable silence URL for the given gap length.
 * Native → Cache `file://` WAV; Web → blob: WAV.
 * Returns null when materialization fails (caller should fall back to timer gap).
 */
export async function resolveSilenceFileUrl(seconds: number): Promise<string | null> {
  const normalized = normalizePauseGapSeconds(seconds)
  if (silenceUrlOverride) {
    return silenceUrlOverride(normalized)
  }

  if (isNative()) {
    let pending = fileUriCache.get(normalized)
    if (!pending) {
      pending = materializeNativeSilenceUri(normalized)
        .then((uri) => {
          immersiveLog('silence.nativeUri', { seconds: normalized, uri })
          return uri
        })
        .catch((error) => {
          fileUriCache.delete(normalized)
          throw error
        })
      fileUriCache.set(normalized, pending)
    }
    try {
      return await pending
    } catch (error) {
      immersiveLog('silence.nativeFailed', {
        seconds: normalized,
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  try {
    const url = materializeWebSilenceUrl(normalized)
    immersiveLog('silence.webUrl', { seconds: normalized })
    return url
  } catch (error) {
    immersiveLog('silence.webFailed', {
      seconds: normalized,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

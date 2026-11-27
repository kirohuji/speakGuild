import { Directory, Filesystem } from '@capacitor/filesystem'
import { isNative } from '@/lib/native/platform'
import { immersiveLog, normalizeImmersivePlaybackRate } from './immersive-audio.transport'
import type { PlaybackSegment } from './immersive-player.types'

const PAD_CACHE_DIR = 'immersive/padded'

/** Word → example pause (wall-clock seconds), baked as **leading** silence on the example. */
export const WORD_TO_EXAMPLE_GAP_SECONDS = 1

const padUriCache = new Map<string, Promise<string>>()

export type PadSilenceInput = {
  segmentId: string
  fileUrl: string
  leadingSilenceSec: number
  trailingSilenceSec: number
  playbackRate: number
}

/** Test override — bypass decode / Filesystem materialization. */
let padUrlOverride: ((input: PadSilenceInput) => Promise<string | null>) | null = null

export function setPaddedUrlResolverForTests(
  resolver: ((input: PadSilenceInput) => Promise<string | null>) | null,
) {
  padUrlOverride = resolver
}

/** Test helper */
export function resetPaddedUrlCache() {
  padUriCache.clear()
}

/**
 * Bake `silenceSeconds * playbackRate` of silence so wall-clock wait
 * stays ≈ `silenceSeconds` after `setRate` shortens the whole file.
 */
export function bakeSilenceDurationSeconds(silenceSeconds: number, playbackRate: number): number {
  const rate = Math.max(0.01, playbackRate)
  return Math.max(0, silenceSeconds) * rate
}

/**
 * Leading silence before a content segment (wall-clock target seconds).
 * - background → 0
 * - example after same-item main → 1s (word → sentence pause lives on the example)
 */
export function computeLeadingSilenceSeconds(options: {
  segment: PlaybackSegment
  prevSegment: PlaybackSegment | undefined
  background: boolean
}): number {
  if (options.background) return 0
  const { segment, prevSegment } = options
  const afterSameItemMain =
    segment.role === 'example' &&
    prevSegment?.role === 'main' &&
    prevSegment.itemId === segment.itemId
  return afterSameItemMain ? WORD_TO_EXAMPLE_GAP_SECONDS : 0
}

/**
 * Trailing silence after a content segment (wall-clock target seconds).
 * - background → 0
 * - next segment / trailing item gap → `pauseGapSeconds`
 * - word→example pause is **not** here (see leading on example)
 */
export function computeTrailingSilenceSeconds(options: {
  segment: PlaybackSegment
  nextSegment: PlaybackSegment | undefined
  isLastInResolvedWindow: boolean
  needTrailingGap: boolean
  pauseGapSeconds: number
  background: boolean
}): number {
  if (options.background) return 0
  const { segment, nextSegment } = options
  // Word → example: pause is leading on the example, not trailing on main.
  const nextIsSameItemExample =
    segment.role === 'main' &&
    nextSegment?.role === 'example' &&
    nextSegment.itemId === segment.itemId
  if (nextIsSameItemExample) return 0
  if (!options.isLastInResolvedWindow) return options.pauseGapSeconds
  if (options.needTrailingGap) return options.pauseGapSeconds
  return 0
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)
}

export function padCacheKey(options: {
  segmentId: string
  leadingSilenceSec: number
  trailingSilenceSec: number
  playbackRate: number
  sourceIdentity: string
}): string {
  const rate = normalizeImmersivePlaybackRate(options.playbackRate)
  const lead = Number(options.leadingSilenceSec.toFixed(3))
  const trail = Number(options.trailingSilenceSec.toFixed(3))
  const id = sanitizeKeyPart(options.segmentId)
  const source = sanitizeKeyPart(options.sourceIdentity)
  return `${id}__L${lead}__T${trail}__r${rate}__${source}`
}

function allocateAudioBuffer(channels: number, frames: number, sampleRate: number): AudioBuffer {
  const Offline =
    typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (Offline) {
    return new Offline(channels, frames, sampleRate).createBuffer(channels, frames, sampleRate)
  }
  const data = Array.from({ length: channels }, () => new Float32Array(frames))
  return {
    length: frames,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: (c: number) => data[c]!,
    duration: frames / sampleRate,
    copyFromChannel() {},
    copyToChannel() {},
  } as AudioBuffer
}

/** Prepend and/or append zero samples; preserves channel count and sample rate. */
export function padAudioBufferWithSilence(
  source: AudioBuffer,
  options: { leadingSeconds?: number; trailingSeconds?: number },
): AudioBuffer {
  const leadingFrames = Math.max(0, Math.floor((options.leadingSeconds ?? 0) * source.sampleRate))
  const trailingFrames = Math.max(0, Math.floor((options.trailingSeconds ?? 0) * source.sampleRate))
  if (leadingFrames <= 0 && trailingFrames <= 0) return source
  const totalFrames = source.length + leadingFrames + trailingFrames
  const channels = source.numberOfChannels
  const out = allocateAudioBuffer(channels, totalFrames, source.sampleRate)
  for (let c = 0; c < channels; c += 1) {
    out.getChannelData(c).set(source.getChannelData(c), leadingFrames)
  }
  return out
}

/** @deprecated prefer padAudioBufferWithSilence — kept for tests */
export function appendSilenceToAudioBuffer(source: AudioBuffer, silenceSeconds: number): AudioBuffer {
  return padAudioBufferWithSilence(source, { trailingSeconds: silenceSeconds })
}

/** Encode AudioBuffer as 16-bit PCM WAV. */
export function encodeWavFromAudioBuffer(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numSamples = buffer.length
  const dataSize = numSamples * numChannels * 2
  const bytes = new ArrayBuffer(44 + dataSize)
  const view = new DataView(bytes)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c += 1) {
    channels.push(buffer.getChannelData(c))
  }
  let offset = 44
  for (let i = 0; i < numSamples; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channels[c][i] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Uint8Array(bytes)
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

async function decodeAudioFromUrl(fileUrl: string): Promise<AudioBuffer> {
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`failed to fetch audio (${response.status})`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await ctx.close().catch(() => undefined)
  }
}

async function materializeNativePaddedUri(key: string, wavBytes: Uint8Array): Promise<string> {
  const path = `${PAD_CACHE_DIR}/${key}.wav`
  try {
    await Filesystem.stat({ path, directory: Directory.Cache })
    const cached = await Filesystem.getUri({ path, directory: Directory.Cache })
    if (cached.uri) return cached.uri
  } catch {
    // not cached yet
  }

  await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: bytesToBase64(wavBytes),
    recursive: true,
  })
  const written = await Filesystem.getUri({ path, directory: Directory.Cache })
  if (!written.uri) throw new Error('Failed to resolve padded file URI')
  return written.uri
}

/**
 * Decode content audio, prepend/append silence, write Cache WAV `file://` (native)
 * or blob: URL (web). Returns null on failure so callers can fall back to timer gaps.
 */
export async function resolvePaddedSegmentFileUrl(options: PadSilenceInput): Promise<string | null> {
  const leadingSilenceSec = Math.max(0, options.leadingSilenceSec)
  const trailingSilenceSec = Math.max(0, options.trailingSilenceSec)
  const playbackRate = normalizeImmersivePlaybackRate(options.playbackRate)

  if (leadingSilenceSec <= 0 && trailingSilenceSec <= 0) {
    return options.fileUrl
  }

  if (padUrlOverride) {
    return padUrlOverride({
      segmentId: options.segmentId,
      fileUrl: options.fileUrl,
      leadingSilenceSec,
      trailingSilenceSec,
      playbackRate,
    })
  }

  const leadBake = bakeSilenceDurationSeconds(leadingSilenceSec, playbackRate)
  const trailBake = bakeSilenceDurationSeconds(trailingSilenceSec, playbackRate)
  const key = padCacheKey({
    segmentId: options.segmentId,
    leadingSilenceSec,
    trailingSilenceSec,
    playbackRate,
    sourceIdentity: options.fileUrl,
  })

  let pending = padUriCache.get(key)
  if (!pending) {
    pending = (async () => {
      const decoded = await decodeAudioFromUrl(options.fileUrl)
      const padded = padAudioBufferWithSilence(decoded, {
        leadingSeconds: leadBake,
        trailingSeconds: trailBake,
      })
      const wav = encodeWavFromAudioBuffer(padded)

      if (isNative()) {
        const uri = await materializeNativePaddedUri(key, wav)
        immersiveLog('pad.nativeUri', {
          segmentId: options.segmentId,
          leadingSilenceSec,
          trailingSilenceSec,
          playbackRate,
          leadBake,
          trailBake,
          uri,
        })
        return uri
      }

      const blobUrl = URL.createObjectURL(new Blob([wav.slice()], { type: 'audio/wav' }))
      immersiveLog('pad.webUrl', {
        segmentId: options.segmentId,
        leadingSilenceSec,
        trailingSilenceSec,
        playbackRate,
        leadBake,
        trailBake,
      })
      return blobUrl
    })().catch((error) => {
      padUriCache.delete(key)
      throw error
    })
    padUriCache.set(key, pending)
  }

  try {
    return await pending
  } catch (error) {
    immersiveLog('pad.failed', {
      segmentId: options.segmentId,
      leadingSilenceSec,
      trailingSilenceSec,
      playbackRate,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

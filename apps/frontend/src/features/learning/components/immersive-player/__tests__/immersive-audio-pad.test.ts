import { describe, expect, it } from 'vitest'
import {
  appendSilenceToAudioBuffer,
  bakeSilenceDurationSeconds,
  computeLeadingSilenceSeconds,
  computeTrailingSilenceSeconds,
  encodeWavFromAudioBuffer,
  padAudioBufferWithSilence,
  padCacheKey,
  WORD_TO_EXAMPLE_GAP_SECONDS,
} from '../immersive-audio-pad'
import type { PlaybackSegment } from '../immersive-player.types'

function seg(partial: Partial<PlaybackSegment> & Pick<PlaybackSegment, 'id' | 'role'>): PlaybackSegment {
  return {
    itemId: 'w1',
    text: 'x',
    lang: 'en',
    title: 'hello',
    ...partial,
  }
}

describe('immersive-audio-pad', () => {
  it('bakes silence longer at higher rate so wall-clock wait stays constant', () => {
    expect(bakeSilenceDurationSeconds(2, 1)).toBe(2)
    expect(bakeSilenceDurationSeconds(2, 1.5)).toBe(3)
    expect(bakeSilenceDurationSeconds(1, 0.75)).toBe(0.75)
  })

  it('puts word→example 1s on the example leading edge; trailing uses pauseGapSeconds', () => {
    const main = seg({ id: 'w1:main:0', role: 'main' })
    const example = seg({ id: 'w1:example:0', role: 'example' })

    expect(
      computeLeadingSilenceSeconds({
        segment: example,
        prevSegment: main,
      }),
    ).toBe(WORD_TO_EXAMPLE_GAP_SECONDS)

    expect(
      computeTrailingSilenceSeconds({
        segment: main,
        nextSegment: example,
        isLastInResolvedWindow: false,
        needTrailingGap: false,
        pauseGapSeconds: 2,
      }),
    ).toBe(0)

    expect(
      computeTrailingSilenceSeconds({
        segment: example,
        nextSegment: undefined,
        isLastInResolvedWindow: true,
        needTrailingGap: true,
        pauseGapSeconds: 2,
      }),
    ).toBe(2)
  })

  it('prepends and appends silence frames and encodes a valid WAV header', () => {
    const length = 8
    const sampleRate = 8000
    const channel = new Float32Array(length)
    channel.fill(0.5)
    const source = {
      length,
      sampleRate,
      numberOfChannels: 1,
      getChannelData: () => channel,
    } as unknown as AudioBuffer

    const padded = padAudioBufferWithSilence(source, {
      leadingSeconds: 0.001,
      trailingSeconds: 0.001,
    })
    expect(padded.length).toBe(24)
    expect(appendSilenceToAudioBuffer(source, 0.001).length).toBe(16)
    const wav = encodeWavFromAudioBuffer(padded)
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE')
    expect(wav.byteLength).toBe(44 + 24 * 2)
  })

  it('builds stable cache keys from segment + lead/trail + rate', () => {
    const a = padCacheKey({
      segmentId: 'w1:main:0',
      leadingSilenceSec: 1,
      trailingSilenceSec: 2,
      playbackRate: 1.25,
      sourceIdentity: 'file://a.mp3',
    })
    const b = padCacheKey({
      segmentId: 'w1:main:0',
      leadingSilenceSec: 1,
      trailingSilenceSec: 2,
      playbackRate: 1.25,
      sourceIdentity: 'file://a.mp3',
    })
    const c = padCacheKey({
      segmentId: 'w1:main:0',
      leadingSilenceSec: 0,
      trailingSilenceSec: 2,
      playbackRate: 1.25,
      sourceIdentity: 'file://a.mp3',
    })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toContain(':')
  })
})

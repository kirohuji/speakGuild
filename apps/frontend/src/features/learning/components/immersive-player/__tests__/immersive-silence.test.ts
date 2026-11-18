import { describe, expect, it } from 'vitest'
import { buildSilentWavBytes, normalizePauseGapSeconds, toGapAssetId } from '../immersive-silence'

describe('immersive-silence', () => {
  it('builds a valid WAV header with exact PCM payload size', () => {
    const seconds = 2
    const sampleRate = 8000
    const bytes = buildSilentWavBytes(seconds, sampleRate)
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WAVE')
    const dataSize = seconds * sampleRate * 2
    expect(bytes.byteLength).toBe(44 + dataSize)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(40, true)).toBe(dataSize)
    expect(view.getUint32(24, true)).toBe(sampleRate)
  })

  it('normalizes unknown gap seconds to 2', () => {
    expect(normalizePauseGapSeconds(2)).toBe(2)
    expect(normalizePauseGapSeconds(5)).toBe(5)
    expect(normalizePauseGapSeconds(9)).toBe(2)
  })

  it('builds unique gap asset ids per segment', () => {
    expect(toGapAssetId('w1:main:0', 2)).toBe('immersive:gap:2s:after:w1:main:0')
  })
})

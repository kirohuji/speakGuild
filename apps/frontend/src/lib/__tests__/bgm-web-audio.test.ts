import { describe, expect, it } from 'vitest'
import { canUseBgmWebAudioGraph } from '@/lib/bgm-volume'

describe('canUseBgmWebAudioGraph', () => {
  it('allows Capacitor local playback URLs', () => {
    expect(canUseBgmWebAudioGraph('capacitor://localhost/_capacitor_file_/Data/bgm.mp3')).toBe(true)
    expect(canUseBgmWebAudioGraph('http://localhost/_capacitor_file_/Data/bgm.mp3')).toBe(true)
  })

  it('rejects cross-origin COS URLs that would silence MediaElementSource', () => {
    expect(canUseBgmWebAudioGraph('https://example-cos.tencentcos.cn/themes/rain.mp3')).toBe(false)
    expect(canUseBgmWebAudioGraph('https://cdn.example.com/a.mp3?sign=1')).toBe(false)
  })
})

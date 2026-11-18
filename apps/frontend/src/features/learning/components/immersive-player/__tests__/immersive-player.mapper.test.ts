import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPlaybackSegments, mapInsightItemToImmersiveItem } from '../immersive-player.mapper'
import { DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS } from '../immersive-player.store'

describe('immersive player example playback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps every generated example when mapping an insight item', () => {
    const item = mapInsightItemToImmersiveItem({
      kind: 'word',
      id: 'word-1',
      word: 'notebook',
      examples: [
        { en: 'One', audioUrl: 'https://audio.test/one.mp3' },
        { en: 'Two' },
        { en: 'Three', audioUrl: 'https://audio.test/three.mp3' },
      ],
    })

    expect(item.examples).toHaveLength(3)
  })

  it('randomly chooses only from examples that already have audio', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const segments = buildPlaybackSegments({
      id: 'word-1',
      kind: 'word',
      title: 'notebook',
      mainAudioUrl: 'https://audio.test/notebook.mp3',
      examples: [
        { en: 'No audio' },
        { en: 'First playable', audioUrl: 'https://audio.test/first.mp3' },
        { en: 'Also no audio', audioUrl: null },
        { en: 'Second playable', audioUrl: 'https://audio.test/second.mp3' },
        { en: 'Third playable', audioUrl: 'https://audio.test/third.mp3' },
      ],
    }, {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      playExample: true,
    })

    expect(segments.map((segment) => segment.role)).toEqual(['main', 'example'])
    expect(segments[1]).toMatchObject({
      text: 'Third playable',
      audioUrl: 'https://audio.test/third.mp3',
    })
  })

  it('skips example playback when none of the examples has audio', () => {
    const segments = buildPlaybackSegments({
      id: 'word-1',
      kind: 'word',
      title: 'notebook',
      examples: [{ en: 'No audio' }, { en: 'Still no audio', audioUrl: null }],
    }, {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      playExample: true,
    })

    expect(segments.map((segment) => segment.role)).toEqual(['main'])
  })

  it('expands finite repeatPerItem into repeated segment ids', () => {
    const segments = buildPlaybackSegments({
      id: 'word-1',
      kind: 'word',
      title: 'repeat',
      mainAudioUrl: 'https://audio.test/repeat.mp3',
    }, {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      repeatPerItem: 3,
      playExample: false,
    })
    expect(segments).toHaveLength(3)
    expect(segments.map((segment) => segment.id)).toEqual([
      'word-1:main:0',
      'word-1:main:1',
      'word-1:main:2',
    ])
  })

  it('omits main text when playMainText is false', () => {
    const segments = buildPlaybackSegments({
      id: 'word-1',
      kind: 'word',
      title: 'silent',
      mainAudioUrl: 'https://audio.test/silent.mp3',
    }, {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      playMainText: false,
      playExample: false,
    })
    expect(segments).toEqual([])
  })

  it('maps chunk and pattern insight titles', () => {
    const chunk = mapInsightItemToImmersiveItem({
      kind: 'chunk',
      id: 'chunk-1',
      text: 'take part in',
      meaning: '参加',
    })
    expect(chunk).toMatchObject({ kind: 'chunk', title: 'take part in', meaning: '参加' })

    const pattern = mapInsightItemToImmersiveItem({
      kind: 'pattern',
      id: 'pattern-1',
      pattern: 'as adj as',
      example: 'as good as gold',
    })
    expect(pattern).toMatchObject({ kind: 'pattern', title: 'as adj as', exampleEn: 'as good as gold' })
  })

  it('picks UK audio when accent is uk and falls back to US', () => {
    const uk = buildPlaybackSegments({
      id: 'word-1',
      kind: 'word',
      title: 'color',
      audioUsUrl: 'https://audio.test/us.mp3',
      audioUkUrl: 'https://audio.test/uk.mp3',
    }, {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      accent: 'uk',
    })
    expect(uk[0]?.audioUrl).toBe('https://audio.test/uk.mp3')

    const fallback = buildPlaybackSegments({
      id: 'word-2',
      kind: 'word',
      title: 'color',
      audioUsUrl: 'https://audio.test/us.mp3',
      audioUkUrl: null,
    }, {
      ...DEFAULT_IMMERSIVE_PLAYBACK_SETTINGS,
      accent: 'uk',
    })
    expect(fallback[0]?.audioUrl).toBe('https://audio.test/us.mp3')
  })
})

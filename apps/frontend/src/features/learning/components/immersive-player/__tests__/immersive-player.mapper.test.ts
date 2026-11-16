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
})

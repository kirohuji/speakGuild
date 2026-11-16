import { describe, expect, it } from 'vitest'
import {
  computePlaylistWindow,
  expressionDisplayTitle,
  hasExpressionTitle,
  shouldReloadPlaylistWindow,
} from '../playlist-window'

describe('computePlaylistWindow', () => {
  it('centers a ±1 page window around the absolute index', () => {
    expect(computePlaylistWindow({ absoluteIndex: 45, total: 200, pageSize: 30 })).toEqual({
      absoluteIndex: 45,
      windowStart: 15,
      windowSize: 90,
      indexInWindow: 30,
    })
  })

  it('clamps near the start and end of the playlist', () => {
    expect(computePlaylistWindow({ absoluteIndex: 0, total: 200, pageSize: 30 })).toMatchObject({
      absoluteIndex: 0,
      windowStart: 0,
      indexInWindow: 0,
    })
    expect(computePlaylistWindow({ absoluteIndex: 999, total: 50, pageSize: 30 })).toMatchObject({
      absoluteIndex: 49,
      windowStart: 19,
      indexInWindow: 30,
    })
  })
})

describe('shouldReloadPlaylistWindow', () => {
  it('keeps middle indexes in the current window', () => {
    expect(shouldReloadPlaylistWindow(10, 90)).toBe(false)
  })

  it('reloads outside or near either edge', () => {
    expect(shouldReloadPlaylistWindow(-1, 90)).toBe(true)
    expect(shouldReloadPlaylistWindow(90, 90)).toBe(true)
    expect(shouldReloadPlaylistWindow(1, 90)).toBe(true)
    expect(shouldReloadPlaylistWindow(88, 90)).toBe(true)
  })
})

describe('ghost expression title filter', () => {
  it('hides empty / whitespace-only titles and keeps real titles', () => {
    expect(hasExpressionTitle({ original: '  ' }, 'word')).toBe(false)
    expect(hasExpressionTitle({ vocabulary: { word: 'keep' } }, 'word')).toBe(true)
    expect(hasExpressionTitle({ chunkText: '', corrected: '' }, 'chunk')).toBe(false)
    expect(hasExpressionTitle({ contentData: { text: 'take care' } }, 'chunk')).toBe(true)
    expect(expressionDisplayTitle({ contentData: { pattern: 'make sure' } }, 'scene_phrase')).toBe('make sure')
  })
})

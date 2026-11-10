import { describe, expect, it } from 'vitest'
import { type MixedTimelineFrame } from '@/features/admin/components/vn-mixed-timeline'
import {
  buildPerformedStoryFrames,
  buildRepeatDialogueSnapshot,
} from '../performed-story-timeline'

function frame(index: number, kind: MixedTimelineFrame['kind'], speaker: string, text: string): MixedTimelineFrame {
  return {
    index,
    kind,
    speaker,
    text,
    expression: 'default',
    position: 'center',
    source: kind === 'line' ? 'ink' : 'defaultAnswer',
    sceneName: 'start',
    sceneItemIndex: index,
    background: { url: `https://assets.example/bg-${index}.jpg` },
    sprite: { position: 'center' },
  }
}

describe('performed story timeline', () => {
  it('keeps the actual branch and free-form answer while reusing authored visuals', () => {
    const authored = [
      frame(0, 'line', 'Guide', 'Where should we go?'),
      frame(1, 'userInput', 'You', 'The default route'),
      frame(2, 'line', 'Guide', 'Default ending'),
    ]

    const result = buildPerformedStoryFrames(authored, [
      { speaker: 'Guide', text: 'Where should we go?' },
      { speaker: 'You', text: 'Let us take the mountain path.', isUser: true },
      { speaker: 'Guide', text: 'The mountain is beautiful.' },
    ])

    expect(result.map((item) => item.text)).toEqual([
      'Where should we go?',
      'Let us take the mountain path.',
      'The mountain is beautiful.',
    ])
    expect(result.map((item) => item.index)).toEqual([0, 1, 2])
    expect(result[1].kind).toBe('userInput')
    expect(result[1].background.url).toBe('https://assets.example/bg-1.jpg')
  })

  it('marks every recorded repeat frame and preserves duration metadata', () => {
    const result = buildRepeatDialogueSnapshot(
      [frame(0, 'line', 'Guide', 'Welcome.'), frame(1, 'userInput', 'You', 'Thank you.')],
      { 0: 'asset-npc', 1: 'asset-user' },
      { 0: 900, 1: 1100 },
      'Me',
    )

    expect(result).toMatchObject([
      { recorded: true, isUser: false, recordingFrameIndex: 0, recordingDurationMs: 900 },
      { recorded: true, isUser: true, recordingFrameIndex: 1, recordingDurationMs: 1100 },
    ])
  })
})

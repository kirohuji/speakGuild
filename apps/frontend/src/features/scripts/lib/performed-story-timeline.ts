import {
  type MixedTimelineFrame,
  isUserMixedFrame,
} from '@/features/admin/components/vn-mixed-timeline'

export interface PerformedStoryTurn {
  speaker?: string
  text: string
  isUser?: boolean
  originalText?: string
  recordingFrameIndex?: number
  recordingDurationMs?: number
  recorded?: boolean
}

function normalizeText(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function normalizeSpeaker(value?: string) {
  return (value ?? '').replace(/\s+/g, '').trim().toLocaleLowerCase()
}

function frameMatchesTurn(frame: MixedTimelineFrame, turn: PerformedStoryTurn) {
  const sameRole = isUserMixedFrame(frame) === Boolean(turn.isUser)
  if (!sameRole || normalizeText(frame.text) !== normalizeText(turn.text)) return false
  const turnSpeaker = normalizeSpeaker(turn.speaker)
  return !turnSpeaker || normalizeSpeaker(frame.speaker) === turnSpeaker
}

function fallbackFrame(index: number): MixedTimelineFrame {
  return {
    index,
    kind: 'line',
    speaker: '',
    text: '',
    expression: 'default',
    position: 'center',
    source: 'ink',
    sceneName: 'performed',
    sceneItemIndex: index,
    background: {},
    sprite: { position: 'center' },
  }
}

/**
 * Rebuild a renderable timeline from the dialogue that actually happened.
 * Authored frames provide current media/visuals; performed turns own ordering,
 * branch selection, and free-form user text.
 */
export function buildPerformedStoryFrames(
  authoredFrames: MixedTimelineFrame[],
  performedTurns: PerformedStoryTurn[],
): MixedTimelineFrame[] {
  let cursor = 0
  let previous: MixedTimelineFrame | undefined

  return performedTurns
    .filter((turn) => Boolean(turn.text?.trim()))
    .map((turn, index) => {
      let matchIndex = authoredFrames.findIndex((frame, candidateIndex) =>
        candidateIndex >= cursor && frameMatchesTurn(frame, turn),
      )
      if (matchIndex < 0) {
        matchIndex = authoredFrames.findIndex((frame) => frameMatchesTurn(frame, turn))
      }
      if (matchIndex < 0) {
        matchIndex = authoredFrames.findIndex((frame, candidateIndex) =>
          candidateIndex >= cursor && isUserMixedFrame(frame) === Boolean(turn.isUser),
        )
      }

      const matched = matchIndex >= 0 ? authoredFrames[matchIndex] : undefined
      const base = matched ?? previous ?? authoredFrames[Math.min(cursor, authoredFrames.length - 1)] ?? fallbackFrame(index)
      if (matchIndex >= 0) cursor = matchIndex + 1

      const next: MixedTimelineFrame = {
        ...base,
        index,
        kind: turn.isUser ? 'userInput' : 'line',
        speaker: turn.speaker?.trim() || (turn.isUser ? 'You' : base.speaker),
        text: turn.text.trim(),
        source: turn.isUser ? 'defaultAnswer' : 'ink',
        choices: undefined,
        missingDefaultAnswer: false,
      }
      previous = next
      return next
    })
}

export function buildRepeatDialogueSnapshot(
  frames: MixedTimelineFrame[],
  recordingAssets: Record<string, string>,
  recordingDurationsMs: Record<string, number>,
  learnerLabel: string,
): PerformedStoryTurn[] {
  return frames.map((frame) => {
    const recordingAssetId = recordingAssets[String(frame.index)]
    const recorded = Boolean(recordingAssetId)
    return {
      speaker: isUserMixedFrame(frame) ? learnerLabel : frame.speaker,
      text: frame.text,
      originalText: frame.text,
      isUser: isUserMixedFrame(frame),
      recorded,
      recordingFrameIndex: recorded ? frame.index : undefined,
      recordingDurationMs: recorded ? recordingDurationsMs[String(frame.index)] : undefined,
    }
  })
}

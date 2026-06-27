import {
  estimateMixedFrameDuration,
  type LoopMode,
} from './vn-mixed-preview-player'
import { type MixedTimelineFrame } from './vn-mixed-timeline'

export const NQTR_VIDEO_FPS = 30
export const NQTR_VIDEO_WIDTH = 1920
export const NQTR_VIDEO_HEIGHT = 1080

export interface NqtrVideoTimelineFrame extends MixedTimelineFrame {
  startFrame: number
  endFrame: number
  durationFrames: number
  startSeconds: number
  endSeconds: number
  resolvedAudioUrl?: string
  audioSource: 'tts' | 'userRecording' | 'none'
}

export interface NqtrVideoTimeline {
  frames: NqtrVideoTimelineFrame[]
  durationInFrames: number
  fps: number
  width: number
  height: number
}

export function buildNqtrVideoTimeline(
  frames: MixedTimelineFrame[],
  options: {
    fps?: number
    gapSeconds?: number
    userRecordings?: Record<number, string>
  } = {},
): NqtrVideoTimeline {
  const fps = options.fps ?? NQTR_VIDEO_FPS
  const gapFrames = Math.round((options.gapSeconds ?? 1) * fps)
  let cursor = 0

  const timelineFrames = frames.map((frame) => {
    const userRecordingUrl = options.userRecordings?.[frame.index]
    const resolvedAudioUrl = userRecordingUrl || frame.audioUrl
    const audioSource = userRecordingUrl ? 'userRecording' : frame.audioUrl ? 'tts' : 'none'
    const durationFrames = Math.max(1, Math.round((estimateMixedFrameDuration(frame) / 1000) * fps))
    const startFrame = cursor
    const endFrame = startFrame + durationFrames
    cursor = endFrame + gapFrames

    return {
      ...frame,
      startFrame,
      endFrame,
      durationFrames,
      startSeconds: startFrame / fps,
      endSeconds: endFrame / fps,
      resolvedAudioUrl,
      audioSource,
    } satisfies NqtrVideoTimelineFrame
  })

  return {
    frames: timelineFrames,
    durationInFrames: Math.max(cursor || fps, fps),
    fps,
    width: NQTR_VIDEO_WIDTH,
    height: NQTR_VIDEO_HEIGHT,
  }
}

export function findActiveVideoFrame(
  frames: NqtrVideoTimelineFrame[],
  currentFrame: number,
) {
  if (!frames.length) return null
  return frames.find((frame) => currentFrame >= frame.startFrame && currentFrame < frame.endFrame)
    ?? [...frames].reverse().find((frame) => currentFrame >= frame.startFrame)
    ?? frames[0]
}

export function getLoopCount(mode: LoopMode) {
  return mode === 'infinite' ? undefined : Number(mode)
}

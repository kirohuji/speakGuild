import { AbsoluteFill, Audio, interpolate, Sequence, useCurrentFrame } from 'remotion'
import { cn } from '@/lib/cn'
import {
  findActiveVideoFrame,
  type NqtrVideoTimeline,
  type NqtrVideoTimelineFrame,
} from './nqtr-video-timeline'
import { mixedFrameDisplayText, mixedFrameLabel } from './vn-mixed-preview-player'

interface NqtrVideoCompositionProps {
  timeline: NqtrVideoTimeline
}

function frameProgress(frame: number, item: NqtrVideoTimelineFrame) {
  if (item.durationFrames <= 0) return 1
  return Math.min(1, Math.max(0, (frame - item.startFrame) / item.durationFrames))
}

export function NqtrVideoComposition({ timeline }: NqtrVideoCompositionProps) {
  const frame = useCurrentFrame()
  const active = findActiveVideoFrame(timeline.frames, frame)

  if (!active) {
    return (
      <AbsoluteFill className="items-center justify-center bg-[#090b10] text-white">
        <div className="text-4xl font-semibold">No preview frames</div>
      </AbsoluteFill>
    )
  }

  const progress = frameProgress(frame, active)
  const textOpacity = interpolate(progress, [0, 0.12, 0.88, 1], [0, 1, 1, 0.82], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const spriteScale = interpolate(progress, [0, 1], [1.0, 1.018], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const spriteLeft = active.sprite.position === 'left' ? '28%' : active.sprite.position === 'right' ? '72%' : '50%'

  return (
    <AbsoluteFill className="overflow-hidden bg-[#090b10] text-white">
      {timeline.frames.map((item) =>
        item.resolvedAudioUrl ? (
          <Sequence key={`${item.index}-${item.resolvedAudioUrl}`} from={item.startFrame} durationInFrames={item.durationFrames}>
            <Audio src={item.resolvedAudioUrl} />
          </Sequence>
        ) : null,
      )}

      <AbsoluteFill>
        {active.background.url ? (
          <img
            src={active.background.url}
            className={cn(
              'h-full w-full',
              active.background.fit === 'contain' ? 'object-contain' : active.background.fit === 'stretch' ? 'object-fill' : 'object-cover',
            )}
            alt=""
          />
        ) : (
          <div className="h-full w-full bg-[#111827]" />
        )}
      </AbsoluteFill>

      {active.kind !== 'choice' && active.sprite.url && (
        <div className="pointer-events-none absolute inset-x-0" style={{ bottom: '0%', top: '7%' }}>
          <img
            src={active.sprite.url}
            alt=""
            className="absolute bottom-0 max-h-full select-none object-contain"
            style={{
              maxWidth: '62%',
              left: spriteLeft,
              transform: `translateX(-50%) scale(${spriteScale})`,
              transformOrigin: 'bottom center',
            }}
          />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 via-black/34 to-transparent px-16 pb-10 pt-16" style={{ opacity: textOpacity }}>
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[60px] font-bold text-white/55 [text-shadow:0_0_6px_rgba(0,0,0,.8),0_2px_8px_rgba(0,0,0,.6)]">
              {active.speaker || mixedFrameLabel(active)}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[60px] font-bold leading-[1.18] tracking-normal text-white [text-shadow:0_0_6px_rgba(0,0,0,.8),0_2px_8px_rgba(0,0,0,.6)]">
              {mixedFrameDisplayText(active)}
            </p>
            {active.translation && (
              <p className="mt-4 text-2xl font-bold leading-snug text-white/55 [text-shadow:0_0_4px_rgba(0,0,0,.7),0_1px_4px_rgba(0,0,0,.5)]">{active.translation}</p>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

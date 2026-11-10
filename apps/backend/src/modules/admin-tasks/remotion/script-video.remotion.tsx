import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  interpolate,
  registerRoot,
  Sequence,
  useCurrentFrame,
} from 'remotion';

type Frame = {
  index: number;
  startFrame: number;
  durationFrames: number;
  speaker?: string;
  text?: string;
  translation?: string;
  kind?: string;
  resolvedAudioUrl?: string;
  background?: { url?: string; fit?: 'cover' | 'contain' | 'stretch' };
  sprite?: {
    url?: string;
    avatarUrl?: string;
    position?: 'left' | 'center' | 'right';
  };
};
type Props = {
  timeline: {
    frames: Frame[];
    durationInFrames: number;
    fps: number;
    width?: number;
    height?: number;
  };
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 24;

/** Keep the stage painted even if early beats lack an explicit #bg: tag. */
function withCarriedBackground(frames: Frame[]): Frame[] {
  const seed = frames.find((frame) => frame.background?.url)?.background;
  let last = seed;
  return frames.map((frame) => {
    if (frame.background?.url) {
      last = frame.background;
      return frame;
    }
    return last ? { ...frame, background: { ...last } } : frame;
  });
}

const ScriptVideo = ({ timeline }: Props) => {
  const current = useCurrentFrame();
  const frames = useMemo(() => withCarriedBackground(timeline.frames ?? []), [timeline.frames]);
  const active = frames.find((item) => current >= item.startFrame && current < item.startFrame + item.durationFrames)
    ?? frames.at(-1);
  if (!active) return <AbsoluteFill style={{ backgroundColor: '#090b10' }} />;
  const progress = Math.max(0, Math.min(1, (current - active.startFrame) / Math.max(1, active.durationFrames)));
  // Keep opening readable: avoid a fully transparent first beat that looks like a black flash.
  const opacity = interpolate(progress, [0, .08, .88, 1], [.92, 1, 1, .82], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const position = active.sprite?.position === 'left' ? '28%' : active.sprite?.position === 'right' ? '72%' : '50%';
  const backgroundFit = active.background?.fit === 'stretch' ? 'fill' : active.background?.fit ?? 'cover';
  const spriteUrl = active.kind !== 'choice' ? active.sprite?.url : undefined;
  const avatarUrl = active.sprite?.avatarUrl;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#090b10', color: 'white' }}>
      {frames.map((item) => item.resolvedAudioUrl ? (
        <Sequence key={`${item.index}-${item.resolvedAudioUrl}`} from={item.startFrame} durationInFrames={item.durationFrames}>
          <Audio src={item.resolvedAudioUrl} />
        </Sequence>
      ) : null)}
      <AbsoluteFill>
        {active.background?.url
          ? (
            <Img
              src={active.background.url}
              style={{ width: '100%', height: '100%', objectFit: backgroundFit }}
            />
          )
          : <div style={{ width: '100%', height: '100%', backgroundColor: '#111827' }} />}
      </AbsoluteFill>
      {spriteUrl ? (
        <Img
          src={spriteUrl}
          style={{
            position: 'absolute',
            bottom: 0,
            left: position,
            transform: 'translateX(-50%)',
            maxHeight: '93%',
            maxWidth: '62%',
            objectFit: 'contain',
          }}
        />
      ) : avatarUrl && active.kind !== 'choice' ? (
        // Characters without a full-body sprite still get a stage presence.
        <Img
          src={avatarUrl}
          style={{
            position: 'absolute',
            bottom: '18%',
            left: position,
            transform: 'translateX(-50%)',
            width: 220,
            height: 220,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '6px solid rgba(255,255,255,.35)',
            boxShadow: '0 12px 40px rgba(0,0,0,.45)',
          }}
        />
      ) : null}
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '40px 48px 28px', opacity, background: 'linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.34), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {avatarUrl ? (
            <Img
              src={avatarUrl}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(255,255,255,.4)',
                flexShrink: 0,
              }}
            />
          ) : null}
          <div style={{ fontSize: 36, fontWeight: 700, color: 'rgba(255,255,255,.55)', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{active.speaker || '对白'}</div>
        </div>
        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 40, fontWeight: 700, lineHeight: 1.18, textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{active.text || ''}</div>
        {active.translation && <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>{active.translation}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Root = () => (
  <Composition
    id="ScriptVideo"
    component={ScriptVideo}
    width={DEFAULT_WIDTH}
    height={DEFAULT_HEIGHT}
    fps={DEFAULT_FPS}
    durationInFrames={DEFAULT_FPS}
    defaultProps={{ timeline: { frames: [], durationInFrames: DEFAULT_FPS, fps: DEFAULT_FPS, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT } }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(DEFAULT_FPS, props.timeline.durationInFrames),
      fps: props.timeline.fps || DEFAULT_FPS,
      width: props.timeline.width || DEFAULT_WIDTH,
      height: props.timeline.height || DEFAULT_HEIGHT,
    })}
  />
);

registerRoot(Root);

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Composition,
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
  sprite?: { url?: string; position?: 'left' | 'center' | 'right' };
};
type Props = { timeline: { frames: Frame[]; durationInFrames: number; fps: number } };

const ScriptVideo = ({ timeline }: Props) => {
  const current = useCurrentFrame();
  const active = timeline.frames.find((item) => current >= item.startFrame && current < item.startFrame + item.durationFrames)
    ?? timeline.frames.at(-1);
  if (!active) return <AbsoluteFill style={{ backgroundColor: '#090b10' }} />;
  const progress = Math.max(0, Math.min(1, (current - active.startFrame) / Math.max(1, active.durationFrames)));
  const opacity = interpolate(progress, [0, .12, .88, 1], [0, 1, 1, .82], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const position = active.sprite?.position === 'left' ? '28%' : active.sprite?.position === 'right' ? '72%' : '50%';
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#090b10', color: 'white' }}>
      {timeline.frames.map((item) => item.resolvedAudioUrl ? (
        <Sequence key={`${item.index}-${item.resolvedAudioUrl}`} from={item.startFrame} durationInFrames={item.durationFrames}>
          <Audio src={item.resolvedAudioUrl} />
        </Sequence>
      ) : null)}
      <AbsoluteFill>
        {active.background?.url
          ? <img src={active.background.url} style={{ width: '100%', height: '100%', objectFit: active.background.fit === 'stretch' ? 'fill' : active.background.fit ?? 'cover' }} />
          : <div style={{ width: '100%', height: '100%', backgroundColor: '#111827' }} />}
      </AbsoluteFill>
      {active.kind !== 'choice' && active.sprite?.url && (
        <img src={active.sprite.url} style={{ position: 'absolute', bottom: 0, left: position, transform: 'translateX(-50%)', maxHeight: '93%', maxWidth: '62%', objectFit: 'contain' }} />
      )}
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '64px 64px 40px', opacity, background: 'linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.34), transparent)' }}>
        <div style={{ fontSize: 60, fontWeight: 700, color: 'rgba(255,255,255,.55)', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{active.speaker || '对白'}</div>
        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 60, fontWeight: 700, lineHeight: 1.18, textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{active.text || ''}</div>
        {active.translation && <div style={{ marginTop: 16, fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>{active.translation}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Root = () => (
  <Composition
    id="ScriptVideo"
    component={ScriptVideo}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={30}
    defaultProps={{ timeline: { frames: [], durationInFrames: 30, fps: 30 } }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(30, props.timeline.durationInFrames),
      fps: props.timeline.fps || 30,
    })}
  />
);

registerRoot(Root);

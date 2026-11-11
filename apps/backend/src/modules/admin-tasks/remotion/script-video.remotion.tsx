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

/**
 * Remote/data URLs pass through. Paths like `/sv-…/x.png` were written into the
 * Remotion bundle outdir at render time and are served from the same origin —
 * do not wrap them in staticFile() (that only resolves assets present at bundle).
 */
function resolveRenderAssetUrl(url?: string) {
  if (!url) return undefined;
  if (/^(https?:|data:)/i.test(url)) return url;
  if (url.startsWith('/')) return url;
  return undefined;
}

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

/** Forward-fill only — never pull a later scene's bg onto earlier beats. */
function withCarriedBackground(frames: Frame[]): Frame[] {
  let last: Frame['background'] | undefined;
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
    ?? (current <= (frames[0]?.startFrame ?? 0) ? frames[0] : frames.at(-1));
  if (!active) return <AbsoluteFill style={{ backgroundColor: '#090b10' }} />;
  const progress = Math.max(0, Math.min(1, (current - active.startFrame) / Math.max(1, active.durationFrames)));
  const opacity = interpolate(progress, [0, .08, .88, 1], [1, 1, 1, .9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const position = active.sprite?.position === 'left' ? '28%' : active.sprite?.position === 'right' ? '72%' : '50%';
  const backgroundFit = active.background?.fit === 'stretch' ? 'fill' : active.background?.fit ?? 'cover';
  const backgroundUrl = resolveRenderAssetUrl(active.background?.url);
  const spriteUrl = active.kind !== 'choice' ? resolveRenderAssetUrl(active.sprite?.url) : undefined;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#090b10', color: 'white' }}>
      {frames.map((item) => item.resolvedAudioUrl ? (
        <Sequence key={`${item.index}-${item.resolvedAudioUrl}`} from={item.startFrame} durationInFrames={item.durationFrames}>
          <Audio src={item.resolvedAudioUrl} />
        </Sequence>
      ) : null)}
      <AbsoluteFill>
        {backgroundUrl
          ? (
            <Img
              src={backgroundUrl}
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
      ) : null}
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '40px 48px 28px', opacity, background: 'linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.34), transparent)' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'rgba(255,255,255,.55)', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{active.speaker || '对白'}</div>
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

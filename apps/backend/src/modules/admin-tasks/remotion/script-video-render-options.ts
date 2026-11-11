export type ScriptVideoEngine = 'ffmpeg' | 'remotion';

export type ScriptVideoRenderOptions = {
  engine: ScriptVideoEngine;
  preset: string;
  width: number;
  height: number;
  fps: number;
  /** Remotion only; null means auto. */
  remotionConcurrency: number | null;
};

export const SCRIPT_VIDEO_ENGINE_KEY = 'script_video_engine';
export const SCRIPT_VIDEO_PRESET_KEY = 'script_video_preset';
export const SCRIPT_VIDEO_REMOTION_CONCURRENCY_KEY = 'script_video_remotion_concurrency';

export const SCRIPT_VIDEO_PRESETS: Record<string, { width: number; height: number; fps: number }> = {
  '1280x720@24': { width: 1280, height: 720, fps: 24 },
  '960x540@15': { width: 960, height: 540, fps: 15 },
  '854x480@12': { width: 854, height: 480, fps: 12 },
};

export const DEFAULT_SCRIPT_VIDEO_PRESET = '960x540@15';
export const DEFAULT_SCRIPT_VIDEO_ENGINE: ScriptVideoEngine = 'ffmpeg';

export function parseScriptVideoPreset(raw?: string | null): {
  preset: string;
  width: number;
  height: number;
  fps: number;
} {
  const preset = (raw || '').trim() || DEFAULT_SCRIPT_VIDEO_PRESET;
  const known = SCRIPT_VIDEO_PRESETS[preset];
  if (known) return { preset, ...known };

  const match = preset.match(/^(\d+)x(\d+)@(\d+)$/i);
  if (match) {
    // yuv420p requires even dimensions
    const width = Math.max(160, Number(match[1]) & ~1);
    const height = Math.max(90, Number(match[2]) & ~1);
    return {
      preset,
      width,
      height,
      fps: Math.max(1, Number(match[3])),
    };
  }
  return { preset: DEFAULT_SCRIPT_VIDEO_PRESET, ...SCRIPT_VIDEO_PRESETS[DEFAULT_SCRIPT_VIDEO_PRESET] };
}

export function parseScriptVideoEngine(raw?: string | null): ScriptVideoEngine {
  const value = (raw || '').trim().toLowerCase();
  return value === 'remotion' ? 'remotion' : 'ffmpeg';
}

export function parseRemotionConcurrency(raw?: string | null): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function buildScriptVideoRenderOptions(values: {
  engine?: string | null;
  preset?: string | null;
  remotionConcurrency?: string | null;
}): ScriptVideoRenderOptions {
  const parsed = parseScriptVideoPreset(values.preset);
  return {
    engine: parseScriptVideoEngine(values.engine),
    preset: parsed.preset,
    width: parsed.width,
    height: parsed.height,
    fps: parsed.fps,
    remotionConcurrency: parseRemotionConcurrency(values.remotionConcurrency),
  };
}

export function summarizeScriptVideoFrames(frames: unknown[]) {
  const list = Array.isArray(frames) ? frames : [];
  const withBackground: number[] = [];
  const withSprite: number[] = [];
  const withAudio: number[] = [];
  const withMeasuredDuration: number[] = [];
  for (const frame of list) {
    const item = frame as Record<string, any>;
    const index = Number(item?.index);
    if (!Number.isFinite(index)) continue;
    if (item?.background?.url) withBackground.push(index);
    if (item?.sprite?.url) withSprite.push(index);
    if (item?.resolvedAudioUrl || item?.audioUrl) withAudio.push(index);
    const duration =
      Number(item?.recordingDurationMs)
      || Number(item?.audioDurationMs)
      || Number(item?.ttsDurationMs);
    if (Number.isFinite(duration) && duration > 0) withMeasuredDuration.push(index);
  }
  return {
    frameCount: list.length,
    backgroundCount: withBackground.length,
    spriteCount: withSprite.length,
    audioCount: withAudio.length,
    measuredDurationCount: withMeasuredDuration.length,
    missingBackgroundIndices: list
      .filter((frame: any) => Number.isFinite(Number(frame?.index)) && !frame?.background?.url)
      .map((frame: any) => Number(frame.index))
      .slice(0, 24),
    missingAudioIndices: list
      .filter((frame: any) => {
        const kind = frame?.kind;
        return (kind === 'line' || kind === 'choice' || kind === 'userInput')
          && Boolean(frame?.text)
          && !(frame?.resolvedAudioUrl || frame?.audioUrl);
      })
      .map((frame: any) => Number(frame?.index))
      .filter((index) => Number.isFinite(index))
      .slice(0, 24),
    openingBackground: Boolean((list[0] as any)?.background?.url) ? 'present' : 'missing',
    openingHasAudio: Boolean((list[0] as any)?.resolvedAudioUrl || (list[0] as any)?.audioUrl),
  };
}

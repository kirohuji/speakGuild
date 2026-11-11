import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import sharp = require('sharp');

export type FfmpegRenderProgress = {
  phase: 'compositing' | 'encoding' | 'concat';
  current: number;
  total: number;
};

type RenderFrame = {
  index?: number;
  text?: string;
  speaker?: string;
  translation?: string;
  kind?: string;
  durationFrames?: number;
  audioDurationMs?: number;
  recordingDurationMs?: number;
  resolvedAudioUrl?: string;
  audioUrl?: string;
  fps?: number;
  background?: { url?: string; fit?: 'cover' | 'contain' | 'stretch' };
  sprite?: { url?: string; position?: 'left' | 'center' | 'right' };
};

const CJK_FONT_CANDIDATES = platform() === 'darwin'
  ? [
      '/Library/Fonts/Arial Unicode.ttf',
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
      '/System/Library/Fonts/STHeiti Medium.ttc',
      '/System/Library/Fonts/PingFang.ttc',
    ]
  : [
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
      '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
    ];

let cachedFontFace: { family: string; cssUrl?: string } | null = null;

function resolveCjkFontFace() {
  if (cachedFontFace) return cachedFontFace;
  const path = CJK_FONT_CANDIDATES.find((candidate) => existsSync(candidate));
  if (path) {
    cachedFontFace = {
      family: 'ScriptVideoCJK',
      cssUrl: pathToFileURL(path).href,
    };
    return cachedFontFace;
  }
  cachedFontFace = {
    family: 'PingFang SC, Hiragino Sans GB, Heiti SC, Noto Sans CJK SC, Arial Unicode MS, sans-serif',
  };
  return cachedFontFace;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Mixed EN/CJK wrap: CJK chars count as ~1 unit each, Latin ~0.55. */
function wrapDialogueText(text: string, maxUnits: number) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const paragraphs = normalized.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    let current = '';
    let units = 0;
    const push = () => {
      if (current) lines.push(current);
      current = '';
      units = 0;
    };
    for (const char of paragraph) {
      const charUnits = /[\u3400-\u9fff\uF900-\uFAFF]/.test(char) ? 1 : 0.55;
      if (units + charUnits > maxUnits && current) push();
      current += char;
      units += charUnits;
    }
    push();
  }
  return lines.slice(0, 5);
}

async function runFfmpeg(args: string[], label: string) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => process.kill('SIGKILL'), 120_000);
    process.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    process.once('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`ffmpeg 无法启动（${label}）：${error.message}`));
    });
    process.once('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else {
        const detail = Buffer.concat(errors).toString('utf8').trim().slice(-800);
        reject(new Error(`ffmpeg 失败（${label}，code=${code}）${detail ? `：${detail}` : ''}`));
      }
    });
  });
}

function guessAudioExtension(url: string, contentType?: string | null) {
  const type = (contentType || '').toLowerCase();
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('wav')) return 'wav';
  if (type.includes('webm')) return 'webm';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('flac')) return 'flac';
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac') || type.includes('x-m4a')) return 'm4a';
  const match = url.match(/\.(mp3|wav|webm|m4a|aac|ogg|flac)(?:\?|#|$)/i);
  return (match?.[1] || 'mp3').toLowerCase();
}

async function downloadAudio(url: string, destBase: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`音频下载失败 ${response.status}: ${url.slice(0, 120)}`);
  const ext = guessAudioExtension(url, response.headers.get('content-type'));
  const dest = `${destBase}.${ext}`;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.byteLength) throw new Error(`音频为空: ${url.slice(0, 120)}`);
  await writeFile(dest, buffer);
  return dest;
}

function beatDurationSeconds(frame: RenderFrame, fps: number) {
  const ms = Number(frame.audioDurationMs)
    || Number(frame.recordingDurationMs)
    || (Number(frame.durationFrames) > 0 ? (Number(frame.durationFrames) / fps) * 1000 : 0);
  if (Number.isFinite(ms) && ms > 0) return Math.max(0.2, ms / 1000);
  return Math.max(0.8, (Number(frame.durationFrames) || fps) / fps);
}

async function compositeStill(
  frame: RenderFrame,
  dest: string,
  width: number,
  height: number,
) {
  const layers: Array<{ input: Buffer | string; left: number; top: number }> = [];
  const bgUrl = frame.background?.url;
  if (bgUrl) {
    try {
      const bgInput = bgUrl.startsWith('http')
        ? Buffer.from(await (await fetch(bgUrl)).arrayBuffer())
        : bgUrl;
      const fit = frame.background?.fit === 'contain' ? 'inside'
        : frame.background?.fit === 'stretch' ? 'fill'
          : 'cover';
      const bg = await sharp(bgInput, { failOn: 'none' })
        .resize({ width, height, fit })
        .jpeg({ quality: 72 })
        .toBuffer();
      layers.push({ input: bg, left: 0, top: 0 });
    } catch {
      // fall through to solid fill
    }
  }

  const spriteUrl = frame.kind === 'choice' ? undefined : frame.sprite?.url;
  if (spriteUrl) {
    try {
      const spriteInput = spriteUrl.startsWith('http')
        ? Buffer.from(await (await fetch(spriteUrl)).arrayBuffer())
        : spriteUrl;
      const maxW = Math.round(width * 0.62);
      const maxH = Math.round(height * 0.93);
      const spriteBuf = await sharp(spriteInput, { failOn: 'none' })
        .resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      const meta = await sharp(spriteBuf).metadata();
      const sw = meta.width || maxW;
      const sh = meta.height || maxH;
      const position = frame.sprite?.position || 'center';
      const left = position === 'left'
        ? Math.round(width * 0.28 - sw / 2)
        : position === 'right'
          ? Math.round(width * 0.72 - sw / 2)
          : Math.round((width - sw) / 2);
      layers.push({
        input: spriteBuf,
        left: Math.max(0, Math.min(width - sw, left)),
        top: Math.max(0, height - sh),
      });
    } catch {
      // skip broken sprite
    }
  }

  // Match Remotion ScriptVideo typography: speaker muted, dialogue bold, soft gradient.
  const font = resolveCjkFontFace();
  const fontSpeaker = Math.max(22, Math.round(height * 0.05));
  const fontText = Math.max(28, Math.round(height * 0.056));
  const fontTrans = Math.max(16, Math.round(height * 0.028));
  const padX = Math.round(width * 0.0375);
  const padBottom = Math.round(height * 0.039);
  const textBlockHeight = Math.round(height * 0.32);
  const maxUnits = Math.max(12, Math.floor((width - padX * 2) / (fontText * 0.92)));
  const speaker = escapeXml((frame.speaker || '对白').slice(0, 40));
  const lines = wrapDialogueText(frame.text || '', maxUnits);
  const translation = frame.translation
    ? escapeXml(frame.translation.slice(0, 90))
    : '';
  const speakerY = height - textBlockHeight + fontSpeaker;
  const firstLineY = speakerY + Math.round(fontText * 1.25);
  const lineSvg = lines.map((line, i) => (
    `<text x="${padX}" y="${firstLineY + i * Math.round(fontText * 1.18)}" font-size="${fontText}" font-weight="700" fill="#ffffff" font-family="${font.family}" filter="url(#shadow)">${escapeXml(line)}</text>`
  )).join('');
  const fontFaceCss = font.cssUrl
    ? `@font-face{font-family:'ScriptVideoCJK';src:url('${font.cssUrl}');font-weight:400 700;font-style:normal;}`
    : '';
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css"><![CDATA[
          ${fontFaceCss}
          text { font-family: ${font.family}; }
        ]]></style>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgb(0,0,0)" stop-opacity="0"/>
          <stop offset="40%" stop-color="rgb(0,0,0)" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0.78"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.85)"/>
        </filter>
      </defs>
      <rect x="0" y="${height - textBlockHeight - 24}" width="${width}" height="${textBlockHeight + 24}" fill="url(#g)"/>
      <text x="${padX}" y="${speakerY}" font-size="${fontSpeaker}" font-weight="700" fill="rgba(255,255,255,0.55)" font-family="${font.family}" filter="url(#shadow)">${speaker}</text>
      ${lineSvg}
      ${translation ? `<text x="${padX}" y="${height - padBottom}" font-size="${fontTrans}" font-weight="700" fill="rgba(255,255,255,0.55)" font-family="${font.family}" filter="url(#shadow)">${translation}</text>` : ''}
    </svg>
  `;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  let canvas = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 9, g: 11, b: 16 },
    },
  });
  if (layers.length) canvas = canvas.composite(layers);
  await canvas.jpeg({ quality: 78, mozjpeg: true }).toFile(dest);
}

/**
 * Fast community-clip path: one sharp still per beat → ffmpeg stillimage encode → concat.
 */
export async function renderScriptVideoWithFfmpeg(options: {
  frames: RenderFrame[];
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  jobKey: string;
  onProgress?: (progress: FfmpegRenderProgress) => void | Promise<void>;
}) {
  const { frames, outputPath, width, height, fps, jobKey } = options;
  if (!frames.length) throw new Error('没有可渲染的视频帧');

  const workDir = join(tmpdir(), `sv-ffmpeg-${jobKey}`);
  await mkdir(workDir, { recursive: true });
  const clipPaths: string[] = [];

  try {
    for (let i = 0; i < frames.length; i += 1) {
      const frame = frames[i];
      await options.onProgress?.({ phase: 'compositing', current: i + 1, total: frames.length });
      const stillPath = join(workDir, `still-${i}.jpg`);
      const clipPath = join(workDir, `clip-${i}.mp4`);
      const audioUrl = frame.resolvedAudioUrl || frame.audioUrl;
      const durationSec = beatDurationSeconds(frame, fps);

      await compositeStill(frame, stillPath, width, height);

      await options.onProgress?.({ phase: 'encoding', current: i + 1, total: frames.length });

      // Normalize every clip to the same H.264 + AAC 44.1kHz mono so concat -c copy
      // does not produce garbled audio when TTS/recording formats differ.
      const commonVideoAudio = [
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-r', String(fps),
        '-c:a', 'aac',
        '-ar', '44100',
        '-ac', '1',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-preset', 'ultrafast',
        '-crf', '28',
      ];

      if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
        const audioPath = await downloadAudio(audioUrl, join(workDir, `audio-${i}`));
        // Follow the audio stream length — do not also force -t or a wrong
        // client hint can clip speech mid-word.
        await runFfmpeg([
          '-y',
          '-hide_banner', '-loglevel', 'error',
          '-loop', '1',
          '-framerate', String(fps),
          '-i', stillPath,
          '-i', audioPath,
          ...commonVideoAudio,
          '-shortest',
          clipPath,
        ], `beat-${i}`);
      } else {
        await runFfmpeg([
          '-y',
          '-hide_banner', '-loglevel', 'error',
          '-loop', '1',
          '-framerate', String(fps),
          '-i', stillPath,
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
          ...commonVideoAudio,
          '-t', durationSec.toFixed(3),
          '-shortest',
          clipPath,
        ], `silent-beat-${i}`);
      }
      clipPaths.push(clipPath);
    }

    await options.onProgress?.({ phase: 'concat', current: frames.length, total: frames.length });
    if (clipPaths.length === 1) {
      await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', clipPaths[0],
        '-c', 'copy',
        outputPath,
      ], 'copy-single');
    } else {
      const listPath = join(workDir, 'concat.txt');
      await writeFile(
        listPath,
        clipPaths.map((path) => `file '${path.replace(/'/g, `'\\''`)}'`).join('\n'),
        'utf8',
      );
      // Re-encode once at the end for safer A/V continuity across stillimage clips.
      await runFfmpeg([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-ar', '44100',
        '-ac', '1',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-preset', 'ultrafast',
        '-crf', '28',
        outputPath,
      ], 'concat');
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

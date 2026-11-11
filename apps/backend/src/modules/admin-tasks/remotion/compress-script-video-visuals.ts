import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Nest compiles to CJS — match file-assets.service.ts so sharp is callable.
import sharp = require('sharp');

type VisualKind = 'background' | 'sprite';

export type CompressScriptVideoVisualsResult = {
  frames: any[];
  /** Absolute dir holding compressed assets; delete after render. */
  publicDir: string;
  /** Remotion public URL prefix, e.g. `/sv-abc123`. Empty for absolute-path mode. */
  publicUrlPrefix: string;
  /** Map of original remote URL → local absolute path (always filled). */
  absolutePaths: Map<string, string>;
  cleanup: () => Promise<void>;
  stats: {
    unique: number;
    compressed: number;
    failed: number;
    totalKb: number;
  };
};

/**
 * Download remote stills and downscale them.
 * - Background → JPEG (opaque, smaller)
 * - Sprite → PNG (keep alpha)
 *
 * Remotion mode writes under the bundle serve root and rewrites frame URLs to
 * `/sv-…/file.ext`. FFmpeg mode writes to a temp dir and rewrites to absolute paths.
 */
export async function compressScriptVideoVisuals(
  frames: any[],
  options: {
    /** Remotion bundle output directory returned by `bundle()`. */
    serveRoot?: string;
    /** Unique per render job so concurrent workers do not collide. */
    jobKey: string;
    /** Absolute output directory for FFmpeg / absolute-path mode. */
    outputDir?: string;
    maxWidth?: number;
    maxHeight?: number;
  },
): Promise<CompressScriptVideoVisualsResult> {
  const maxWidth = Math.max(160, options.maxWidth ?? 960);
  const maxHeight = Math.max(90, options.maxHeight ?? 540);
  const maxSize: Record<VisualKind, { width: number; height: number }> = {
    background: { width: maxWidth, height: maxHeight },
    sprite: {
      width: Math.round(maxWidth * 0.62),
      height: Math.round(maxHeight * 0.93),
    },
  };

  const useRemotionPublic = Boolean(options.serveRoot);
  const publicUrlPrefix = useRemotionPublic
    ? `/sv-${options.jobKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'job'}`
    : '';
  const publicDir = useRemotionPublic
    ? join(options.serveRoot!, publicUrlPrefix.replace(/^\//, ''))
    : (options.outputDir || join(tmpdir(), `sv-visuals-${options.jobKey}`));
  await mkdir(publicDir, { recursive: true });

  // Dedupe by URL first — 4 frames often share 1 bg + 1 sprite.
  const jobs = new Map<string, { url: string; kind: VisualKind }>();
  for (const frame of frames) {
    const backgroundUrl = typeof frame?.background?.url === 'string' ? frame.background.url : undefined;
    const spriteUrl = typeof frame?.sprite?.url === 'string' ? frame.sprite.url : undefined;
    if (backgroundUrl?.startsWith('http')) {
      jobs.set(`background:${backgroundUrl}`, { url: backgroundUrl, kind: 'background' });
    }
    if (spriteUrl?.startsWith('http')) {
      jobs.set(`sprite:${spriteUrl}`, { url: spriteUrl, kind: 'sprite' });
    }
  }

  const resolved = new Map<string, string>();
  const absolutePaths = new Map<string, string>();
  let compressed = 0;
  let failed = 0;
  let totalBytes = 0;
  await Promise.all([...jobs.entries()].map(async ([key, job]) => {
    try {
      const response = await fetch(job.url);
      if (!response.ok) throw new Error(`visual fetch ${response.status}`);
      const input = Buffer.from(await response.arrayBuffer());
      const max = maxSize[job.kind];
      const pipeline = sharp(input, { failOn: 'none' })
        .rotate()
        .resize({
          width: max.width,
          height: max.height,
          fit: 'inside',
          withoutEnlargement: true,
        });
      const output = job.kind === 'background'
        ? await pipeline.jpeg({ quality: 70, mozjpeg: true }).toBuffer()
        : await pipeline.png({ compressionLevel: 8, effort: 8 }).toBuffer();

      const ext = job.kind === 'background' ? 'jpg' : 'png';
      const filename = `${createHash('sha1').update(key).digest('hex')}.${ext}`;
      const absolutePath = join(publicDir, filename);
      await writeFile(absolutePath, output);
      totalBytes += output.byteLength;
      absolutePaths.set(key, absolutePath);
      // Remotion: leading-slash public URL. FFmpeg: absolute filesystem path.
      resolved.set(key, useRemotionPublic ? `${publicUrlPrefix}/${filename}` : absolutePath);
      compressed += 1;
    } catch (error) {
      failed += 1;
      console.warn('[script-video] visual compress failed; keeping remote url', {
        kind: job.kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }));

  const stats = {
    unique: jobs.size,
    compressed,
    failed,
    totalKb: Math.round(totalBytes / 1024),
  };
  console.log('[script-video] visual compress summary', {
    ...stats,
    publicDir,
    publicUrlPrefix: publicUrlPrefix || '(absolute)',
    maxWidth,
    maxHeight,
    reusedAcrossFrames: Math.max(0, frames.length * 2 - jobs.size),
  });

  const nextFrames = frames.map((frame) => {
    const backgroundUrl = typeof frame?.background?.url === 'string' ? frame.background.url : undefined;
    const spriteUrl = typeof frame?.sprite?.url === 'string' ? frame.sprite.url : undefined;
    const localBg = backgroundUrl ? resolved.get(`background:${backgroundUrl}`) : undefined;
    const localSprite = spriteUrl ? resolved.get(`sprite:${spriteUrl}`) : undefined;
    return {
      ...frame,
      background: frame.background && localBg
        ? { ...frame.background, url: localBg }
        : frame.background,
      sprite: frame.sprite && localSprite
        ? { ...frame.sprite, url: localSprite }
        : frame.sprite,
    };
  });

  return {
    frames: nextFrames,
    publicDir,
    publicUrlPrefix,
    absolutePaths,
    cleanup: async () => {
      await rm(publicDir, { recursive: true, force: true }).catch(() => undefined);
    },
    stats,
  };
}

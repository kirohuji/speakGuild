import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { AdminTaskStatus, FileAssetGroup, ScriptWorkStatus } from '@prisma/client';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import type { Job } from 'bullmq';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FileAssetsService } from '../../file-assets/file-assets.service';
import { AdminTasksService } from '../admin-tasks.service';
import { SCRIPT_VIDEO_QUEUE, SCRIPT_VIDEO_RENDER_JOB, NARRATIVE_VIDEO_RENDER_JOB } from '../admin-tasks.constants';
import { compressScriptVideoVisuals } from '../remotion/compress-script-video-visuals';
import { renderScriptVideoWithFfmpeg } from '../remotion/script-video-ffmpeg.render';
import { type ScriptVideoRenderOptions } from '../remotion/script-video-render-options';

@Injectable()
@Processor(SCRIPT_VIDEO_QUEUE, { concurrency: 1 })
export class ScriptVideoRenderProcessor extends WorkerHost {
  private bundleUrl?: Promise<string>;
  private browserReady?: Promise<string | undefined>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileAssetsService,
    private readonly tasks: AdminTasksService,
  ) { super(); }

  private getBundle() {
    const sourceEntry = join(__dirname, '..', 'remotion', 'script-video.remotion.tsx');
    const compiledEntry = join(__dirname, '..', 'remotion', 'script-video.remotion.js');
    this.bundleUrl ??= bundle({
      entryPoint: existsSync(sourceEntry) ? sourceEntry : compiledEntry,
      webpackOverride: (config) => config,
    });
    return this.bundleUrl;
  }

  private getBrowserExecutable() {
    const configuredExecutable = process.env.REMOTION_CHROME_EXECUTABLE?.trim();
    if (configuredExecutable) return configuredExecutable;

    const winRelativePath = join(
      '.cache',
      'remotion',
      'chrome-149-win64',
      'chrome-headless-shell-win64',
      'chrome-headless-shell.exe',
    );
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    const localCandidates = [
      join(process.cwd(), winRelativePath),
      join(process.cwd(), '..', '..', winRelativePath),
      ...(platform() === 'darwin' ? macCandidates : []),
    ];

    return localCandidates.find((candidate) => existsSync(candidate));
  }

  private async resolveBrowserExecutable() {
    this.browserReady ??= (async () => {
      const local = this.getBrowserExecutable();
      if (local) return local;
      // On macOS/Linux without a pinned binary, let Remotion download/cache Chromium.
      await ensureBrowser();
      return undefined;
    })();
    return this.browserReady;
  }

  /** Always read live admin settings so force-run / retry pick up engine changes. */
  private async resolveRenderOptions(_jobData: any): Promise<ScriptVideoRenderOptions> {
    return this.tasks.getScriptVideoRenderOptions();
  }

  async process(job: Job<any>) {
    if (job.name === NARRATIVE_VIDEO_RENDER_JOB) {
      return this.processNarrativeVideo(job);
    }
    if (job.name !== SCRIPT_VIDEO_RENDER_JOB) return null;
    const { taskId, workId, userId, frames } = job.data;
    const output = join(tmpdir(), `script-video-${taskId}.mp4`);
    let cleanupVisuals: (() => Promise<void>) | undefined;
    try {
      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      const renderOptions = await this.resolveRenderOptions(job.data);
      if (!await this.tasks.markRunning(taskId, 'preparing-media')) return { canceled: true };
      await this.tasks.log(
        taskId,
        'info',
        `开始处理 · 引擎=${renderOptions.engine} · ${renderOptions.width}x${renderOptions.height}@${renderOptions.fps} · 帧数=${frames?.length ?? 0}`,
        { step: 'preparing-media', meta: { workId, userId, renderOptions } },
      );

      let renderFrames = frames ?? [];
      if (renderOptions.engine === 'ffmpeg') {
        await this.prisma.adminTask.updateMany({
          where: { id: taskId, status: { not: 'canceled' } },
          data: { progress: 5, currentStep: 'compressing-visuals' },
        });
        await this.tasks.log(taskId, 'info', '压缩背景 JPEG / 立绘 PNG…', { step: 'compressing-visuals' });
        const compressed = await compressScriptVideoVisuals(renderFrames, {
          jobKey: String(taskId),
          outputDir: join(tmpdir(), `sv-visuals-${taskId}`),
          maxWidth: renderOptions.width,
          maxHeight: renderOptions.height,
        });
        cleanupVisuals = compressed.cleanup;
        renderFrames = compressed.frames;
        await this.tasks.log(
          taskId,
          'info',
          `视觉压缩完成 · 成功 ${compressed.stats.compressed}/${compressed.stats.unique} · ${compressed.stats.totalKb}KB`,
          { step: 'compressing-visuals', meta: compressed.stats },
        );

        if (await this.tasks.isCanceled(taskId)) return { canceled: true };
        await this.prisma.adminTask.updateMany({
          where: { id: taskId, status: { not: 'canceled' } },
          data: { progress: 12, currentStep: 'rendering-ffmpeg' },
        });
        await this.tasks.log(
          taskId,
          'info',
          `FFmpeg 静帧合成开始 · ${renderFrames.length} 拍`,
          { step: 'rendering-ffmpeg', meta: { width: renderOptions.width, height: renderOptions.height, fps: renderOptions.fps } },
        );

        let lastProgress = -1;
        await renderScriptVideoWithFfmpeg({
          frames: renderFrames,
          outputPath: output,
          width: renderOptions.width,
          height: renderOptions.height,
          fps: renderOptions.fps,
          jobKey: String(taskId),
          onProgress: async ({ phase, current, total }) => {
            const base = phase === 'compositing' ? 12 : phase === 'encoding' ? 35 : 88;
            const span = phase === 'compositing' ? 20 : phase === 'encoding' ? 50 : 6;
            const value = Math.min(94, base + Math.round((current / Math.max(1, total)) * span));
            if (value === lastProgress) return;
            lastProgress = value;
            await this.prisma.adminTask.updateMany({
              where: { id: taskId, status: { not: 'canceled' } },
              data: {
                progress: value,
                currentStep: `rendering-ffmpeg:${phase} ${current}/${total}`,
                processedItems: current,
              },
            });
            await job.updateProgress(value);
          },
        });
      } else {
        const browserExecutable = await this.resolveBrowserExecutable();
        await this.prisma.adminTask.updateMany({
          where: { id: taskId, status: { not: 'canceled' } },
          data: { progress: 2, currentStep: 'bundling' },
        });
        await this.tasks.log(taskId, 'info', '准备 Remotion bundle…', { step: 'bundling' });
        const serveUrl = await this.getBundle();
        await this.prisma.adminTask.updateMany({
          where: { id: taskId, status: { not: 'canceled' } },
          data: { progress: 5, currentStep: 'compressing-visuals' },
        });
        await this.tasks.log(taskId, 'info', '压缩背景 JPEG / 立绘 PNG（写入 Remotion serve root）…', {
          step: 'compressing-visuals',
        });
        const compressed = await compressScriptVideoVisuals(renderFrames, {
          serveRoot: serveUrl,
          jobKey: String(taskId),
          maxWidth: renderOptions.width,
          maxHeight: renderOptions.height,
        });
        cleanupVisuals = compressed.cleanup;
        renderFrames = compressed.frames;
        await this.tasks.log(
          taskId,
          'info',
          `视觉压缩完成 · 成功 ${compressed.stats.compressed}/${compressed.stats.unique} · ${compressed.stats.totalKb}KB`,
          { step: 'compressing-visuals', meta: { ...compressed.stats, publicUrlPrefix: compressed.publicUrlPrefix } },
        );

        await this.prisma.adminTask.updateMany({
          where: { id: taskId, status: { not: 'canceled' } },
          data: { progress: 8, currentStep: 'initializing-renderer' },
        });
        const fps = renderOptions.fps || Number(renderFrames?.[0]?.fps) || 24;
        const inputProps = {
          timeline: {
            frames: renderFrames.map((frame: any) => ({ ...frame, fps })),
            durationInFrames: renderFrames.at(-1)?.endFrame ?? fps,
            fps,
            width: renderOptions.width,
            height: renderOptions.height,
          },
        };
        await this.tasks.log(
          taskId,
          'info',
          `初始化 Remotion · ${renderOptions.width}x${renderOptions.height}@${fps} · concurrency=${renderOptions.remotionConcurrency ?? 'auto'}`,
          {
            step: 'initializing-renderer',
            meta: {
              frameCount: renderFrames?.length ?? 0,
              browserExecutable: browserExecutable || 'remotion-default',
              sampleBackground: renderFrames?.[0]?.background?.url,
              sampleSprite: renderFrames?.[0]?.sprite?.url,
              sampleAudio: renderFrames?.[0]?.resolvedAudioUrl || renderFrames?.[0]?.audioUrl,
            },
          },
        );
        console.log('[script-video] initializing remotion renderer', {
          taskId,
          workId,
          renderOptions,
          frameCount: renderFrames?.length ?? 0,
          publicUrlPrefix: compressed.publicUrlPrefix,
          browserExecutable: browserExecutable || 'remotion-default',
        });
        const composition = await selectComposition({ serveUrl, id: 'ScriptVideo', inputProps, browserExecutable });
        await this.prisma.adminTask.updateMany({
          where: { id: taskId, status: { not: 'canceled' } },
          data: { progress: 10, currentStep: 'rendering-remotion' },
        });
        await this.tasks.log(taskId, 'info', 'Remotion renderMedia 开始…', { step: 'rendering-remotion' });
        let lastProgress = -1;
        await renderMedia({
          serveUrl,
          composition,
          codec: 'h264',
          x264Preset: 'ultrafast',
          crf: 28,
          concurrency: renderOptions.remotionConcurrency,
          outputLocation: output,
          inputProps,
          browserExecutable,
          onProgress: ({ progress }) => {
            const value = Math.min(95, 10 + Math.round(progress * 85));
            if (value === lastProgress) return;
            lastProgress = value;
            void this.prisma.adminTask.updateMany({
              where: { id: taskId, status: { not: 'canceled' } },
              data: { progress: value, currentStep: 'rendering-remotion', processedItems: value },
            });
            void job.updateProgress(value);
          },
        });
      }

      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      await this.prisma.adminTask.updateMany({
        where: { id: taskId, status: { not: 'canceled' } },
        data: { progress: 96, currentStep: 'uploading' },
      });
      await this.tasks.log(taskId, 'info', '上传成片到对象存储…', { step: 'uploading' });
      const buffer = await readFile(output);
      const asset = await this.files.createAssetFromBuffer({
        buffer,
        filename: `${workId}.mp4`,
        mimeType: 'video/mp4',
        group: FileAssetGroup.user_recording,
      });
      await this.files.createReference(userId, { assetId: asset.id, bizType: 'script_work', bizId: workId });
      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      const published = await this.prisma.$transaction(async (tx) => {
        const task = await tx.adminTask.updateMany({
          where: {
            id: taskId,
            status: { in: [AdminTaskStatus.queued, AdminTaskStatus.running] },
          },
          data: {
            status: AdminTaskStatus.completed,
            progress: 100,
            currentStep: 'completed',
            summary: {
              workId,
              videoAssetId: asset.id,
              renderOptions,
              engine: renderOptions.engine,
              bytes: buffer.byteLength,
            },
            finishedAt: new Date(),
          },
        });
        if (task.count === 0) return false;
        await tx.scriptWork.update({
          where: { id: workId },
          data: {
            videoAssetId: asset.id,
            status: ScriptWorkStatus.ready,
            publishedAt: null,
            hiddenAt: null,
            renderError: null,
          },
        });
        return true;
      });
      if (!published) return { canceled: true };
      await this.tasks.log(
        taskId,
        'info',
        `完成 · 引擎=${renderOptions.engine} · 资源=${asset.id} · ${Math.round(buffer.byteLength / 1024)}KB`,
        { step: 'completed', meta: { videoAssetId: asset.id, renderOptions } },
      );
      return { workId, videoAssetId: asset.id, engine: renderOptions.engine };
    } catch (error) {
      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      await this.prisma.scriptWork.updateMany({
        where: { id: workId, userId },
        data: { status: ScriptWorkStatus.failed, renderError: error instanceof Error ? error.message : String(error) },
      });
      await this.tasks.markFailed(taskId, error);
      throw error;
    } finally {
      await cleanupVisuals?.().catch(() => undefined);
      await rm(output, { force: true }).catch(() => undefined);
    }
  }

  private async processNarrativeVideo(job: Job<any>) {
    const { taskId, userId, frames } = job.data;
    const output = join(tmpdir(), `narrative-video-${taskId}.mp4`);
    try {
      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      const browserExecutable = await this.resolveBrowserExecutable();
      if (!await this.tasks.markRunning(taskId, 'bundling')) return { canceled: true };
      await this.prisma.adminTask.updateMany({
        where: { id: taskId, status: { not: 'canceled' } },
        data: { progress: 2, currentStep: 'bundling' },
      });
      const serveUrl = await this.getBundle();
      await this.prisma.adminTask.updateMany({
        where: { id: taskId, status: { not: 'canceled' } },
        data: { progress: 6, currentStep: 'initializing-renderer' },
      });
      const fps = Number(frames?.[0]?.fps) || 24;
      const inputProps = {
        timeline: {
          frames,
          durationInFrames: frames.at(-1)?.endFrame ?? fps,
          fps,
          width: 1280,
          height: 720,
        },
      };
      console.log('[narrative-video] initializing renderer', {
        taskId,
        frameCount: frames?.length ?? 0,
        fps,
        size: '1280x720',
        browserExecutable: browserExecutable || 'remotion-default',
        sampleAudio: frames?.[0]?.resolvedAudioUrl || frames?.[0]?.audioUrl,
      });
      const composition = await selectComposition({ serveUrl, id: 'ScriptVideo', inputProps, browserExecutable });
      await this.prisma.adminTask.updateMany({
        where: { id: taskId, status: { not: 'canceled' } },
        data: { progress: 10, currentStep: 'rendering' },
      });
      let lastProgress = -1;
      await renderMedia({
        serveUrl,
        composition,
        codec: 'h264',
        x264Preset: 'ultrafast',
        crf: 28,
        concurrency: null,
        outputLocation: output,
        inputProps,
        browserExecutable,
        onProgress: ({ progress }) => {
          const value = Math.min(95, Math.round(progress * 95));
          if (value === lastProgress) return;
          lastProgress = value;
          void this.prisma.adminTask.updateMany({
            where: { id: taskId, status: { not: 'canceled' } },
            data: { progress: value, currentStep: 'rendering', processedItems: value },
          });
          void job.updateProgress(value);
        },
      });
      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      await this.prisma.adminTask.updateMany({
        where: { id: taskId, status: { not: 'canceled' } },
        data: { progress: 96, currentStep: 'uploading' },
      });
      const buffer = await readFile(output);
      const asset = await this.files.createAssetFromBuffer({
        buffer,
        filename: `narrative-video-${taskId}.mp4`,
        mimeType: 'video/mp4',
        group: FileAssetGroup.user_recording,
      });
      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      await this.tasks.markCompleted(taskId, { videoAssetId: asset.id });
      return { taskId, videoAssetId: asset.id };
    } catch (error) {
      if (await this.tasks.isCanceled(taskId)) return { canceled: true };
      await this.tasks.markFailed(taskId, error);
      throw error;
    } finally {
      await rm(output, { force: true }).catch(() => undefined);
    }
  }
}

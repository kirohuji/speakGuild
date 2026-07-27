import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { FileAssetGroup, ScriptWorkStatus } from '@prisma/client';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { Job } from 'bullmq';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FileAssetsService } from '../../file-assets/file-assets.service';
import { AdminTasksService } from '../admin-tasks.service';
import { SCRIPT_VIDEO_QUEUE, SCRIPT_VIDEO_RENDER_JOB } from '../admin-tasks.constants';

@Injectable()
@Processor(SCRIPT_VIDEO_QUEUE, { concurrency: 1 })
export class ScriptVideoRenderProcessor extends WorkerHost {
  private bundleUrl?: Promise<string>;

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

  async process(job: Job<any>) {
    if (job.name !== SCRIPT_VIDEO_RENDER_JOB) return null;
    const { taskId, workId, userId, frames } = job.data;
    const output = join(tmpdir(), `script-video-${taskId}.mp4`);
    try {
      const browserExecutable = process.env.REMOTION_CHROME_EXECUTABLE?.trim() || undefined;
      await this.tasks.markRunning(taskId, 'bundling');
      const serveUrl = await this.getBundle();
      const inputProps = { timeline: { frames, durationInFrames: frames.at(-1)?.endFrame ?? 30, fps: 30 } };
      const composition = await selectComposition({ serveUrl, id: 'ScriptVideo', inputProps, browserExecutable });
      let lastProgress = -1;
      await renderMedia({
        serveUrl,
        composition,
        codec: 'h264',
        outputLocation: output,
        inputProps,
        browserExecutable,
        onProgress: ({ progress }) => {
          const value = Math.min(95, Math.round(progress * 95));
          if (value === lastProgress) return;
          lastProgress = value;
          void this.prisma.adminTask.update({
            where: { id: taskId },
            data: { progress: value, currentStep: 'rendering', processedItems: value },
          });
          void job.updateProgress(value);
        },
      });
      await this.prisma.adminTask.update({ where: { id: taskId }, data: { progress: 96, currentStep: 'uploading' } });
      const buffer = await readFile(output);
      const asset = await this.files.createAssetFromBuffer({
        buffer,
        filename: `${workId}.mp4`,
        mimeType: 'video/mp4',
        group: FileAssetGroup.user_recording,
      });
      await this.files.createReference(userId, { assetId: asset.id, bizType: 'script_work', bizId: workId });
      await this.prisma.scriptWork.update({
        where: { id: workId },
        data: {
          videoAssetId: asset.id,
          status: ScriptWorkStatus.published,
          publishedAt: new Date(),
          hiddenAt: null,
          renderError: null,
        },
      });
      await this.tasks.markCompleted(taskId, { workId, videoAssetId: asset.id });
      return { workId, videoAssetId: asset.id };
    } catch (error) {
      await this.prisma.scriptWork.updateMany({
        where: { id: workId, userId },
        data: { status: ScriptWorkStatus.failed, renderError: error instanceof Error ? error.message : String(error) },
      });
      await this.tasks.markFailed(taskId, error);
      throw error;
    } finally {
      await rm(output, { force: true }).catch(() => undefined);
    }
  }
}

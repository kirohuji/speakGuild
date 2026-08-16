import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ADMIN_CONTENT_QUEUE, CONTENT_PREPARE_JOB, WARMUP_PIPELINE_GENERATE_JOB, SCENE_TOPIC_BATCH_GENERATE_JOB, FILE_ASSET_INSPECT_JOB, FILE_ASSET_CLEANUP_JOB, DICTIONARY_PRONUNCIATION_BATCH_REFRESH_JOB } from '../admin-tasks.constants';
import { AdminTasksService } from '../admin-tasks.service';
import { ContentPrepareService } from '../jobs/content-prepare.service';
import { WarmupPipelineGenerateService } from '../jobs/warmup-pipeline-generate.service';
import { SceneTopicBatchGenerateService } from '../jobs/scene-topic-batch-generate.service';
import { FileAssetMaintenanceService } from '../../file-assets/file-asset-maintenance.service';
import { DictionaryService } from '../../dictionary/dictionary.service';

const THROTTLE_WAIT_MS = 30_000;

function isProviderRateLimited(error: unknown) {
  const value = error as any;
  return value?.status === 423 || value?.status === 429
    || value?.response?.status === 423 || value?.response?.status === 429
    || value?.cause?.status === 423 || value?.cause?.status === 429
    || /(?:^|\D)(?:423|429)(?:\D|$)/.test(String(value?.message ?? ''));
}

@Processor(ADMIN_CONTENT_QUEUE, { concurrency: 3 })
export class ContentPrepareProcessor extends WorkerHost {
  constructor(
    private readonly contentPrepareService: ContentPrepareService,
    private readonly adminTasksService: AdminTasksService,
    private readonly warmupPipelineGenerateService: WarmupPipelineGenerateService,
    private readonly sceneTopicBatchGenerateService: SceneTopicBatchGenerateService,
    private readonly fileAssetMaintenance: FileAssetMaintenanceService,
    private readonly dictionaryService: DictionaryService,
  ) {
    super();
  }

  async process(job: Job<{
    taskId: string;
    sceneId?: string;
    topicId?: string;
    createdById?: string;
    retryItems?: {
      vocabulary?: string[];
      chunk?: string[];
      pattern?: string[];
    };
    minAgeDays?: number;
    candidateIds?: string[];
    words?: string[];
  }>): Promise<unknown> {
    try {
      if (job.name === DICTIONARY_PRONUNCIATION_BATCH_REFRESH_JOB) {
        return await this.refreshDictionaryPronunciations(job.data.taskId, job.data.words ?? [], job);
      }
      if (job.name === FILE_ASSET_INSPECT_JOB) {
        if (!await this.adminTasksService.markRunning(job.data.taskId, 'inspect')) return null;
        const summary = await this.fileAssetMaintenance.inspectUnused(job.data.minAgeDays ?? 7);
        await this.adminTasksService.markCompleted(job.data.taskId, summary);
        return summary;
      }
      if (job.name === FILE_ASSET_CLEANUP_JOB) {
        if (!await this.adminTasksService.markRunning(job.data.taskId, 'recheck-and-clean')) return null;
        const pendingPurges = await this.fileAssetMaintenance.retryPendingPurges();
        const cleanup = await this.fileAssetMaintenance.purgeCheckedCandidates(job.data.candidateIds ?? []);
        const summary = { ...cleanup, pendingPurges };
        await this.adminTasksService.markCompleted(job.data.taskId, summary);
        return summary;
      }
      if (job.name === WARMUP_PIPELINE_GENERATE_JOB && job.data.topicId) {
        return await this.warmupPipelineGenerateService.run(job.data.taskId, job.data.topicId, job.data.createdById);
      }
      if (job.name === SCENE_TOPIC_BATCH_GENERATE_JOB && job.data.sceneId) {
        return await this.sceneTopicBatchGenerateService.run(job.data.taskId, job.data.sceneId, job.data.createdById);
      }
      if (job.name !== CONTENT_PREPARE_JOB) return null;
      return await this.contentPrepareService.run(job.data.taskId, job.data.sceneId!, {
        reportProgress: (progress) => job.updateProgress(progress),
        retryItems: job.data.retryItems,
      });
    } catch (error) {
      await this.adminTasksService.markFailed(job.data.taskId, error);
      throw error;
    }
  }

  private async refreshDictionaryPronunciations(taskId: string, words: string[], job: Job) {
    if (!await this.adminTasksService.markRunning(taskId, 'refresh')) return null;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ word: string; message: string }> = [];

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      if (await this.adminTasksService.isCanceled(taskId)) return null;
      if (await this.dictionaryService.isPronunciationLocked(word)) {
        skipped += 1;
        await this.adminTasksService.log(taskId, 'info', `${word} 已确认锁定，跳过检查`, { step: 'refresh', meta: { word, skipped: true } });
        await this.adminTasksService.setProgress(taskId, {
          currentStep: `refresh:${word}（已锁定，跳过）`, totalItems: words.length,
          processedItems: index + 1, successItems: succeeded, failedItems: failed,
        });
        continue;
      }

      for (;;) {
        try {
          await this.dictionaryService.refreshPronunciation(word, 'auto', 'all', { surfaceProviderRateLimit: true });
          succeeded += 1;
          await this.adminTasksService.log(taskId, 'info', `${word} 音标已更新`, { step: 'refresh', meta: { word } });
          break;
        } catch (error) {
          if (!isProviderRateLimited(error)) {
            failed += 1;
            const message = error instanceof Error ? error.message : String(error);
            errors.push({ word, message });
            await this.adminTasksService.log(taskId, 'error', `${word} 更新失败：${message}`, { step: 'refresh', meta: { word } });
            break;
          }
          await this.adminTasksService.setProgress(taskId, {
            currentStep: `throttled:${word}（423/429 限流，30 秒后重试）`, totalItems: words.length,
            processedItems: index, successItems: succeeded, failedItems: failed,
          });
          await this.adminTasksService.log(taskId, 'warn', `${word} 遇到 423/429 限流，等待 30 秒后重试`, { step: 'throttled', meta: { word, retryAfterMs: THROTTLE_WAIT_MS } });
          await new Promise((resolve) => setTimeout(resolve, THROTTLE_WAIT_MS));
          if (await this.adminTasksService.isCanceled(taskId)) return null;
        }
      }
      await this.adminTasksService.setProgress(taskId, {
        currentStep: `refresh:${word} (${index + 1}/${words.length})`, totalItems: words.length,
        processedItems: index + 1, successItems: succeeded, failedItems: failed,
      });
      await job.updateProgress(Math.floor(((index + 1) / words.length) * 100));
    }

    const summary = { total: words.length, succeeded, failed, skipped, errors };
    await this.adminTasksService.markCompleted(taskId, summary);
    await this.adminTasksService.log(taskId, failed ? 'warn' : 'info', `音标批量检查完成：${succeeded} 成功，${failed} 失败`, { step: 'completed', meta: summary });
    return summary;
  }
}

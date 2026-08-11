import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ADMIN_CONTENT_QUEUE, CONTENT_PREPARE_JOB, WARMUP_PIPELINE_GENERATE_JOB, SCENE_TOPIC_BATCH_GENERATE_JOB, FILE_ASSET_INSPECT_JOB, FILE_ASSET_CLEANUP_JOB } from '../admin-tasks.constants';
import { AdminTasksService } from '../admin-tasks.service';
import { ContentPrepareService } from '../jobs/content-prepare.service';
import { WarmupPipelineGenerateService } from '../jobs/warmup-pipeline-generate.service';
import { SceneTopicBatchGenerateService } from '../jobs/scene-topic-batch-generate.service';
import { FileAssetMaintenanceService } from '../../file-assets/file-asset-maintenance.service';

@Processor(ADMIN_CONTENT_QUEUE, { concurrency: 3 })
export class ContentPrepareProcessor extends WorkerHost {
  constructor(
    private readonly contentPrepareService: ContentPrepareService,
    private readonly adminTasksService: AdminTasksService,
    private readonly warmupPipelineGenerateService: WarmupPipelineGenerateService,
    private readonly sceneTopicBatchGenerateService: SceneTopicBatchGenerateService,
    private readonly fileAssetMaintenance: FileAssetMaintenanceService,
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
  }>): Promise<unknown> {
    try {
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
}

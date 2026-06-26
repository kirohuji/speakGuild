import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ADMIN_CONTENT_QUEUE, CONTENT_PREPARE_JOB } from '../admin-tasks.constants';
import { AdminTasksService } from '../admin-tasks.service';
import { ContentPrepareService } from '../jobs/content-prepare.service';

@Processor(ADMIN_CONTENT_QUEUE, { concurrency: 1 })
export class ContentPrepareProcessor extends WorkerHost {
  constructor(
    private readonly contentPrepareService: ContentPrepareService,
    private readonly adminTasksService: AdminTasksService,
  ) {
    super();
  }

  async process(job: Job<{ taskId: string; sceneId: string }>): Promise<unknown> {
    if (job.name !== CONTENT_PREPARE_JOB) return null;
    try {
      return await this.contentPrepareService.run(job.data.taskId, job.data.sceneId, {
        reportProgress: (progress) => job.updateProgress(progress),
      });
    } catch (error) {
      await this.adminTasksService.markFailed(job.data.taskId, error);
      throw error;
    }
  }
}

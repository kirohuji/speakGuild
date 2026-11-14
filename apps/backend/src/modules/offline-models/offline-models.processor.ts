import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { OfflineModelsService } from './offline-models.service';
import { OFFLINE_MODEL_QUEUE } from './offline-model-catalog';
@Processor(OFFLINE_MODEL_QUEUE, { concurrency: 1 })
export class OfflineModelsProcessor extends WorkerHost {
  constructor(private readonly models: OfflineModelsService) { super(); }
  process(job: Job<{ taskId: string; versionId: string }>) { return this.models.run(job.data.taskId, job.data.versionId); }
}

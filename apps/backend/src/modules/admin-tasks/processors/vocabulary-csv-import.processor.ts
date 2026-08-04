import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { VOCABULARY_IMPORT_QUEUE, VOCABULARY_CSV_IMPORT_JOB, VOCABULARY_MISSING_MEANING_ENRICH_JOB } from '../admin-tasks.constants';
import { AdminTasksService } from '../admin-tasks.service';
import { VocabularyCsvImportService } from '../jobs/vocabulary-csv-import.service';

@Processor(VOCABULARY_IMPORT_QUEUE, { concurrency: 1 })
export class VocabularyCsvImportProcessor extends WorkerHost {
  constructor(
    private readonly vocabularyCsvImportService: VocabularyCsvImportService,
    private readonly adminTasksService: AdminTasksService,
  ) {
    super();
  }

  async process(job: Job<{
    taskId: string;
    words?: string[];
  }>): Promise<unknown> {
    try {
      if (job.name === VOCABULARY_CSV_IMPORT_JOB) {
        return await this.vocabularyCsvImportService.run(job.data.taskId, job.data.words ?? []);
      }
      if (job.name === VOCABULARY_MISSING_MEANING_ENRICH_JOB) {
        return await this.vocabularyCsvImportService.runMissingChineseMeaningEnrich(job.data.taskId);
      }
      return null;
    } catch (error) {
      await this.adminTasksService.markFailed(job.data.taskId, error);
      throw error;
    }
  }
}

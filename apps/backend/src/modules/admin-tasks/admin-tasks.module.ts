import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminTasksController } from './admin-tasks.controller';
import { AdminTasksService } from './admin-tasks.service';
import { ADMIN_CONTENT_QUEUE, SCRIPT_VIDEO_QUEUE, VOCABULARY_IMPORT_QUEUE } from './admin-tasks.constants';
import { ContentPrepareService } from './jobs/content-prepare.service';
import { ContentPrepareProcessor } from './processors/content-prepare.processor';
import { AdminContentAiService } from '../admin/admin-content-ai.service';
import { getRedisConnectionOptions } from '../../common/redis/redis-connection';
import { FileAssetsModule } from '../file-assets/file-assets.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { ScriptVideoRenderProcessor } from './processors/script-video-render.processor';
import { VocabularyCsvImportService } from './jobs/vocabulary-csv-import.service';
import { VocabularyCsvImportProcessor } from './processors/vocabulary-csv-import.processor';
import { PracticeAiModule } from '../practice-ai/practice-ai.module';
import { NotificationModule } from '../notification/notification.module';
import { WarmupPipelineGenerateService } from './jobs/warmup-pipeline-generate.service';
import { TopicTeachingGenerateService } from './jobs/topic-teaching-generate.service';
import { SceneTopicBatchGenerateService } from './jobs/scene-topic-batch-generate.service';
import { AiModelModule } from '../ai-model/ai-model.module';
import { ContentExperienceModule } from '../content-experiences/content-experience.module';

@Module({
  imports: [
    PrismaModule,
    FileAssetsModule,
    DictionaryModule,
    PracticeAiModule,
    NotificationModule,
    AiModelModule,
    ContentExperienceModule,
    BullModule.forRoot({
      connection: getRedisConnectionOptions(),
    }),
    BullModule.registerQueue({
      name: ADMIN_CONTENT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    }),
    BullModule.registerQueue({
      // Imports can issue thousands of dictionary/AI requests. Keep them from
      // occupying the queue that prepares learning-package content.
      name: VOCABULARY_IMPORT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    }),
    BullModule.registerQueue({
      name: SCRIPT_VIDEO_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    }),
  ],
  controllers: [AdminTasksController],
  providers: [
    AdminTasksService,
    ContentPrepareService,
    ContentPrepareProcessor,
    AdminContentAiService,
    ScriptVideoRenderProcessor,
    VocabularyCsvImportService,
    VocabularyCsvImportProcessor,
    WarmupPipelineGenerateService,
    TopicTeachingGenerateService,
    SceneTopicBatchGenerateService,
  ],
  exports: [AdminTasksService, AdminContentAiService, ContentPrepareService, TopicTeachingGenerateService],
})
export class AdminTasksModule {}

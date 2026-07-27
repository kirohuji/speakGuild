import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { AdminTasksController } from './admin-tasks.controller';
import { AdminTasksService } from './admin-tasks.service';
import { ADMIN_CONTENT_QUEUE, SCRIPT_VIDEO_QUEUE } from './admin-tasks.constants';
import { ContentPrepareService } from './jobs/content-prepare.service';
import { ContentPrepareProcessor } from './processors/content-prepare.processor';
import { AdminContentAiService } from '../admin/admin-content-ai.service';
import { getRedisConnectionOptions } from '../../common/redis/redis-connection';
import { FileAssetsModule } from '../file-assets/file-assets.module';
import { ScriptVideoRenderProcessor } from './processors/script-video-render.processor';

@Module({
  imports: [
    PrismaModule,
    DictionaryModule,
    FileAssetsModule,
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
  ],
  exports: [AdminTasksService, AdminContentAiService],
})
export class AdminTasksModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { AdminTasksController } from './admin-tasks.controller';
import { AdminTasksService } from './admin-tasks.service';
import { ADMIN_CONTENT_QUEUE } from './admin-tasks.constants';
import { ContentPrepareService } from './jobs/content-prepare.service';
import { ContentPrepareProcessor } from './processors/content-prepare.processor';
import { AdminContentAiService } from '../admin/admin-content-ai.service';
import { getRedisConnectionOptions } from '../../common/redis/redis-connection';

@Module({
  imports: [
    PrismaModule,
    DictionaryModule,
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
  ],
  controllers: [AdminTasksController],
  providers: [
    AdminTasksService,
    ContentPrepareService,
    ContentPrepareProcessor,
    AdminContentAiService,
  ],
  exports: [AdminTasksService, AdminContentAiService],
})
export class AdminTasksModule {}

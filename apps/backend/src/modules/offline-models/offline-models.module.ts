import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { FileAssetsModule } from '../file-assets/file-assets.module';
import { OFFLINE_MODEL_QUEUE } from './offline-model-catalog';
import { OfflineModelsService } from './offline-models.service';
import { AdminOfflineModelsController, OfflineModelsController } from './offline-models.controller';
import { OfflineModelsProcessor } from './offline-models.processor';
@Module({
  imports: [PrismaModule, FileAssetsModule, BullModule.registerQueue({ name: OFFLINE_MODEL_QUEUE })],
  controllers: [AdminOfflineModelsController, OfflineModelsController],
  providers: [OfflineModelsService, OfflineModelsProcessor], exports: [OfflineModelsService],
})
export class OfflineModelsModule {}

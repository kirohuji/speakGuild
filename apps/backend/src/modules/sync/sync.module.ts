import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PointsModule } from '../points/points.module';
import { ContentExperienceModule } from '../content-experiences/content-experience.module';
import { PracticeAiModule } from '../practice-ai/practice-ai.module';

@Module({
  imports: [PointsModule, ContentExperienceModule, PracticeAiModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}

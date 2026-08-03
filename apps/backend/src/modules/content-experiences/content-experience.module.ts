import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AiModelModule } from '../ai-model/ai-model.module';
import { FileAssetsModule } from '../file-assets/file-assets.module';
import { LearningModule } from '../learning/learning.module';
import { AdminContentExperienceController } from './admin-content-experience.controller';
import { ContentExperienceController } from './content-experience.controller';
import { ContentExperienceService } from './content-experience.service';
import { EpubAnalysisService } from './epub-analysis.service';

@Module({
  imports: [PrismaModule, FileAssetsModule, LearningModule, AiModelModule],
  controllers: [ContentExperienceController, AdminContentExperienceController],
  providers: [ContentExperienceService, EpubAnalysisService],
  exports: [ContentExperienceService],
})
export class ContentExperienceModule {}

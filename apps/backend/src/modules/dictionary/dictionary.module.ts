import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { DictionaryPipelineService } from './dictionary-pipeline.service';
import { DictionaryClusteringService } from './dictionary-clustering.service';
import { DictionaryPronunciationProviderService } from './dictionary-pronunciation-provider.service';
import { AiModelModule } from '../ai-model/ai-model.module';

@Module({
  imports: [PrismaModule, AiModelModule],
  controllers: [DictionaryController],
  providers: [
    DictionaryService,
    DictionaryPipelineService,
    DictionaryClusteringService,
    DictionaryPronunciationProviderService,
  ],
  exports: [DictionaryService],
})
export class DictionaryModule {}

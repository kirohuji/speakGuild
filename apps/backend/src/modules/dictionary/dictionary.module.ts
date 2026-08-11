import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { DictionaryPipelineService } from './dictionary-pipeline.service';
import { DictionaryClusteringService } from './dictionary-clustering.service';
import { DictionaryPronunciationProviderService } from './dictionary-pronunciation-provider.service';

@Module({
  imports: [PrismaModule],
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

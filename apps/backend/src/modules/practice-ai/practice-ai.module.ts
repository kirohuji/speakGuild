import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PracticeModule } from '../practice/practice.module';
import { EnglishPracticeAiController } from './english-practice-ai.controller';
import { EnglishPracticeAiService } from './english-practice-ai.service';
import { WarmupRecordController } from './warmup-record.controller';
import { WarmupRecordService } from './warmup-record.service';

@Module({
  imports: [PrismaModule, PracticeModule],
  controllers: [EnglishPracticeAiController, WarmupRecordController],
  providers: [EnglishPracticeAiService, WarmupRecordService],
  exports: [EnglishPracticeAiService],
})
export class PracticeAiModule {}

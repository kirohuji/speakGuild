import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PracticeModule } from '../practice/practice.module';
import { EnglishPracticeAiController } from './english-practice-ai.controller';
import { EnglishPracticeAiService } from './english-practice-ai.service';
import { WarmupRecordController } from './warmup-record.controller';
import { WarmupRecordService } from './warmup-record.service';
import { DailyPracticeController } from './daily-practice.controller';
import { DailyPracticeService } from './daily-practice.service';

@Module({
  imports: [PrismaModule, PracticeModule],
  controllers: [EnglishPracticeAiController, WarmupRecordController, DailyPracticeController],
  providers: [EnglishPracticeAiService, WarmupRecordService, DailyPracticeService],
  exports: [EnglishPracticeAiService],
})
export class PracticeAiModule {}

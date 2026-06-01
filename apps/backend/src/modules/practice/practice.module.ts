import { Module } from '@nestjs/common';
import { EnglishPracticeController } from './english-practice.controller';
import { EnglishPracticeService } from './english-practice.service';

@Module({
  controllers: [EnglishPracticeController],
  providers: [EnglishPracticeService],
  exports: [EnglishPracticeService],
})
export class PracticeModule {}

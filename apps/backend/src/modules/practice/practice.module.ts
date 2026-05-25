import { Module } from '@nestjs/common';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { EnglishPracticeController } from './english-practice.controller';
import { EnglishPracticeService } from './english-practice.service';

@Module({
  controllers: [PracticeController, EnglishPracticeController],
  providers: [PracticeService, EnglishPracticeService],
})
export class PracticeModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PracticeModule } from '../practice/practice.module';
import { EnglishPracticeAiController } from './english-practice-ai.controller';
import { EnglishPracticeAiService } from './english-practice-ai.service';

@Module({
  imports: [PrismaModule, PracticeModule],
  controllers: [EnglishPracticeAiController],
  providers: [EnglishPracticeAiService],
  exports: [EnglishPracticeAiService],
})
export class PracticeAiModule {}

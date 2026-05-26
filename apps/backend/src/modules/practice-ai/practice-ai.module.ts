import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PracticeModule } from '../practice/practice.module';
import { PracticeAiController } from './practice-ai.controller';
import { PracticeAiService } from './practice-ai.service';
import { EnglishPracticeAiController } from './english-practice-ai.controller';
import { EnglishPracticeAiService } from './english-practice-ai.service';

@Module({
  imports: [PrismaModule, PracticeModule],
  controllers: [PracticeAiController, EnglishPracticeAiController],
  providers: [PracticeAiService, EnglishPracticeAiService],
})
export class PracticeAiModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PracticeAiController } from './practice-ai.controller';
import { PracticeAiService } from './practice-ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [PracticeAiController],
  providers: [PracticeAiService],
})
export class PracticeAiModule {}

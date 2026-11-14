import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningStatisticsService } from './learning-statistics.service';

@Module({ imports: [PrismaModule], providers: [LearningStatisticsService], exports: [LearningStatisticsService] })
export class LearningStatisticsModule {}

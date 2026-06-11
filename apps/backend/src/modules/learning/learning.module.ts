import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { FileAssetsModule } from '../file-assets/file-assets.module';

@Module({
  imports: [PrismaModule, FileAssetsModule],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}

import { Module } from '@nestjs/common';
import { DailySentenceAdminController } from './daily-sentence-admin.controller';
import { DailySentencePublicController } from './daily-sentence-public.controller';
import { DailySentenceService } from './daily-sentence.service';

@Module({
  controllers: [DailySentenceAdminController, DailySentencePublicController],
  providers: [DailySentenceService],
  exports: [DailySentenceService],
})
export class DailySentenceModule {}

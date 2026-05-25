import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { FileAssetsController } from './file-assets.controller';
import { FileAssetsService } from './file-assets.service';
import { FileAssetsCleanupJob } from './file-assets.cleanup';

@Module({
  imports: [PrismaModule],
  controllers: [FileAssetsController],
  providers: [FileAssetsService, FileAssetsCleanupJob],
  exports: [FileAssetsService],
})
export class FileAssetsModule {}

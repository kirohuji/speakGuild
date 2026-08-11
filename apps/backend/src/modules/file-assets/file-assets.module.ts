import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { FileAssetsController } from './file-assets.controller';
import { FileAssetsService } from './file-assets.service';
import { FileAssetMaintenanceService } from './file-asset-maintenance.service';

@Module({
  imports: [PrismaModule],
  controllers: [FileAssetsController],
  providers: [FileAssetsService, FileAssetMaintenanceService],
  exports: [FileAssetsService, FileAssetMaintenanceService],
})
export class FileAssetsModule {}

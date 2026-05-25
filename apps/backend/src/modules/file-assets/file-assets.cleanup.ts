import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FileAssetsService } from './file-assets.service';

@Injectable()
export class FileAssetsCleanupJob {
  private readonly logger = new Logger(FileAssetsCleanupJob.name);

  constructor(private readonly fileAssetsService: FileAssetsService) {}

  @Cron(process.env.FILE_CLEANUP_CRON || '0 30 3 * * *')
  async handleCleanup() {
    const days = Number(process.env.FILE_CLEANUP_DAYS ?? 7);
    const dryRun = String(process.env.FILE_CLEANUP_DRY_RUN ?? 'false') === 'true';
    const result = await this.fileAssetsService.cleanupUnreferencedAssets(days, dryRun);
    this.logger.log(`cleanup result scanned=${result.scanned} deleted=${result.deleted}`);
  }
}

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
    // Deletion requires an explicit second switch. This prevents legacy URL
    // references with an incorrect refCount from causing irreversible loss.
    const allowDelete = String(process.env.FILE_CLEANUP_ALLOW_DELETE ?? 'false') === 'true';
    const configuredDryRun = String(process.env.FILE_CLEANUP_DRY_RUN ?? 'true') === 'true';
    const dryRun = configuredDryRun || !allowDelete;
    if (!allowDelete) {
      this.logger.warn('file cleanup is safety-locked; running in dry-run mode');
    }
    const result = await this.fileAssetsService.cleanupUnreferencedAssets(days, dryRun);
    this.logger.log(`cleanup result scanned=${result.scanned} deleted=${result.deleted}`);
  }
}

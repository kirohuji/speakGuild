import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OpsAlertService } from './ops-alert.service';

function toNumber(value: unknown) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return Number(value || 0);
}

@Injectable()
export class OpsCapacityJob {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: OpsAlertService,
  ) {}

  @Cron(process.env.OPS_CAPACITY_CHECK_CRON || '0 15 9 * * *')
  async checkCapacity() {
    const dbMaxBytes = Number(process.env.OPS_DB_MAX_BYTES || 0);
    const fileAssetMaxBytes = Number(process.env.OPS_FILE_ASSET_MAX_BYTES || 0);

    if (dbMaxBytes > 0) {
      const rows = await this.prisma.$queryRaw<Array<{ size: bigint | number }>>`SELECT pg_database_size(current_database()) AS size`;
      const dbBytes = toNumber(rows?.[0]?.size);
      if (dbBytes >= dbMaxBytes * 0.85) {
        await this.alerts.notify({
          key: 'capacity:database',
          title: '数据库容量接近上限',
          severity: dbBytes >= dbMaxBytes ? 'critical' : 'warning',
          details: { dbBytes, dbMaxBytes, usageRatio: dbBytes / dbMaxBytes },
          throttleSeconds: 24 * 60 * 60,
        });
      }
    }

    if (fileAssetMaxBytes > 0) {
      const result = await this.prisma.fileAsset.aggregate({
        where: { status: 'active' },
        _sum: { size: true },
      });
      const fileAssetBytes = result._sum.size ?? 0;
      if (fileAssetBytes >= fileAssetMaxBytes * 0.85) {
        await this.alerts.notify({
          key: 'capacity:file-assets',
          title: '文件存储登记容量接近上限',
          severity: fileAssetBytes >= fileAssetMaxBytes ? 'critical' : 'warning',
          details: { fileAssetBytes, fileAssetMaxBytes, usageRatio: fileAssetBytes / fileAssetMaxBytes },
          throttleSeconds: 24 * 60 * 60,
        });
      }
    }
  }
}

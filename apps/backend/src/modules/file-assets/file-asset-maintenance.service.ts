import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from './file-assets.service';

const DIRECT_REFERENCE_FIELDS = [
  'mobileBundles',
  'learningPackages',
  'deltaPackages',
  'scriptRecordAudioAssets',
  'scriptRecordVideoAssets',
  'scriptWorkVideoAssets',
  'scriptWorkCoverAssets',
  'trainingTopicMedia',
  'novelEpubFiles',
] as const;

type Candidate = {
  id: string;
  filename: string;
  group: string;
  size: number;
  createdAt: Date;
};

@Injectable()
export class FileAssetMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileAssetsService,
  ) {}

  async inspectUnused(minAgeDays = 7, limit = 500) {
    const safeMinAgeDays = Number.isFinite(minAgeDays) ? Math.max(1, Math.floor(minAgeDays)) : 7;
    const before = new Date(Date.now() - safeMinAgeDays * 86_400_000);
    const rows = await this.prisma.fileAsset.findMany({
      where: { createdAt: { lt: before } },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 2_000),
      include: {
        _count: {
          select: {
            references: true,
            mobileBundles: true,
            learningPackages: true,
            deltaPackages: true,
            scriptRecordAudioAssets: true,
            scriptRecordVideoAssets: true,
            scriptWorkVideoAssets: true,
            scriptWorkCoverAssets: true,
            trainingTopicMedia: true,
            novelEpubFiles: true,
          },
        },
      },
    });

    const directCandidates: Candidate[] = rows
      .filter((asset) => this.totalReferences(asset._count) === 0)
      .map(({ id, filename, group, size, createdAt }) => ({ id, filename, group, size, createdAt }));
    const embeddedReferences = await this.findEmbeddedReferencedIds(
      this.prisma,
      directCandidates.map((asset) => asset.id),
    );
    const candidates = directCandidates.filter((asset) => !embeddedReferences.has(asset.id));

    return {
      minAgeDays: safeMinAgeDays,
      scanned: rows.length,
      candidateCount: candidates.length,
      candidateBytes: candidates.reduce((sum, asset) => sum + asset.size, 0),
      candidateIds: candidates.map((asset) => asset.id),
      candidates,
    };
  }

  async purgeCheckedCandidates(assetIds: string[]) {
    const uniqueIds = [...new Set(assetIds)].slice(0, 2_000);
    const result = {
      requested: uniqueIds.length,
      purged: 0,
      blocked: 0,
      failed: 0,
      reclaimedBytes: 0,
      errors: [] as Array<{ assetId: string; message: string }>,
    };

    for (const assetId of uniqueIds) {
      try {
        const purge = await this.preparePurge(assetId);
        if (!purge) {
          result.blocked += 1;
          continue;
        }
        await this.executePurge(purge.id);
        result.purged += 1;
        result.reclaimedBytes += purge.size;
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          assetId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  }

  async retryPendingPurges(limit = 200) {
    const pending = await this.prisma.fileAssetPurge.findMany({
      where: { status: { in: ['pending', 'failed'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    let completed = 0;
    let failed = 0;
    for (const purge of pending) {
      try {
        await this.executePurge(purge.id);
        completed += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed: pending.length, completed, failed };
  }

  private async preparePurge(assetId: string) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.findUnique({
        where: { id: assetId },
        include: {
          _count: {
            select: {
              references: true,
              mobileBundles: true,
              learningPackages: true,
              deltaPackages: true,
              scriptRecordAudioAssets: true,
              scriptRecordVideoAssets: true,
              scriptWorkVideoAssets: true,
              scriptWorkCoverAssets: true,
              trainingTopicMedia: true,
              novelEpubFiles: true,
            },
          },
        },
      });
      if (!asset || this.totalReferences(asset._count) > 0) return null;
      if ((await this.findEmbeddedReferencedIds(tx, [asset.id])).has(asset.id)) return null;

      const purge = await tx.fileAssetPurge.create({
        data: {
          assetId: asset.id,
          bucket: asset.bucket,
          region: asset.region,
          cosKey: asset.cosKey,
          sha256: asset.sha256,
        },
      });

      // Database deletion is the safety barrier. Every real relation is
      // RESTRICT, so a concurrent or forgotten reference aborts this transaction
      // before the COS object is touched.
      await tx.fileAsset.delete({ where: { id: asset.id } });
      return { ...purge, size: asset.size };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async executePurge(purgeId: string) {
    const purge = await this.prisma.fileAssetPurge.findUnique({ where: { id: purgeId } });
    if (!purge || purge.status === 'completed') return;
    try {
      await this.files.deleteStoredObject(purge.cosKey, purge.bucket, purge.region);
      await this.prisma.fileAssetPurge.update({
        where: { id: purge.id },
        data: { status: 'completed', completedAt: new Date(), lastError: null, attempts: { increment: 1 } },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.fileAssetPurge.update({
        where: { id: purge.id },
        data: { status: 'failed', lastError: message, attempts: { increment: 1 } },
      });
      throw error;
    }
  }

  private totalReferences(counts: Record<string, number>) {
    return counts.references + DIRECT_REFERENCE_FIELDS.reduce((sum, field) => sum + counts[field], 0);
  }

  private async findEmbeddedReferencedIds(
    db: Prisma.TransactionClient | PrismaService,
    assetIds: string[],
  ) {
    if (assetIds.length === 0) return new Set<string>();
    // This is deliberately conservative. JSON and text content cannot have a
    // database foreign key, so the maintenance task independently searches the
    // bounded set of business tables before declaring an asset unused.
    const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT fa.id
      FROM "file_asset" fa
      WHERE fa.id IN (${Prisma.join(assetIds)})
        AND (
          EXISTS (SELECT 1 FROM "scene" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "package_group" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "vocabulary" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "chunk" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "chunk_example" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "sentence_pattern" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "ink_script" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "training_topic" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
          OR EXISTS (SELECT 1 FROM "notification" t WHERE to_jsonb(t)::text LIKE '%' || fa.id || '%')
        )
    `);
    return new Set(rows.map((row) => row.id));
  }
}

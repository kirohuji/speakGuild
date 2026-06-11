import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FileAssetGroup } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { LearningService } from '../learning/learning.service';

const PACKAGE_STATUS = {
  building: 'building',
  draft: 'draft',
  published: 'published',
  failed: 'failed',
} as const;

@Injectable()
export class LearningPackAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningService: LearningService,
    private readonly fileAssets: FileAssetsService,
  ) {}

  async list(params: { sceneId?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: any = {};
    if (params.sceneId) where.sceneId = params.sceneId;
    if (params.status) where.status = params.status;

    const [list, total] = await this.prisma.$transaction([
      (this.prisma as any).learningPackage.findMany({
        where,
        include: {
          scene: { select: { id: true, title: true, location: true } },
          fileAsset: { select: { id: true, size: true, sha256: true, filename: true, createdAt: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      (this.prisma as any).learningPackage.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async listScenes() {
    return this.prisma.scene.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, title: true, location: true },
    });
  }

  async generate(userId: string, sceneId: string, input?: { version?: number; title?: string; publish?: boolean }) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { id: true, title: true },
    });
    if (!scene) throw new NotFoundException('学习单元不存在');

    const latest = await (this.prisma as any).learningPackage.findFirst({
      where: { sceneId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = input?.version ?? Number(latest?.version ?? 0) + 1;
    if (version <= 0) throw new BadRequestException('版本号必须大于 0');

    const title = input?.title?.trim() || `${scene.title} v${version}`;
    const record = await (this.prisma as any).learningPackage.upsert({
      where: { sceneId_version: { sceneId, version } },
      create: {
        sceneId,
        version,
        title,
        status: PACKAGE_STATUS.building,
      },
      update: {
        title,
        status: PACKAGE_STATUS.building,
        buildLog: null,
      },
    });

    try {
      const pack = await this.learningService.buildLearningPackZip(userId, sceneId, {
        version,
        title,
      });
      const asset = await this.fileAssets.createAssetFromBuffer({
        buffer: pack.buffer,
        filename: pack.fileName,
        mimeType: 'application/zip',
        group: 'learning_pack' as FileAssetGroup,
      });
      await this.fileAssets.createSystemReference(asset.id, 'learning_pack', record.id);

      return (this.prisma as any).learningPackage.update({
        where: { id: record.id },
        data: {
          status: input?.publish === false ? PACKAGE_STATUS.draft : PACKAGE_STATUS.published,
          fileAssetId: asset.id,
          zipChecksum: pack.checksum,
          zipSize: pack.buffer.byteLength,
          manifestSnapshot: pack.manifest,
          publishedAt: input?.publish === false ? null : new Date(),
          buildLog: `Generated ${pack.fileName}`,
        },
        include: {
          scene: { select: { id: true, title: true, location: true } },
          fileAsset: { select: { id: true, size: true, sha256: true, filename: true, createdAt: true } },
        },
      });
    } catch (error) {
      await (this.prisma as any).learningPackage.update({
        where: { id: record.id },
        data: {
        status: PACKAGE_STATUS.failed,
          buildLog: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  async publish(id: string) {
    const pack = await (this.prisma as any).learningPackage.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('学习包不存在');
    if (!pack.fileAssetId) throw new BadRequestException('学习包尚未生成 zip，不能发布');

    // V2: 尝试生成 delta（对上一個已发布版本）
    await this.generateDeltaIfPossible(pack).catch((err) => {
      console.warn('[learning-pack] delta generation failed, continuing publish:', err.message);
    });

    return (this.prisma as any).learningPackage.update({
      where: { id },
      data: { status: PACKAGE_STATUS.published, publishedAt: new Date() },
      include: {
        scene: { select: { id: true, title: true, location: true } },
        fileAsset: { select: { id: true, size: true, sha256: true, filename: true, createdAt: true } },
      },
    });
  }

  /** V2: 为上一個已发布版本生成增量包 */
  private async generateDeltaIfPossible(pack: any) {
    if (!pack.manifestSnapshot?.files) return;

    // 找上一个已发布版本
    const prev = await (this.prisma as any).learningPackage.findFirst({
      where: {
        sceneId: pack.sceneId,
        status: 'published',
        version: { lt: pack.version },
      },
      orderBy: { version: 'desc' },
    });
    if (!prev?.manifestSnapshot?.files) {
      console.log(`[learning-pack] no previous published version for scene ${pack.sceneId}, skipping delta`);
      return;
    }

    console.log(`[learning-pack] generating delta: v${prev.version} → v${pack.version}`);

    const prevFiles: Record<string, string> = prev.manifestSnapshot.files;
    const currFiles: Record<string, string> = pack.manifestSnapshot.files;

    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    for (const [path, hash] of Object.entries(currFiles)) {
      if (!prevFiles[path]) {
        added.push(path);
      } else if (prevFiles[path] !== hash) {
        modified.push(path);
      } else {
        unchanged.push(path);
      }
    }
    for (const path of Object.keys(prevFiles)) {
      if (!currFiles[path]) removed.push(path);
    }

    const totalChanged = added.length + modified.length + removed.length;
    const totalFiles = Object.keys(currFiles).length;
    const changeRatio = totalFiles > 0 ? totalChanged / totalFiles : 1;

    // 降级：变更超过 50% 就不生成 delta
    if (changeRatio > 0.5) {
      console.log(`[learning-pack] delta skipped: ${totalChanged}/${totalFiles} files changed (${(changeRatio * 100).toFixed(0)}%), threshold 50%`);
      return;
    }

    // 从新 zip 中提取变更的文件
    const signedUrl = await this.fileAssets.getPrivateUrlByAssetId(pack.fileAssetId);
    const zipResponse = await fetch(signedUrl.url);
    if (!zipResponse.ok) throw new Error(`Failed to fetch full zip: ${zipResponse.status}`);
    const fullZipBuffer = Buffer.from(await zipResponse.arrayBuffer());

    const AdmZip = (await import('adm-zip')).default;
    const fullZip = new AdmZip(fullZipBuffer);
    const deltaZip = new AdmZip();

    // 生成 delta-manifest.json
    const deltaManifest = {
      packId: pack.id,
      fromVersion: prev.version,
      toVersion: pack.version,
      generatedAt: new Date().toISOString(),
      added,
      modified,
      removed,
      unchanged: unchanged.slice(0, 100), // 只记录前 100 个，避免过大
      unchangedCount: unchanged.length,
      targetManifestChecksum: pack.zipChecksum,
      stats: {
        totalFiles,
        addedCount: added.length,
        modifiedCount: modified.length,
        removedCount: removed.length,
        unchangedCount: unchanged.length,
        changePercent: Math.round(changeRatio * 100),
      },
    };

    deltaZip.addFile('delta-manifest.json', Buffer.from(JSON.stringify(deltaManifest, null, 2)));

    // 添加变更文件
    for (const path of [...added, ...modified]) {
      const entry = fullZip.getEntry(path);
      if (entry) {
        deltaZip.addFile(path, entry.getData());
      }
    }

    const deltaBuffer = deltaZip.toBuffer();
    const deltaChecksum = this.sha256Buffer(deltaBuffer);

    // 上传 delta zip 到 COS
    const asset = await this.fileAssets.createAssetFromBuffer({
      buffer: deltaBuffer,
      filename: `delta-v${prev.version}-v${pack.version}-${pack.sceneId}.zip`,
      mimeType: 'application/zip',
      group: 'learning_pack_delta' as any,
    });
    await this.fileAssets.createSystemReference(asset.id, 'learning_pack_delta', `${pack.id}:${prev.version}:${pack.version}`);

    // 写入 DeltaPackage 记录
    await (this.prisma as any).deltaPackage.create({
      data: {
        packId: pack.id,
        fromVersion: prev.version,
        toVersion: pack.version,
        fileAssetId: asset.id,
        deltaChecksum,
        deltaSize: deltaBuffer.byteLength,
        addedCount: added.length,
        modifiedCount: modified.length,
        removedCount: removed.length,
      },
    });

    console.log(`[learning-pack] ✅ delta generated: ${added.length}+${modified.length} files, ${(deltaBuffer.byteLength / 1024).toFixed(0)}KB (saved ${((1 - changeRatio) * 100).toFixed(0)}%)`);
  }

  private sha256Buffer(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async remove(id: string) {
    const pack = await (this.prisma as any).learningPackage.findUnique({ where: { id } });
    if (!pack) return { success: true };
    if (pack.fileAssetId) {
      await this.fileAssets.deleteSystemReference(pack.fileAssetId, 'learning_pack', id);
    }
    await (this.prisma as any).learningPackage.delete({ where: { id } });
    return { success: true };
  }
}

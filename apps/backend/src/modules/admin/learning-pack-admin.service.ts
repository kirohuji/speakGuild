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
    return (this.prisma as any).learningPackage.update({
      where: { id },
      data: { status: PACKAGE_STATUS.published, publishedAt: new Date() },
      include: {
        scene: { select: { id: true, title: true, location: true } },
        fileAsset: { select: { id: true, size: true, sha256: true, filename: true, createdAt: true } },
      },
    });
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

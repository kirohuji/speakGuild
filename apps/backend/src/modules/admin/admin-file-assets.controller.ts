import { Body, Controller, Get, Param, Post, Query, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { FileAssetGroup } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { requireAuthSession } from '../auth/session.util';
import { AdminTasksService } from '../admin-tasks/admin-tasks.service';

@Controller('admin/file-assets')
export class AdminFileAssetsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileAssetsService: FileAssetsService,
    private readonly adminTasks: AdminTasksService,
  ) {}

  private async requireAdmin(req: Request) {
    const session = await requireAuthSession(req);
    if ((session.user as any)?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return session;
  }

  /** 获取所有分组及其统计数 */
  @Get('groups')
  async getGroups(@Req() req: Request) {
    await this.requireAdmin(req);

    const groups = Object.values(FileAssetGroup);
    const counts = await Promise.all(
      groups.map(async (group) => {
        const count = await this.prisma.fileAsset.count({
          where: { group },
        });
        return { group, count };
      }),
    );

    return counts;
  }

  /** 分页列出所有文件资产（支持按组筛选和文件名搜索） */
  @Get()
  async listFileAssets(
    @Req() req: Request,
    @Query('group') group?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.requireAdmin(req);

    const p = Math.max(1, parseInt(page || '1'));
    const ps = Math.min(100, Math.max(1, parseInt(pageSize || '20')));
    const skip = (p - 1) * ps;

    const where: any = {};

    if (group && Object.values(FileAssetGroup).includes(group as FileAssetGroup)) {
      where.group = group;
    }

    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { sha256: { contains: search, mode: 'insensitive' } },
        { cosKey: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
        include: { _count: { select: {
          references: true, mobileBundles: true, learningPackages: true, deltaPackages: true,
          scriptRecordAudioAssets: true, scriptRecordVideoAssets: true,
          scriptWorkVideoAssets: true, scriptWorkCoverAssets: true,
          trainingTopicMedia: true, novelEpubFiles: true,
        } } },
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    // 为每个文件生成 7 天签名 URL（以便管理员预览）
    const signedItems = await Promise.all(
      items.map(async (asset) => {
        let previewUrl: string | null = null;
        try {
          const result = await this.fileAssetsService.getAssetLongLivedUrl(asset.id);
          previewUrl = result.url;
        } catch {
          // 签名失败不阻塞列表返回
        }
        return {
          id: asset.id,
          sha256: asset.sha256,
          bucket: asset.bucket,
          region: asset.region,
          cosKey: asset.cosKey,
          group: asset.group,
          size: asset.size,
          mimeType: asset.mimeType,
          filename: asset.filename,
          referenceCount: Object.values(asset._count).reduce((sum, count) => sum + count, 0),
          createdAt: asset.createdAt,
          previewUrl,
        };
      }),
    );

    return {
      items: signedItems,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  /** 获取单个资产详情（含 7 天签名预览 URL） */
  @Get(':id')
  async getFileAsset(@Req() req: Request, @Param('id') id: string) {
    await this.requireAdmin(req);

    const asset = await this.prisma.fileAsset.findUnique({
      where: { id },
      include: { _count: { select: {
        references: true, mobileBundles: true, learningPackages: true, deltaPackages: true,
        scriptRecordAudioAssets: true, scriptRecordVideoAssets: true,
        scriptWorkVideoAssets: true, scriptWorkCoverAssets: true,
        trainingTopicMedia: true, novelEpubFiles: true,
      } } },
    });
    if (!asset) throw new NotFoundException('文件资产不存在');

    let previewUrl: string | null = null;
    try {
      const result = await this.fileAssetsService.getAssetLongLivedUrl(asset.id);
      previewUrl = result.url;
    } catch {
      // 签名失败不阻塞
    }

    // 获取引用列表
    const references = await this.prisma.fileReference.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        bizType: true,
        bizId: true,
        createdById: true,
        createdAt: true,
      },
    });

    // 批量查询创建者用户名（FileReference 未关联 User 表，按 id 补充）
    const creatorIds = [...new Set(references.map((ref) => ref.createdById).filter((v): v is string => Boolean(v)))];
    const creators = creatorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, username: true },
        })
      : [];
    const creatorMap = new Map(creators.map((user) => [user.id, user]));

    const { _count, ...item } = asset;
    return {
      ...item,
      referenceCount: Object.values(_count).reduce((sum, count) => sum + count, 0),
      previewUrl,
      references: references.map((ref) => {
        const creator = ref.createdById ? creatorMap.get(ref.createdById) : undefined;
        return {
          ...ref,
          createdByName: creator ? creator.name || creator.username || null : null,
        };
      }),
    };
  }

  @Post('maintenance/inspect')
  async inspectUnused(@Req() req: Request, @Body() body: { minAgeDays?: number }) {
    const session = await this.requireAdmin(req);
    return this.adminTasks.enqueueFileAssetInspection(session.user.id, Number(body?.minAgeDays ?? 7));
  }

  @Post('maintenance/cleanup')
  async cleanupUnused(@Req() req: Request, @Body() body?: { inspectionTaskId?: string }) {
    const session = await this.requireAdmin(req);
    return this.adminTasks.enqueueFileAssetCleanup(session.user.id, body?.inspectionTaskId ?? '');
  }
}

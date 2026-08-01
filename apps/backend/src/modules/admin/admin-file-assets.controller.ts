import {
  Controller, Get, Delete,
  Param, Query, Req, ForbiddenException, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileAssetGroup, FileAssetStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('admin/file-assets')
export class AdminFileAssetsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileAssetsService: FileAssetsService,
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
          where: { group, status: FileAssetStatus.active },
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

    const where: any = { status: FileAssetStatus.active };

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
          refCount: asset.refCount,
          status: asset.status,
          lastReferencedAt: asset.lastReferencedAt,
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

    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
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
        userId: true,
        createdAt: true,
        user: { select: { id: true, name: true, username: true } },
      },
    });

    return { ...asset, previewUrl, references };
  }

  /** 删除资产（refCount > 0 时拒绝，传 force=true 可强制删除） */
  @Delete(':id')
  async deleteFileAsset(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    await this.requireAdmin(req);

    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('文件资产不存在');

    if (asset.refCount > 0 && force !== 'true') {
      throw new BadRequestException(
        `该文件有 ${asset.refCount} 个引用，无法删除。如需强制删除请传 force=true`,
      );
    }

    // 清理引用记录
    if (asset.refCount > 0) {
      await this.prisma.fileReference.deleteMany({ where: { assetId: id } });
    }

    // 标记为已删除（软删除，COS 对象保留由定时清理任务处理）
    await this.prisma.fileAsset.update({
      where: { id },
      data: { status: FileAssetStatus.deleted },
    });

    return { success: true, id };
  }
}

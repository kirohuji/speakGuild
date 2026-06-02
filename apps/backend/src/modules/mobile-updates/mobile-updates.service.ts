import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import type { CreateMobileBundleDto, UpdateMobileBundleDto } from './dto/mobile-bundle.dto';

@Injectable()
export class MobileUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileAssets: FileAssetsService,
  ) {}

  /**
   * 公开接口：检查是否有可用更新。
   * 插件会提交 platform、deviceId、nativeVersion、currentBundleVersion 等信息。
   */
  async checkUpdate(params: {
    platform: string;
    deviceId?: string;
    nativeVersion?: string;
    currentBundleVersion?: string;
    channel?: string;
  }) {
    const { platform, nativeVersion, currentBundleVersion, channel = 'production' } = params;

    // 1. 查找该平台 + 渠道下启用的最新 bundle
    const bundles = await this.prisma.mobileBundle.findMany({
      where: {
        platform,
        channel,
        enabled: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (bundles.length === 0) {
      return { message: 'No update available' };
    }

    // 2. 筛选：版本号高于当前版本
    const candidate = bundles.find((b) => {
      // 如果 currentBundleVersion 不存在（首次安装），直接返回最新
      if (!currentBundleVersion) return true;

      // 简单语义化版本比较
      if (this.compareVersions(b.version, currentBundleVersion) <= 0) {
        return false;
      }

      // 检查最低原生版本
      if (b.minNativeVersion && nativeVersion) {
        if (this.compareVersions(nativeVersion, b.minNativeVersion) < 0) {
          return false; // 原生版本过低，不推送
        }
      }

      return true;
    });

    if (!candidate) {
      return { message: 'No update available' };
    }

    // 3. 灰度判断：基于 deviceId 哈希决定是否在灰度范围内
    if (candidate.rolloutPercent < 100 && params.deviceId) {
      const hash = this.hashDeviceId(params.deviceId);
      if (hash % 100 >= candidate.rolloutPercent) {
        return { message: 'No update available' };
      }
    }

    // 4. 通过 FileAssetsService 生成 COS 签名下载链接（1 小时有效）
    const { url } = await this.fileAssets.getPrivateUrlByAssetId(candidate.assetId);

    return {
      version: candidate.version,
      url,
      checksum: candidate.checksum,
    };
  }

  // ── 管理接口 ──

  async listBundles(params: {
    page?: number;
    pageSize?: number;
    platform?: string;
    channel?: string;
  }) {
    const { page = 1, pageSize = 20, platform, channel } = params;

    const where: any = {};
    if (platform) where.platform = platform;
    if (channel) where.channel = channel;

    const [items, total] = await Promise.all([
      this.prisma.mobileBundle.findMany({
        where,
        include: { asset: { select: { id: true, filename: true, cosKey: true, size: true, mimeType: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.mobileBundle.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getBundle(id: string) {
    return this.prisma.mobileBundle.findUnique({
      where: { id },
      include: { asset: { select: { id: true, filename: true, cosKey: true, size: true, mimeType: true } } },
    });
  }

  async createBundle(dto: CreateMobileBundleDto) {
    return this.prisma.mobileBundle.create({ data: dto });
  }

  async updateBundle(id: string, dto: UpdateMobileBundleDto) {
    return this.prisma.mobileBundle.update({ where: { id }, data: dto });
  }

  async deleteBundle(id: string) {
    return this.prisma.mobileBundle.delete({ where: { id } });
  }

  async toggleBundle(id: string) {
    const bundle = await this.prisma.mobileBundle.findUnique({ where: { id } });
    if (!bundle) return null;
    return this.prisma.mobileBundle.update({
      where: { id },
      data: { enabled: !bundle.enabled },
    });
  }

  // ── 工具方法 ──

  /** 简单的语义化版本比较：返回 1 (a > b), -1 (a < b), 0 (相等) */
  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
    return 0;
  }

  /** 简单哈希 deviceId 到 0-99 */
  private hashDeviceId(deviceId: string): number {
    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
      hash = ((hash << 5) - hash + deviceId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
  }
}

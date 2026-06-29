import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import type { CreateMobileBundleDto, UpdateMobileBundleDto } from './dto/mobile-bundle.dto';

type SemverParts = { major: number; minor: number; patch: number };
type BundleLike = {
  version: string;
  releaseLine?: string | null;
  notifyPolicy?: string | null;
};

@Injectable()
export class MobileUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileAssets: FileAssetsService,
  ) {}

  async checkUpdate(params: {
    platform: string;
    deviceId?: string;
    userId?: string;
    nativeVersion?: string;
    currentBundleVersion?: string;
    channel?: string;
  }) {
    const {
      platform,
      nativeVersion,
      currentBundleVersion,
      channel = 'production',
      userId,
    } = params;

    const current = currentBundleVersion ? this.parseVersion(currentBundleVersion) : null;
    const tester = userId
      ? await this.prisma.mobileOtaTester.findUnique({ where: { userId } })
      : null;

    // 记录用户最近一次检查时的版本信息（所有用户都记录，方便管理端查看）
    if (userId) {
      await this.prisma.mobileOtaTester.upsert({
        where: { userId },
        create: {
          userId,
          enabled: tester?.enabled ?? false,
          channel: tester?.channel ?? 'production',
          lastBundleVersion: currentBundleVersion || null,
          lastNativeVersion: params.nativeVersion || null,
          lastCheckAt: new Date(),
        },
        update: {
          lastBundleVersion: currentBundleVersion || null,
          lastNativeVersion: params.nativeVersion || null,
          lastCheckAt: new Date(),
        },
      }).catch(() => { /* 静默失败，不影响 check 主流程 */ })
    }

    // 内测用户使用 tester 表里指定的 channel，否则用客户端传来的 channel（默认 production）
    const effectiveChannel = (tester?.enabled && tester.channel) ? tester.channel : channel;

    const bundles = await this.prisma.mobileBundle.findMany({
      where: {
        platform,
        channel: effectiveChannel,
        enabled: true,
      },
    });

    if (bundles.length === 0) {
      return { message: 'No update available' };
    }

    bundles.sort((a, b) => this.compareVersions(b.version, a.version));

    const candidate = bundles.find((bundle) => {
      const next = this.parseVersion(bundle.version);
      if (!next) return false;

      if (tester?.enabled) {
        if (tester?.targetVersion && bundle.version !== tester.targetVersion) {
          return false;
        }
        if (tester?.targetReleaseLine && this.getReleaseLine(bundle) !== tester.targetReleaseLine) {
          return false;
        }
      }

      if (currentBundleVersion) {
        if (this.compareVersions(bundle.version, currentBundleVersion) <= 0) {
          return false;
        }

        if (current && next.major !== current.major && !bundle.allowMajorUpgrade) {
          return false;
        }
      }

      if (bundle.minNativeVersion && nativeVersion) {
        if (this.compareVersions(nativeVersion, bundle.minNativeVersion) < 0) {
          return false;
        }
      }

      return true;
    });

    if (!candidate) {
      return { message: 'No update available' };
    }

    if (!candidate.isMandatory) {
      if (candidate.rolloutPercent < 100 && params.deviceId) {
        const hash = this.hashDeviceId(params.deviceId);
        if (hash % 100 >= candidate.rolloutPercent) {
          return { message: 'No update available' };
        }
      }
    }

    const { url } = await this.fileAssets.getPrivateUrlByAssetId(candidate.assetId);

    return {
      version: candidate.version,
      url,
      checksum: candidate.checksum,
      isMandatory: candidate.isMandatory,
      shouldNotify: this.shouldNotify(candidate, currentBundleVersion),
      releaseLine: this.getReleaseLine(candidate),
      notifyPolicy: candidate.notifyPolicy,
      channel: candidate.channel,
    };
  }

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
    return this.prisma.mobileBundle.create({
      data: this.normalizeBundleInput(dto),
    });
  }

  async updateBundle(id: string, dto: UpdateMobileBundleDto) {
    return this.prisma.mobileBundle.update({
      where: { id },
      data: this.normalizeBundleInput(dto),
    });
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

  private hashDeviceId(deviceId: string): number {
    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
      hash = ((hash << 5) - hash + deviceId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
  }

  private parseVersion(version: string): SemverParts | null {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) return null;
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
    };
  }

  private releaseLineOf(version: string): string | null {
    const parsed = this.parseVersion(version);
    return parsed ? `${parsed.major}.${parsed.minor}` : null;
  }

  private getReleaseLine(bundle: BundleLike) {
    return bundle.releaseLine || this.releaseLineOf(bundle.version);
  }

  private shouldNotify(bundle: BundleLike, currentBundleVersion?: string) {
    if (bundle.notifyPolicy === 'force') return true;
    if (bundle.notifyPolicy === 'silent') return false;
    if (!currentBundleVersion) return true;

    const current = this.parseVersion(currentBundleVersion);
    const next = this.parseVersion(bundle.version);
    if (!current || !next) return true;
    return current.major !== next.major || current.minor !== next.minor;
  }

  private normalizeBundleInput<T extends CreateMobileBundleDto | UpdateMobileBundleDto>(dto: T) {
    const data: any = { ...dto };
    if ('version' in dto && dto.version) {
      data.releaseLine = this.releaseLineOf(dto.version);
    }
    if (data.notifyPolicy && !['auto', 'silent', 'force'].includes(data.notifyPolicy)) {
      data.notifyPolicy = 'auto';
    }
    return data;
  }
}

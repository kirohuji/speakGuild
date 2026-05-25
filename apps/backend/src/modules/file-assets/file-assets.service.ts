import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import COS = require('cos-nodejs-sdk-v5');
import { FileAsset, FileAssetGroup, FileAssetStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateCosPolicyDto } from './dto/create-cos-policy.dto';
import { CreateReferenceDto } from './dto/create-reference.dto';
import { DeleteReferenceDto } from './dto/delete-reference.dto';
import { SetCurrentAvatarDto } from './dto/set-current-avatar.dto';

type IngestBufferInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  group: FileAssetGroup;
};

@Injectable()
export class FileAssetsService {
  private readonly logger = new Logger(FileAssetsService.name);
  constructor(private readonly prisma: PrismaService) {}

  private get bucket() {
    return process.env.COS_BUCKET?.trim() || '';
  }

  private get region() {
    return process.env.COS_REGION?.trim() || '';
  }

  private get cosHost() {
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com`;
  }

  private get privateUrlExpiresSeconds() {
    return Number(process.env.COS_PRIVATE_URL_EXPIRES_SECONDS ?? 3600);
  }

  private get cosClient() {
    const secretId = process.env.COS_SECRET_ID?.trim();
    const secretKey = process.env.COS_SECRET_KEY?.trim();
    if (!secretId || !secretKey || !this.bucket || !this.region) {
      throw new InternalServerErrorException(
        'COS 配置缺失，请检查 COS_SECRET_ID/COS_SECRET_KEY/COS_BUCKET/COS_REGION',
      );
    }
    return new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    });
  }

  async createCosPolicy(dto: CreateCosPolicyDto) {
    this.ensureGroup(dto.group);

    if (dto.sha256) {
      const existing = await this.prisma.fileAsset.findUnique({
        where: { sha256: dto.sha256.toLowerCase() },
      });
      if (existing && existing.status === FileAssetStatus.active) {
        return {
          exists: true,
          asset: existing,
        };
      }
    }

    const safeName = this.sanitizeFilename(dto.filename);
    const key = this.buildObjectKey(dto.group, safeName);
    const expiresIn = 900;
    const expirationUnix = Math.floor(Date.now() / 1000) + expiresIn;
    const authorization = this.cosClient.getAuth({
      Method: 'PUT',
      Key: key,
      Expires: expiresIn,
      Bucket: this.bucket,
      Region: this.region,
    });

    return {
      exists: false,
      key,
      uploadUrl: `${this.cosHost}/${key}`,
      method: 'PUT',
      headers: {
        Authorization: authorization,
        ...(dto.mimeType ? { 'Content-Type': dto.mimeType } : {}),
      },
      expiresAt: new Date(expirationUnix * 1000).toISOString(),
    };
  }

  async completeUpload(dto: CompleteUploadDto) {
    const key = dto.key.trim();
    this.assertKeyAllowed(dto.group, key);
    const sha256 = dto.sha256.toLowerCase();

    const dedupHit = await this.prisma.fileAsset.findUnique({ where: { sha256 } });
    if (dedupHit && dedupHit.status === FileAssetStatus.active) {
      return { deduped: true, asset: dedupHit };
    }

    await this.headObjectOrThrow(key);

    const created = await this.prisma.fileAsset.upsert({
      where: { sha256 },
      create: {
        sha256,
        bucket: this.bucket,
        region: this.region,
        cosKey: key,
        group: dto.group,
        size: dto.size,
        mimeType: dto.mimeType || 'application/octet-stream',
        filename: this.sanitizeFilename(dto.filename),
      },
      update: {
        status: FileAssetStatus.active,
      },
    });

    return { deduped: false, asset: created };
  }

  async createReference(userId: string, dto: CreateReferenceDto) {
    await this.ensureAssetExists(dto.assetId);

    const existing = await this.prisma.fileReference.findUnique({
      where: {
        assetId_bizType_bizId_userId: {
          assetId: dto.assetId,
          bizType: dto.bizType,
          bizId: dto.bizId,
          userId,
        },
      },
    });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.fileReference.create({
        data: {
          assetId: dto.assetId,
          bizType: dto.bizType,
          bizId: dto.bizId,
          userId,
        },
      });

      await tx.fileAsset.update({
        where: { id: dto.assetId },
        data: {
          refCount: { increment: 1 },
          lastReferencedAt: new Date(),
        },
      });

      return reference;
    });
  }

  async deleteReference(userId: string, dto: DeleteReferenceDto) {
    const existing = await this.prisma.fileReference.findUnique({
      where: {
        assetId_bizType_bizId_userId: {
          assetId: dto.assetId,
          bizType: dto.bizType,
          bizId: dto.bizId,
          userId,
        },
      },
    });
    if (!existing) return { success: true, removed: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.fileReference.delete({ where: { id: existing.id } });
      await tx.fileAsset.update({
        where: { id: dto.assetId },
        data: { refCount: { decrement: 1 } },
      });
    });

    return { success: true, removed: true };
  }

  async getPrivateUrlByAssetId(assetId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== FileAssetStatus.active) {
      throw new NotFoundException('文件不存在');
    }
    const url = await this.getSignedDownloadUrl(asset.cosKey);
    return { ...asset, url, expiresInSeconds: this.privateUrlExpiresSeconds };
  }

  /** 获取资产的长效签名 URL（用于嵌入内容，7 天有效） */
  async getAssetLongLivedUrl(assetId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== FileAssetStatus.active) {
      throw new NotFoundException('文件不存在');
    }
    const url = await this.getSignedDownloadUrl(asset.cosKey, 604800); // 7 天
    return { url, assetId: asset.id };
  }

  async listReferences(assetId: string) {
    await this.ensureAssetExists(assetId);
    return this.prisma.fileReference.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 按分组列出文件资产（带分页），返回带签名的可访问 URL（24h 有效） */
  async listByGroup(
    group: FileAssetGroup,
    pagination: { page?: number; pageSize?: number },
  ) {
    const page = pagination.page ?? 1;
    const pageSize = Math.min(pagination.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const [list, total] = await this.prisma.$transaction([
      this.prisma.fileAsset.findMany({
        where: { group, status: FileAssetStatus.active },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.fileAsset.count({
        where: { group, status: FileAssetStatus.active },
      }),
    ]);

    // 为每个文件生成签名 URL（24h）
    const urlExpires = 86400; // 24 小时
    const signedList = await Promise.all(
      list.map(async (a) => {
        const url = await this.getSignedDownloadUrl(a.cosKey, urlExpires);
        return {
          id: a.id,
          url,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          createdAt: a.createdAt,
        };
      }),
    );

    return {
      list: signedList,
      total,
      page,
      pageSize,
    };
  }

  async setCurrentAvatar(userId: string, dto: SetCurrentAvatarDto) {
    const asset = await this.ensureAssetExists(dto.assetId);
    if (asset.group !== FileAssetGroup.avatar) {
      throw new BadRequestException('仅支持设置 avatar 分组文件为头像');
    }

    const currentRefs = await this.prisma.fileReference.findMany({
      where: {
        bizType: 'avatar',
        bizId: userId,
        userId,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (currentRefs.length) {
        await tx.fileReference.deleteMany({
          where: {
            bizType: 'avatar',
            bizId: userId,
            userId,
          },
        });
        await Promise.all(
          currentRefs.map((ref) =>
            tx.fileAsset.update({
              where: { id: ref.assetId },
              data: { refCount: { decrement: 1 } },
            }),
          ),
        );
      }

      const alreadyBound = await tx.fileReference.findUnique({
        where: {
          assetId_bizType_bizId_userId: {
            assetId: dto.assetId,
            bizType: 'avatar',
            bizId: userId,
            userId,
          },
        },
      });

      if (!alreadyBound) {
        await tx.fileReference.create({
          data: {
            assetId: dto.assetId,
            bizType: 'avatar',
            bizId: userId,
            userId,
          },
        });
        await tx.fileAsset.update({
          where: { id: dto.assetId },
          data: {
            refCount: { increment: 1 },
            lastReferencedAt: new Date(),
          },
        });
      }
    });

    return this.getCurrentAvatar(userId);
  }

  async getCurrentAvatar(userId: string) {
    const ref = await this.prisma.fileReference.findFirst({
      where: {
        bizType: 'avatar',
        bizId: userId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!ref) return null;
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: ref.assetId } });
    if (!asset || asset.status !== FileAssetStatus.active) return null;
    const url = await this.getSignedDownloadUrl(asset.cosKey);
    return {
      assetId: asset.id,
      url,
      expiresInSeconds: this.privateUrlExpiresSeconds,
    };
  }

  async createAssetFromBuffer(input: IngestBufferInput): Promise<FileAsset> {
    this.ensureGroup(input.group);

    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const existing = await this.prisma.fileAsset.findUnique({ where: { sha256 } });
    if (existing && existing.status === FileAssetStatus.active) return existing;

    const safeName = this.sanitizeFilename(input.filename);
    const key = this.buildObjectKey(input.group, `${sha256}-${safeName}`);

    await new Promise<void>((resolve, reject) => {
      this.cosClient.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType || 'application/octet-stream',
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        },
      );
    });

    return this.prisma.fileAsset.upsert({
      where: { sha256 },
      create: {
        sha256,
        bucket: this.bucket,
        region: this.region,
        cosKey: key,
        group: input.group,
        size: input.buffer.length,
        mimeType: input.mimeType || 'application/octet-stream',
        filename: safeName,
      },
      update: {
        status: FileAssetStatus.active,
      },
    });
  }

  async createSystemReference(assetId: string, bizType: string, bizId: string) {
    return this.createReference('system', { assetId, bizType, bizId });
  }

  async deleteSystemReference(assetId: string, bizType: string, bizId: string) {
    return this.deleteReference('system', { assetId, bizType, bizId });
  }

  async cleanupUnreferencedAssets(days: number, dryRun = false) {
    const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.fileAsset.findMany({
      where: {
        status: FileAssetStatus.active,
        refCount: { lte: 0 },
        createdAt: { lt: before },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    if (!candidates.length) {
      return { scanned: 0, deleted: 0 };
    }

    if (dryRun) {
      this.logger.log(`[dry-run] cleanup candidates=${candidates.length}`);
      return { scanned: candidates.length, deleted: 0 };
    }

    let deleted = 0;
    for (const asset of candidates) {
      try {
        await this.deleteCosObject(asset.cosKey);
        await this.prisma.fileAsset.delete({ where: { id: asset.id } });
        deleted += 1;
      } catch (error) {
        this.logger.warn(`删除资产失败 assetId=${asset.id} err=${String(error)}`);
      }
    }
    return { scanned: candidates.length, deleted };
  }

  private async headObjectOrThrow(key: string) {
    await new Promise<void>((resolve, reject) => {
      this.cosClient.headObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        },
      );
    }).catch(() => {
      throw new BadRequestException('文件未上传或对象不存在');
    });
  }

  private async deleteCosObject(key: string) {
    await new Promise<void>((resolve, reject) => {
      this.cosClient.deleteObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        },
      );
    });
  }

  private async getSignedDownloadUrl(key: string, expires?: number) {
    return new Promise<string>((resolve, reject) => {
      this.cosClient.getObjectUrl(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Sign: true,
          Expires: expires ?? this.privateUrlExpiresSeconds,
        },
        (err, data) => {
          if (err) return reject(err);
          resolve(data.Url);
        },
      );
    });
  }

  private async ensureAssetExists(assetId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== FileAssetStatus.active) {
      throw new NotFoundException('文件资产不存在');
    }
    return asset;
  }

  private ensureGroup(group: FileAssetGroup) {
    const groups = Object.values(FileAssetGroup);
    if (!groups.includes(group)) {
      throw new BadRequestException('不支持的文件分组');
    }
  }

  private buildObjectKey(group: FileAssetGroup, filename: string) {
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `uploads/${group}/${yyyy}/${mm}/${dd}/${randomUUID()}-${filename}`;
  }

  private assertKeyAllowed(group: FileAssetGroup, key: string) {
    const expectedPrefix = `uploads/${group}/`;
    if (!key.startsWith(expectedPrefix)) {
      throw new BadRequestException('对象 key 与分组不匹配');
    }
    if (key.includes('..')) {
      throw new BadRequestException('对象 key 不合法');
    }
  }

  private sanitizeFilename(filename: string) {
    const base = basename(filename || 'file');
    const ext = extname(base);
    const name = base.slice(0, Math.max(1, base.length - ext.length));
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
    return `${safeName}${safeExt}`;
  }

}

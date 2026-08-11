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
import { FileAsset, FileAssetGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateCosPolicyDto } from './dto/create-cos-policy.dto';
import { CreateReferenceDto } from './dto/create-reference.dto';
import { SetCurrentAvatarDto } from './dto/set-current-avatar.dto';
import { MatchSamplingToneDto } from './dto/match-sampling-tone.dto';
import sharp = require('sharp');

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

  /** The only internal file identifier allowed in persisted business data. */
  getAssetReference(assetId: string, suffix = '') {
    return `asset://${encodeURIComponent(assetId)}${suffix}`;
  }

  private getAssetReferenceParts(rawValue: string) {
    if (!rawValue.startsWith('asset://')) return null;
    const raw = rawValue.slice('asset://'.length);
    const suffixIndex = raw.search(/[?#]/);
    const encodedId = suffixIndex >= 0 ? raw.slice(0, suffixIndex) : raw;
    if (!encodedId || encodedId.includes('/')) return null;
    try {
      return {
        assetId: decodeURIComponent(encodedId),
        suffix: suffixIndex >= 0 ? raw.slice(suffixIndex) : '',
      };
    } catch {
      return null;
    }
  }

  private getContentUrlParts(rawUrl: string) {
    try {
      const parsed = new URL(rawUrl, 'http://manyu.local');
      const match = parsed.pathname.match(/\/file-assets\/([^/]+)\/content\/?$/);
      return match?.[1]
        ? {
            assetId: decodeURIComponent(match[1]),
            suffix: `${parsed.search}${parsed.hash}`,
          }
        : null;
    } catch {
      return null;
    }
  }

  private getPersistentAssetParts(rawValue: string) {
    return this.getAssetReferenceParts(rawValue) ?? this.getContentUrlParts(rawValue);
  }

  private getOwnCosKey(rawUrl: string) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.origin !== this.cosHost) return null;
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch {
      return null;
    }
  }

  /** Resolve a persistent reference (or a transient own-COS URL used by server jobs). */
  async findAssetByPersistentUrl(rawUrl: string) {
    const reference = this.getPersistentAssetParts(rawUrl);
    if (reference) {
      return this.prisma.fileAsset.findFirst({
        where: { id: reference.assetId },
      });
    }

    const cosKey = this.getOwnCosKey(rawUrl);
    if (!cosKey) return null;
    return this.prisma.fileAsset.findFirst({
      where: { cosKey },
    });
  }

  /**
   * Validate and canonicalize internal asset references anywhere in a DTO/JSON
   * document. Direct COS URLs are transient credentials and are never allowed
   * in persistent business data. External URLs remain untouched.
   */
  async normalizePersistentAssetUrls<T>(value: T): Promise<T> {
    const cache = new Map<string, Promise<FileAsset | null>>();
    const findCached = (url: string) => {
      let pending = cache.get(url);
      if (!pending) {
        pending = this.findAssetByPersistentUrl(url);
        cache.set(url, pending);
      }
      return pending;
    };

    const visit = async (current: unknown): Promise<unknown> => {
      if (typeof current === 'string') {
        const reference = this.getPersistentAssetParts(current);
        const cosKey = this.getOwnCosKey(current);
        if (cosKey) {
          throw new BadRequestException(
            'Direct COS URLs cannot be persisted; save the FileAsset reference instead',
          );
        }
        if (!reference) return current;

        const asset = await findCached(current);
        if (!asset) {
          throw new BadRequestException(
            `File asset does not exist or is inactive: ${reference.assetId}`,
          );
        }
        return this.getAssetReference(asset.id, reference.suffix);
      }
      if (Array.isArray(current)) {
        return Promise.all(current.map((item) => visit(item)));
      }
      if (current && typeof current === 'object' && !(current instanceof Date)) {
        const entries = await Promise.all(
          Object.entries(current).map(async ([key, item]) => [key, await visit(item)] as const),
        );
        return Object.fromEntries(entries);
      }
      return current;
    };

    return (await visit(value)) as T;
  }

  private collectStableAssetIds(value: unknown, ids = new Set<string>()) {
    if (typeof value === 'string') {
      const reference = this.getPersistentAssetParts(value);
      if (reference) ids.add(reference.assetId);
      return ids;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectStableAssetIds(item, ids));
      return ids;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach((item) => this.collectStableAssetIds(item, ids));
    }
    return ids;
  }

  /** Keep cleanup protection in the same transaction as the business write. */
  async syncPersistentAssetReferences(
    tx: Prisma.TransactionClient,
    createdById: string,
    bizType: string,
    bizId: string,
    persistedValue: unknown,
  ) {
    const desiredIds = this.collectStableAssetIds(persistedValue);
    const assets = desiredIds.size
      ? await tx.fileAsset.findMany({
          where: { id: { in: [...desiredIds] } },
          select: { id: true },
        })
      : [];
    if (assets.length !== desiredIds.size) {
      throw new BadRequestException('业务数据引用了不存在或已删除的文件资源');
    }

    await tx.fileReference.deleteMany({ where: { bizType, bizId } });

    if (desiredIds.size) {
      await tx.fileReference.createMany({
        data: [...desiredIds].map((assetId) => ({ assetId, bizType, bizId, createdById })),
      });
    }
  }

  async createCosPolicy(dto: CreateCosPolicyDto) {
    this.ensureGroup(dto.group);

    if (dto.sha256) {
      const existing = await this.prisma.fileAsset.findUnique({
        where: { sha256: dto.sha256.toLowerCase() },
      });
      if (existing) {
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
    if (dedupHit) {
      return { deduped: true, asset: dedupHit };
    }

    await this.headObjectOrThrow(key);

    let created: FileAsset;
    try {
      created = await this.prisma.fileAsset.upsert({
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
        update: {},
      });
    } catch (error) {
      await this.deleteOrQueueOrphan(key, sha256);
      throw error;
    }

    const deduped = created.cosKey !== key;
    if (deduped) {
      await this.deleteOrQueueOrphan(key, sha256);
    }
    return { deduped, asset: created };
  }

  async createReference(createdById: string, dto: CreateReferenceDto) {
    await this.ensureAssetExists(dto.assetId);
    return this.prisma.fileReference.upsert({
      where: {
        assetId_bizType_bizId: {
          assetId: dto.assetId,
          bizType: dto.bizType,
          bizId: dto.bizId,
        },
      },
      create: {
        assetId: dto.assetId,
        bizType: dto.bizType,
        bizId: dto.bizId,
        createdById,
      },
      update: { createdById },
    });
  }

  private async deleteReference(assetId: string, bizType: string, bizId: string) {
    const existing = await this.prisma.fileReference.findUnique({
      where: {
        assetId_bizType_bizId: {
          assetId,
          bizType,
          bizId,
        },
      },
    });
    if (!existing) return { success: true, removed: false };

    await this.prisma.fileReference.delete({ where: { id: existing.id } });

    return { success: true, removed: true };
  }

  async getPrivateUrlByAssetId(assetId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('文件不存在');
    }
    const url = await this.getSignedDownloadUrl(asset.cosKey);
    return { ...asset, url, expiresInSeconds: this.privateUrlExpiresSeconds };
  }

  /**
   * 批量解析多个资产的可播放签名 URL（一次 DB 查询 + 逐资产签名）。
   * 列表序列化（feed / myWorks）用它避免每项一次 findUnique 的 N+1 查询。
   */
  async getPrivateUrlsByAssetIds(
    assetIds: string[],
    expiresSeconds: number = this.privateUrlExpiresSeconds,
  ): Promise<Map<string, string>> {
    const ids = [...new Set(assetIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const assets = await this.prisma.fileAsset.findMany({
      where: { id: { in: ids } },
      select: { id: true, cosKey: true },
    });
    const entries = await Promise.all(
      assets.map(async (asset) => {
        const url = await this.getSignedDownloadUrl(asset.cosKey, expiresSeconds);
        return [asset.id, url] as const;
      }),
    );
    return new Map(entries);
  }

  /** 获取资产的长效签名 URL（用于嵌入内容，7 天有效） */
  async getAssetLongLivedUrl(assetId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('文件不存在');
    }
    const url = await this.getSignedDownloadUrl(asset.cosKey, 604800); // 7 天
    return { url, assetId: asset.id };
  }

  async fetchAssetForSampling(rawUrl: string, range?: string) {
    const asset = await this.findAssetByPersistentUrl(rawUrl);
    let fetchUrl = rawUrl;
    if (asset) {
      fetchUrl = await this.getSignedDownloadUrl(asset.cosKey);
    } else {
      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        throw new BadRequestException('素材地址无效');
      }
      if (parsed.protocol !== 'https:' || parsed.origin !== this.cosHost) {
        throw new BadRequestException('仅允许读取当前 COS 存储桶素材');
      }
      parsed.hash = '';
      fetchUrl = parsed.toString();
    }
    const upstream = await fetch(fetchUrl, {
      headers: range ? { Range: range } : undefined,
    });
    if (!upstream.ok && upstream.status !== 206) {
      throw new BadRequestException(`COS 素材读取失败 (${upstream.status})`);
    }
    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      throw new BadRequestException('仅支持图片或视频采样');
    }
    return upstream;
  }

  async matchSamplingTone(dto: MatchSamplingToneDto) {
    const [background, resource] = await Promise.all([
      this.readSamplingPixels(dto.backgroundUrl),
      this.readSamplingPixels(dto.resourceUrl),
    ]);
    const backgroundTone = this.measureTone(background, {
      x: dto.positionX,
      y: dto.positionY,
      radius: 14,
    });
    const resourceTone = this.measureTone(resource);
    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));
    const style = {
      version: 2 as const,
      brightness: clamp(
        backgroundTone.luminance / Math.max(resourceTone.luminance, 0.08),
        0.55,
        1.45,
      ),
      contrast: clamp(
        0.9 + (backgroundTone.contrast - resourceTone.contrast),
        0.65,
        1.35,
      ),
      saturation: clamp(
        backgroundTone.saturation / Math.max(resourceTone.saturation, 0.08),
        0.35,
        1.65,
      ),
      hue: 0,
      warmth: clamp(
        backgroundTone.warmth - resourceTone.warmth,
        -0.65,
        0.65,
      ),
      shadowOpacity: clamp(
        0.35 - backgroundTone.luminance * 0.2,
        0.12,
        0.38,
      ),
    };
    return {
      style,
      samples: {
        background: backgroundTone,
        resource: resourceTone,
      },
    };
  }

  private async readSamplingPixels(url: string) {
    const upstream = await this.fetchAssetForSampling(url);
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException(
        '自动色调匹配目前需要图片底图；视频底图请先截取代表帧',
      );
    }
    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > 30 * 1024 * 1024) {
      throw new BadRequestException('采样图片不能超过 30MB');
    }
    const input = Buffer.from(await upstream.arrayBuffer());
    try {
      const { data, info } = await sharp(input)
        .resize(96, 96, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return {
        data,
        width: info.width,
        height: info.height,
        channels: info.channels,
      };
    } catch {
      throw new BadRequestException('图片解码失败，无法进行自动色调匹配');
    }
  }

  private measureTone(
    image: {
      data: Buffer;
      width: number;
      height: number;
      channels: number;
    },
    region?: { x: number; y: number; radius: number },
  ) {
    const centerX = region ? region.x * image.width : image.width / 2;
    const centerY = region ? region.y * image.height : image.height / 2;
    const radius = region ? region.radius : Math.max(image.width, image.height);
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(image.width, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(image.height, Math.ceil(centerY + radius));
    let weightTotal = 0;
    let luminanceTotal = 0;
    let luminanceSquaredTotal = 0;
    let saturationTotal = 0;
    let warmthTotal = 0;
    for (let y = minY; y < maxY; y += 1) {
      for (let x = minX; x < maxX; x += 1) {
        const offset = (y * image.width + x) * image.channels;
        const red = image.data[offset] / 255;
        const green = image.data[offset + 1] / 255;
        const blue = image.data[offset + 2] / 255;
        const alpha = image.data[offset + 3] / 255;
        if (alpha <= 0) continue;
        const maximum = Math.max(red, green, blue);
        const minimum = Math.min(red, green, blue);
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        weightTotal += alpha;
        luminanceTotal += luminance * alpha;
        luminanceSquaredTotal += luminance * luminance * alpha;
        saturationTotal +=
          (maximum ? (maximum - minimum) / maximum : 0) * alpha;
        warmthTotal += (red - blue) * alpha;
      }
    }
    if (weightTotal <= 0) {
      throw new BadRequestException('采样区域没有可见像素');
    }
    const luminance = luminanceTotal / weightTotal;
    const variance = Math.max(
      0,
      luminanceSquaredTotal / weightTotal - luminance * luminance,
    );
    return {
      luminance,
      contrast: Math.sqrt(variance),
      saturation: saturationTotal / weightTotal,
      warmth: warmthTotal / weightTotal,
    };
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
        where: { group },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.fileAsset.count({
        where: { group },
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
    if (asset.group !== FileAssetGroup.avatar && !asset.mimeType.startsWith('image/')) {
      throw new BadRequestException('仅支持设置图片文件为头像');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.fileReference.deleteMany({
        where: { bizType: 'avatar', bizId: userId },
      });
      await tx.fileReference.create({
        data: {
          assetId: dto.assetId,
          bizType: 'avatar',
          bizId: userId,
          createdById: userId,
        },
      });
    });

    return this.getCurrentAvatar(userId);
  }

  async getCurrentAvatar(userId: string) {
    const ref = await this.prisma.fileReference.findFirst({
      where: {
        bizType: 'avatar',
        bizId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!ref) {
      // 用户未在 App 内上传过头像时，回退到第三方登录（微信/Apple）提供的头像
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { image: true },
      });
      return user?.image ? { url: user.image } : null;
    }
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: ref.assetId } });
    if (!asset) return null;
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
    if (existing) return existing;

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

    let asset: FileAsset;
    try {
      asset = await this.prisma.fileAsset.upsert({
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
        update: {},
      });
    } catch (error) {
      await this.deleteOrQueueOrphan(key, sha256);
      throw error;
    }
    if (asset.cosKey !== key) {
      await this.deleteOrQueueOrphan(key, sha256);
    }
    return asset;
  }

  async createSystemReference(assetId: string, bizType: string, bizId: string) {
    return this.createReference('system', { assetId, bizType, bizId });
  }

  async deleteSystemReference(assetId: string, bizType: string, bizId: string) {
    return this.deleteReference(assetId, bizType, bizId);
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

  async deleteStoredObject(key: string, bucket = this.bucket, region = this.region) {
    await new Promise<void>((resolve, reject) => {
      this.cosClient.deleteObject(
        {
          Bucket: bucket,
          Region: region,
          Key: key,
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        },
      );
    });
  }

  private async deleteOrQueueOrphan(key: string, sha256: string) {
    try {
      await this.deleteStoredObject(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`failed to remove orphan object key=${key} err=${message}`);
      await this.prisma.fileAssetPurge.upsert({
        where: { cosKey: key },
        create: {
          assetId: null,
          bucket: this.bucket,
          region: this.region,
          cosKey: key,
          sha256,
          status: 'failed',
          attempts: 1,
          lastError: message,
        },
        update: {
          status: 'failed',
          attempts: { increment: 1 },
          lastError: message,
          completedAt: null,
        },
      });
    }
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
    if (!asset) {
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

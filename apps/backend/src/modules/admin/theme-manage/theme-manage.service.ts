import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CreateThemePresetDto, UpdateThemePresetDto } from './dto/theme-preset.dto';
import type { Prisma } from '@prisma/client';

type BgType = 'gradient' | 'image' | 'video' | 'animation';
type BgAssets = { gradient?: string; image?: string; video?: string };

const BG_PRIORITY: BgType[] = ['video', 'image', 'animation', 'gradient'];

function asAssets(value: unknown): BgAssets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    gradient: typeof raw.gradient === 'string' ? raw.gradient : undefined,
    image: typeof raw.image === 'string' ? raw.image : undefined,
    video: typeof raw.video === 'string' ? raw.video : undefined,
  };
}

function normalizeTypes(bgTypes?: string[], fallback?: string): BgType[] {
  const valid = (bgTypes ?? []).filter(
    (t): t is BgType =>
      t === 'gradient' || t === 'image' || t === 'video' || t === 'animation',
  );
  if (valid.length > 0) return BG_PRIORITY.filter((t) => valid.includes(t));
  if (fallback === 'gradient' || fallback === 'image' || fallback === 'video' || fallback === 'animation') {
    return [fallback];
  }
  return ['gradient'];
}

function hasAsset(type: BgType, assets: BgAssets): boolean {
  if (type === 'animation') return true;
  if (type === 'video') return !!assets.video?.trim();
  if (type === 'image') return !!assets.image?.trim();
  return !!assets.gradient?.trim();
}

function pickLegacySrc(primary: BgType, assets: BgAssets): string | undefined {
  if (primary === 'video') {
    return assets.video?.trim() || assets.image?.trim() || assets.gradient?.trim();
  }
  if (primary === 'image') {
    return assets.image?.trim() || assets.gradient?.trim();
  }
  return assets.gradient?.trim() || assets.image?.trim() || assets.video?.trim();
}

/** 从多选类型 + 分层资源推导兼容旧字段 */
function deriveLegacyFields(
  bgTypes: BgType[],
  lightAssets: BgAssets,
  darkAssets: BgAssets,
) {
  const primary =
    bgTypes.find((t) => hasAsset(t, lightAssets) || hasAsset(t, darkAssets) || t === 'animation')
    ?? bgTypes[0]
    ?? 'gradient';

  return {
    bgType: primary,
    lightBackground: pickLegacySrc(primary, lightAssets),
    darkBackground: pickLegacySrc(primary, darkAssets),
  };
}

@Injectable()
export class ThemeManageService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取所有主题（管理端，含未启用） */
  async findAll() {
    return this.prisma.themePreset.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** 获取所有启用的主题（用户端） */
  async findActive() {
    return this.prisma.themePreset.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** 获取单个主题详情 */
  async findById(id: string) {
    const preset = await this.prisma.themePreset.findUnique({ where: { id } });
    if (!preset) throw new NotFoundException('主题不存在');
    return preset;
  }

  /** 获取默认主题 */
  async findDefault() {
    const preset = await this.prisma.themePreset.findFirst({
      where: { isDefault: true, isActive: true },
    });
    return preset ?? (await this.prisma.themePreset.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }));
  }

  private buildPayload(dto: CreateThemePresetDto | UpdateThemePresetDto) {
    const bgTypes = normalizeTypes(dto.bgTypes, dto.bgType);
    const lightBgAssets = asAssets(dto.lightBgAssets);
    const darkBgAssets = asAssets(dto.darkBgAssets);

    // 若未传分层资源，从旧字段回填
    if (!lightBgAssets.gradient && !lightBgAssets.image && !lightBgAssets.video && dto.lightBackground) {
      const primary = bgTypes[0] ?? 'gradient';
      if (primary === 'image') lightBgAssets.image = dto.lightBackground;
      else if (primary === 'video') lightBgAssets.video = dto.lightBackground;
      else lightBgAssets.gradient = dto.lightBackground;
    }
    if (!darkBgAssets.gradient && !darkBgAssets.image && !darkBgAssets.video && dto.darkBackground) {
      const primary = bgTypes[0] ?? 'gradient';
      if (primary === 'image') darkBgAssets.image = dto.darkBackground;
      else if (primary === 'video') darkBgAssets.video = dto.darkBackground;
      else darkBgAssets.gradient = dto.darkBackground;
    }

    const legacy = deriveLegacyFields(bgTypes, lightBgAssets, darkBgAssets);

    return {
      bgType: legacy.bgType,
      bgTypes: bgTypes as unknown as Prisma.InputJsonValue,
      lightBgAssets: lightBgAssets as unknown as Prisma.InputJsonValue,
      darkBgAssets: darkBgAssets as unknown as Prisma.InputJsonValue,
      lightBackground: legacy.lightBackground,
      darkBackground: legacy.darkBackground,
    };
  }

  /** 创建主题 */
  async create(dto: CreateThemePresetDto) {
    if (dto.isDefault) {
      await this.prisma.themePreset.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const bg = this.buildPayload(dto);

    return this.prisma.themePreset.create({
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        bgType: bg.bgType,
        bgTypes: bg.bgTypes,
        lightBgAssets: bg.lightBgAssets,
        darkBgAssets: bg.darkBgAssets,
        lightColors: (dto.lightColors ?? undefined) as Prisma.InputJsonValue,
        lightBackground: bg.lightBackground,
        lightDecorations: (dto.lightDecorations ?? undefined) as Prisma.InputJsonValue,
        darkColors: (dto.darkColors ?? undefined) as Prisma.InputJsonValue,
        darkBackground: bg.darkBackground,
        darkDecorations: (dto.darkDecorations ?? undefined) as Prisma.InputJsonValue,
        bgmUrl: dto.bgmUrl,
        bgmVolume: dto.bgmVolume ?? 0.3,
      },
    });
  }

  /** 更新主题 */
  async update(id: string, dto: UpdateThemePresetDto) {
    const existing = await this.prisma.themePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('主题不存在');

    if (dto.isDefault) {
      await this.prisma.themePreset.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const bg = this.buildPayload({
      ...dto,
      bgType: dto.bgType ?? existing.bgType,
      bgTypes: dto.bgTypes ?? (Array.isArray(existing.bgTypes) ? (existing.bgTypes as string[]) : undefined),
      lightBgAssets: dto.lightBgAssets ?? asAssets(existing.lightBgAssets),
      darkBgAssets: dto.darkBgAssets ?? asAssets(existing.darkBgAssets),
      lightBackground: dto.lightBackground ?? existing.lightBackground ?? undefined,
      darkBackground: dto.darkBackground ?? existing.darkBackground ?? undefined,
    });

    return this.prisma.themePreset.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        isDefault: dto.isDefault,
        bgType: bg.bgType,
        bgTypes: bg.bgTypes,
        lightBgAssets: bg.lightBgAssets,
        darkBgAssets: bg.darkBgAssets,
        lightColors: (dto.lightColors ?? undefined) as Prisma.InputJsonValue,
        lightBackground: bg.lightBackground,
        lightDecorations: (dto.lightDecorations ?? undefined) as Prisma.InputJsonValue,
        darkColors: (dto.darkColors ?? undefined) as Prisma.InputJsonValue,
        darkBackground: bg.darkBackground,
        darkDecorations: (dto.darkDecorations ?? undefined) as Prisma.InputJsonValue,
        bgmUrl: dto.bgmUrl,
        bgmVolume: dto.bgmVolume,
      },
    });
  }

  /** 删除主题 */
  async remove(id: string) {
    const existing = await this.prisma.themePreset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('主题不存在');
    return this.prisma.themePreset.delete({ where: { id } });
  }

  /** 获取当前用户激活的主题 ID（轻量，仅返回 ID，前端从本地 presets 列表匹配完整数据） */
  async getUserThemeId(userId: string): Promise<{ id: string }> {
    const pref = await this.prisma.userPreference.findUnique({ where: { userId } });
    if (pref?.themePresetId) {
      const preset = await this.prisma.themePreset.findUnique({
        where: { id: pref.themePresetId },
        select: { id: true, isActive: true },
      });
      if (preset?.isActive) return { id: preset.id };
    }
    const def = await this.prisma.themePreset.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    });
    if (def) return { id: def.id };
    const first = await this.prisma.themePreset.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    return { id: first?.id ?? '' };
  }

  /** 用户切换主题 */
  async setUserTheme(userId: string, themePresetId: string | null) {
    if (themePresetId) {
      const preset = await this.prisma.themePreset.findUnique({
        where: { id: themePresetId },
      });
      if (!preset) throw new NotFoundException('主题不存在');
    }

    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, themePresetId },
      update: { themePresetId },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CreateThemePresetDto, UpdateThemePresetDto } from './dto/theme-preset.dto';
import type { Prisma } from '@prisma/client';

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

  /** 创建主题 */
  async create(dto: CreateThemePresetDto) {
    // 如果设置为默认，先取消其他默认
    if (dto.isDefault) {
      await this.prisma.themePreset.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.themePreset.create({
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        bgType: dto.bgType ?? 'gradient',
        lightColors: (dto.lightColors ?? undefined) as Prisma.InputJsonValue,
        lightBackground: dto.lightBackground,
        lightDecorations: (dto.lightDecorations ?? undefined) as Prisma.InputJsonValue,
        darkColors: (dto.darkColors ?? undefined) as Prisma.InputJsonValue,
        darkBackground: dto.darkBackground,
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

    // 如果设置为默认，先取消其他默认
    if (dto.isDefault) {
      await this.prisma.themePreset.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.themePreset.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        isDefault: dto.isDefault,
        bgType: dto.bgType,
        lightColors: (dto.lightColors ?? undefined) as Prisma.InputJsonValue,
        lightBackground: dto.lightBackground,
        lightDecorations: (dto.lightDecorations ?? undefined) as Prisma.InputJsonValue,
        darkColors: (dto.darkColors ?? undefined) as Prisma.InputJsonValue,
        darkBackground: dto.darkBackground,
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

  /** 获取当前用户激活的主题 */
  async getUserTheme(userId: string) {
    const pref = await this.prisma.userPreference.findUnique({ where: { userId } });
    if (pref?.themePresetId) {
      const preset = await this.prisma.themePreset.findUnique({
        where: { id: pref.themePresetId },
      });
      if (preset?.isActive) return preset;
    }
    // 回退到默认主题
    return this.findDefault();
  }

  /** 用户切换主题 */
  async setUserTheme(userId: string, themePresetId: string | null) {
    // 如果 themePresetId 不为 null，验证主题存在
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

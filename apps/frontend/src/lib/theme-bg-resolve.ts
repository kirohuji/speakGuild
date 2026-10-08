import type { ThemeBgAssets, ThemeBgType, ThemePreset } from '@/features/admin/theme-manage/api/theme-api';

/** 首页背景渲染优先级：视频 > 图片 > PixiJS > CSS 渐变 */
export const BG_TYPE_PRIORITY: ThemeBgType[] = ['video', 'image', 'animation', 'gradient'];

export const BG_TYPE_LABELS: Record<ThemeBgType, string> = {
  video: '背景视频',
  image: '背景图片',
  animation: 'PixiJS 动画',
  gradient: 'CSS 渐变',
};

export interface ResolvedThemeBackground {
  type: ThemeBgType;
  /** video / image / gradient 的资源；animation 无 src */
  src?: string;
}

function isBgType(value: unknown): value is ThemeBgType {
  return value === 'video' || value === 'image' || value === 'animation' || value === 'gradient';
}

function asAssets(value: unknown): ThemeBgAssets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    gradient: typeof raw.gradient === 'string' ? raw.gradient : undefined,
    image: typeof raw.image === 'string' ? raw.image : undefined,
    video: typeof raw.video === 'string' ? raw.video : undefined,
  };
}

/** 归一化启用的背景类型（兼容旧单选 bgType） */
export function normalizeBgTypes(preset: Pick<ThemePreset, 'bgType' | 'bgTypes'> | null | undefined): ThemeBgType[] {
  if (!preset) return ['gradient'];

  const fromArray = Array.isArray(preset.bgTypes)
    ? preset.bgTypes.filter(isBgType)
    : [];

  if (fromArray.length > 0) {
    // 按优先级排序，去重
    return BG_TYPE_PRIORITY.filter((t) => fromArray.includes(t));
  }

  return isBgType(preset.bgType) ? [preset.bgType] : ['gradient'];
}

/** 归一化分层资源（兼容旧 lightBackground / darkBackground） */
export function normalizeBgAssets(
  preset: Pick<ThemePreset, 'bgType' | 'bgTypes' | 'lightBackground' | 'darkBackground' | 'lightBgAssets' | 'darkBgAssets'> | null | undefined,
  mode: 'light' | 'dark',
): ThemeBgAssets {
  if (!preset) return {};

  const stored = asAssets(mode === 'dark' ? preset.darkBgAssets : preset.lightBgAssets);
  const hasStored =
    !!stored.gradient?.trim() || !!stored.image?.trim() || !!stored.video?.trim();
  if (hasStored) return stored;

  const legacyBg = (mode === 'dark' ? preset.darkBackground : preset.lightBackground)?.trim();
  if (!legacyBg) return {};

  const types = normalizeBgTypes(preset);
  const primary = types[0] ?? (isBgType(preset.bgType) ? preset.bgType : 'gradient');

  if (primary === 'image') return { image: legacyBg };
  if (primary === 'video') return { video: legacyBg };
  // animation 主题 historically 把渐变落在 lightBackground 里，作为回退层
  return { gradient: legacyBg };
}

function hasAsset(type: ThemeBgType, assets: ThemeBgAssets): boolean {
  if (type === 'animation') return true;
  if (type === 'video') return !!assets.video?.trim();
  if (type === 'image') return !!assets.image?.trim();
  return !!assets.gradient?.trim();
}

function assetFor(type: ThemeBgType, assets: ThemeBgAssets): string | undefined {
  if (type === 'video') return assets.video?.trim() || undefined;
  if (type === 'image') return assets.image?.trim() || undefined;
  if (type === 'gradient') return assets.gradient?.trim() || undefined;
  return undefined;
}

/**
 * 按优先级解析最终应渲染的背景。
 * 某类型已勾选但缺资源时，继续向下回退。
 */
export function resolveThemeBackground(
  preset: ThemePreset | null | undefined,
  mode: 'light' | 'dark',
): ResolvedThemeBackground | null {
  if (!preset) return null;

  const types = normalizeBgTypes(preset);
  const assets = normalizeBgAssets(preset, mode);

  for (const type of BG_TYPE_PRIORITY) {
    if (!types.includes(type)) continue;
    if (!hasAsset(type, assets)) continue;
    return { type, src: assetFor(type, assets) };
  }

  // 最后兜底：任意可用资源
  if (assets.video?.trim()) return { type: 'video', src: assets.video.trim() };
  if (assets.image?.trim()) return { type: 'image', src: assets.image.trim() };
  if (assets.gradient?.trim()) return { type: 'gradient', src: assets.gradient.trim() };

  return null;
}

/** 从启用类型 + 资源推导主 bgType / 兼容背景字符串（写回旧字段） */
export function deriveLegacyBackgroundFields(
  bgTypes: ThemeBgType[],
  lightAssets: ThemeBgAssets,
  darkAssets: ThemeBgAssets,
): {
  bgType: ThemeBgType;
  lightBackground?: string;
  darkBackground?: string;
} {
  const types = BG_TYPE_PRIORITY.filter((t) => bgTypes.includes(t));
  const primary =
    types.find((t) => hasAsset(t, lightAssets) || hasAsset(t, darkAssets) || t === 'animation')
    ?? types[0]
    ?? 'gradient';

  const pickLegacy = (assets: ThemeBgAssets): string | undefined => {
    if (primary === 'video') return assets.video?.trim() || assets.image?.trim() || assets.gradient?.trim();
    if (primary === 'image') return assets.image?.trim() || assets.gradient?.trim();
    return assets.gradient?.trim() || assets.image?.trim() || assets.video?.trim();
  };

  return {
    bgType: primary,
    lightBackground: pickLegacy(lightAssets),
    darkBackground: pickLegacy(darkAssets),
  };
}

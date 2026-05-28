import type { ThemePreset } from '@/features/admin/theme-manage/api/theme-api';

/**
 * CSS 变量键名映射：ThemePreset 中的 color key → CSS 自定义属性名
 * 这些是 shadcn/ui 使用的所有语义变量
 */
const CSS_VAR_MAP: Record<string, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  success: '--success',
  successForeground: '--success-foreground',
  warning: '--warning',
  warningForeground: '--warning-foreground',
  sidebarBackground: '--sidebar-background',
  sidebarForeground: '--sidebar-foreground',
  sidebarPrimary: '--sidebar-primary',
  sidebarPrimaryForeground: '--sidebar-primary-foreground',
  sidebarAccent: '--sidebar-accent',
  sidebarAccentForeground: '--sidebar-accent-foreground',
  sidebarBorder: '--sidebar-border',
  sidebarRing: '--sidebar-ring',
};

/** 默认色板 — 与 index.css 中的 :root 保持一致，作为预设未提供时的回退 */
const FALLBACK_LIGHT_COLORS: Record<string, string> = {
  background: '156 43% 97%',
  foreground: '211 32% 18%',
  card: '0 0% 100%',
  cardForeground: '211 32% 18%',
  popover: '0 0% 100%',
  popoverForeground: '211 32% 18%',
  primary: '212 100% 18.6%',
  primaryForeground: '0 0% 100%',
  secondary: '212 100% 98.5%',
  secondaryForeground: '211 32% 18%',
  muted: '212 39% 93.5%',
  mutedForeground: '212 16% 44%',
  accent: '7 100% 63.5%',
  accentForeground: '0 0% 100%',
  destructive: '358 73% 59%',
  destructiveForeground: '0 0% 100%',
  border: '211 37% 90%',
  input: '211 37% 90%',
  ring: '7 100% 63.5%',
  success: '147 74% 36%',
  successForeground: '0 0% 100%',
  warning: '37 91% 55%',
  warningForeground: '211 32% 18%',
  sidebarBackground: '156 43% 97%',
  sidebarForeground: '211 32% 18%',
  sidebarPrimary: '212 100% 18.6%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '212 100% 98.5%',
  sidebarAccentForeground: '211 32% 18%',
  sidebarBorder: '211 37% 90%',
  sidebarRing: '7 100% 63.5%',
};

const FALLBACK_DARK_COLORS: Record<string, string> = {
  background: '252 43% 5%',
  foreground: '0 0% 100%',
  card: '258 36% 10%',
  cardForeground: '0 0% 100%',
  popover: '258 36% 10%',
  popoverForeground: '0 0% 100%',
  primary: '0 0% 100%',
  primaryForeground: '212 100% 18.6%',
  secondary: '266 31% 14%',
  secondaryForeground: '0 0% 100%',
  muted: '266 27% 14%',
  mutedForeground: '260 18% 78%',
  accent: '7 100% 63.5%',
  accentForeground: '0 0% 100%',
  destructive: '358 73% 59%',
  destructiveForeground: '0 0% 100%',
  border: '260 22% 22%',
  input: '260 22% 22%',
  ring: '7 100% 63.5%',
  success: '147 60% 50%',
  successForeground: '0 0% 100%',
  warning: '37 91% 55%',
  warningForeground: '212 100% 18.6%',
  sidebarBackground: '252 43% 5%',
  sidebarForeground: '0 0% 100%',
  sidebarPrimary: '7 100% 63.5%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '266 31% 14%',
  sidebarAccentForeground: '0 0% 100%',
  sidebarBorder: '260 22% 22%',
  sidebarRing: '7 100% 63.5%',
};

/**
 * 将主题预设的色板应用到 document.documentElement 的 CSS 变量
 * @param preset - 主题预设数据
 * @param mode - 'light' | 'dark'
 */
export function applyPresetColors(
  preset: ThemePreset | null,
  mode: 'light' | 'dark',
): void {
  const root = document.documentElement;
  const fallback = mode === 'dark' ? FALLBACK_DARK_COLORS : FALLBACK_LIGHT_COLORS;
  const presetColors = mode === 'dark' ? preset?.darkColors : preset?.lightColors;

  for (const [colorKey, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const value = presetColors?.[colorKey] ?? fallback[colorKey];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  }

  // 设置沉浸式背景 CSS 变量
  const bg = mode === 'dark' ? preset?.darkBackground : preset?.lightBackground;
  if (bg) {
    root.style.setProperty('--app-bg-image', bg);
  } else {
    root.style.removeProperty('--app-bg-image');
  }

  // 存储装饰配置到 dataset，供 ImmersiveBackground 组件读取
  const decorations = mode === 'dark' ? preset?.darkDecorations : preset?.lightDecorations;
  if (decorations?.length) {
    root.setAttribute('data-theme-decorations', JSON.stringify(decorations));
  } else {
    root.removeAttribute('data-theme-decorations');
  }
}

/**
 * 清除动态注入的 CSS 变量，恢复到 index.css 的静态默认值
 */
export function clearPresetColors(): void {
  const root = document.documentElement;
  for (const cssVar of Object.values(CSS_VAR_MAP)) {
    root.style.removeProperty(cssVar);
  }
  root.style.removeProperty('--app-bg-image');
  root.removeAttribute('data-theme-decorations');
}

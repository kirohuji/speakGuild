import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/providers/auth-provider';
import { useThemePresetStore } from '@/stores/theme-preset.store';
import { applyPresetColors, clearPresetColors } from '@/lib/theme-preset-utils';

interface ThemePresetContextValue {
  /** 可用主题列表 */
  presets: ReturnType<typeof useThemePresetStore.getState>['presets'];
  /** 当前激活的主题 */
  activePreset: ReturnType<typeof useThemePresetStore.getState>['activePreset'];
  /** 切换主题 */
  setActivePreset: (presetId: string | null) => Promise<void>;
  /** 是否加载中 */
  loading: boolean;
}

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null);

export function useThemePreset() {
  const ctx = useContext(ThemePresetContext);
  if (!ctx) throw new Error('useThemePreset must be used within ThemePresetProvider');
  return ctx;
}

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { resolvedTheme } = useTheme();
  const store = useThemePresetStore();

  const isLoggedIn = !!session?.user?.id;

  // 加载主题数据
  useEffect(() => {
    store.loadPresets();
    store.loadActivePreset(isLoggedIn);
  }, [isLoggedIn]);

  // 当主题预设或 light/dark 模式变化时，动态注入 CSS 变量
  useEffect(() => {
    const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
    if (store.activePreset) {
      applyPresetColors(store.activePreset, mode);
    }
  }, [store.activePreset, resolvedTheme]);

  // 清理：组件卸载时恢复默认
  useEffect(() => {
    return () => {
      clearPresetColors();
    };
  }, []);

  return (
    <ThemePresetContext.Provider
      value={{
        presets: store.presets,
        activePreset: store.activePreset,
        setActivePreset: store.setActivePreset,
        loading: store.loading,
      }}
    >
      {children}
    </ThemePresetContext.Provider>
  );
}

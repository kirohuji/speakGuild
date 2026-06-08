import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/providers/auth-provider';
import { useThemePresetStore } from '@/stores/theme-preset.store';
import { usePreferencesStore } from '@/stores/preferences.store';
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
  const { bgmEnabled, bgmVolume } = usePreferencesStore();
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const isLoggedIn = !!session?.user?.id;

  // 加载用户激活的主题（不加载列表——列表在打开主题选择器时才请求）
  useEffect(() => {
    store.loadActivePreset(isLoggedIn);
  }, [isLoggedIn]);

  // 兜底：presets 加载完后，如果 activePreset 仍为空，从列表中取默认主题
  useEffect(() => {
    if (!store.activePreset && store.presetsLoaded && store.presets.length > 0) {
      const defaultPreset =
        store.presets.find((p) => p.id === 'theme-default') ||
        store.presets.find((p) => p.isDefault) ||
        store.presets[0];
      if (defaultPreset) {
        useThemePresetStore.setState({ activePreset: defaultPreset });
      }
    }
  }, [store.activePreset, store.presetsLoaded, store.presets]);

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

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;
    const volume = bgmVolume ?? store.activePreset?.bgmVolume ?? 0.3;
    audio.volume = Math.min(1, Math.max(0, volume));
  }, [bgmVolume, store.activePreset?.bgmVolume]);

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;

    if (!bgmEnabled || !store.activePreset?.bgmUrl) {
      audio.pause();
      return;
    }

    const resumePlayback = () => {
      void audio.play().catch(() => {});
    };
    let cancelled = false;

    void audio.play().catch(() => {
      // Browsers may block restoring persisted BGM until the user interacts.
      if (!cancelled) {
        document.addEventListener('pointerdown', resumePlayback, { once: true });
      }
    });

    return () => {
      cancelled = true;
      document.removeEventListener('pointerdown', resumePlayback);
    };
  }, [bgmEnabled, store.activePreset?.bgmUrl]);

  return (
    <ThemePresetContext.Provider
      value={{
        presets: store.presets,
        activePreset: store.activePreset,
        setActivePreset: store.setActivePreset,
        loading: store.loading,
      }}
    >
      <audio
        ref={bgmAudioRef}
        src={store.activePreset?.bgmUrl ?? undefined}
        loop
        preload="none"
      />
      {children}
    </ThemePresetContext.Provider>
  );
}

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/providers/auth-provider';
import { useThemePresetStore } from '@/stores/theme-preset.store';
import { usePreferencesStore } from '@/stores/preferences.store';
import { applyPresetColors, clearPresetColors } from '@/lib/theme-preset-utils';
import { isBgmSuppressed, subscribeBgmSuppress } from '@/lib/bgm-suppress';
import { resolveBgmDisplayVolume, toBgmGain } from '@/lib/bgm-volume';
import { isNative } from '@/lib/native';

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

type BgmGraph = {
  context: AudioContext;
  gain: GainNode;
};

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { resolvedTheme } = useTheme();
  const store = useThemePresetStore();
  const { bgmEnabled, bgmVolume } = usePreferencesStore();
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmGraphRef = useRef<BgmGraph | null>(null);
  const bgmSuppressed = useSyncExternalStore(subscribeBgmSuppress, isBgmSuppressed, () => false);

  const userId = session?.user?.id ?? null;

  // 加载用户激活的主题（不加载列表——列表在打开主题选择器时才请求）
  useEffect(() => {
    void store.loadActivePreset(userId);
  }, [userId]);

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
    } else {
      clearPresetColors();
    }
  }, [store.activePreset, resolvedTheme]);

  // 清理：组件卸载时恢复默认并释放 AudioContext
  useEffect(() => {
    return () => {
      clearPresetColors();
      const graph = bgmGraphRef.current;
      bgmGraphRef.current = null;
      if (graph) void graph.context.close().catch(() => undefined);
    };
  }, []);

  /**
   * Web 跨域 file-assets 一旦 createMediaElementSource，CORS 会输出静音。
   * 仅 Capacitor（尤其是 iOS）需要 GainNode 绕过 element.volume 无效；
   * Web 直接用 element.volume + 50% 上限即可。
   */
  const ensureBgmGraph = (audio: HTMLAudioElement): BgmGraph | null => {
    if (!isNative()) return null;
    if (bgmGraphRef.current) return bgmGraphRef.current;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      const context = new AudioCtx();
      const gain = context.createGain();
      const source = context.createMediaElementSource(audio);
      audio.volume = 1;
      source.connect(gain);
      gain.connect(context.destination);
      const graph = { context, gain };
      bgmGraphRef.current = graph;
      return graph;
    } catch {
      return null;
    }
  };

  const applyBgmGain = (audio: HTMLAudioElement) => {
    const display = resolveBgmDisplayVolume(bgmVolume, store.activePreset?.bgmVolume);
    const gainValue = toBgmGain(display);
    const graph = ensureBgmGraph(audio);
    if (graph) {
      graph.gain.gain.value = gainValue;
      audio.volume = 1;
      return;
    }
    audio.volume = gainValue;
  };

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;
    applyBgmGain(audio);
  }, [bgmVolume, store.activePreset?.bgmVolume]);

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;

    if (!bgmEnabled || !store.activePreset?.bgmUrl || bgmSuppressed) {
      audio.pause();
      return;
    }

    applyBgmGain(audio);

    const resumePlayback = () => {
      const graph = bgmGraphRef.current ?? ensureBgmGraph(audio);
      if (graph && graph.context.state === 'suspended') {
        void graph.context.resume().catch(() => undefined);
      }
      void audio.play().catch(() => {});
    };
    let cancelled = false;

    const graph = ensureBgmGraph(audio);
    if (graph && graph.context.state === 'suspended') {
      void graph.context.resume().catch(() => undefined);
    }

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
  }, [bgmEnabled, bgmSuppressed, store.activePreset?.bgmUrl]);

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
        data-persistent-media
        loop
        preload="none"
      />
      {children}
    </ThemePresetContext.Provider>
  );
}

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/providers/auth-provider';
import { useThemePresetStore } from '@/stores/theme-preset.store';
import { usePreferencesStore } from '@/stores/preferences.store';
import { applyPresetColors, clearPresetColors } from '@/lib/theme-preset-utils';
import { isBgmSuppressed, subscribeBgmSuppress } from '@/lib/bgm-suppress';
import { canUseBgmWebAudioGraph, resolveBgmDisplayVolume, toBgmGain } from '@/lib/bgm-volume';
import { resolveFileAssetUrl } from '@/lib/file-asset-reference';
import { isNative } from '@/lib/native';
import { isCachedPlaybackUrl } from '@/lib/offline/asset-cache.service';
import { resolvePlaybackAudio } from '@/lib/offline/playback-audio';

interface ThemePresetContextValue {
  /** 可用主题列表 */
  presets: ReturnType<typeof useThemePresetStore.getState>['presets'];
  /** 当前激活的主题 */
  activePreset: ReturnType<typeof useThemePresetStore.getState>['activePreset'];
  /** 切换主题 */
  setActivePreset: (presetId: string | null) => Promise<void>;
  /** 是否加载中 */
  loading: boolean;
  /**
   * Call from a direct user gesture (e.g. BGM switch) so iOS WKWebView
   * unlocks AudioContext + HTMLAudioElement.play() in the same stack.
   */
  primeBgmPlayback: () => void;
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

function closeBgmGraph(graphRef: { current: BgmGraph | null }) {
  const graph = graphRef.current;
  graphRef.current = null;
  if (graph) void graph.context.close().catch(() => undefined);
}

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { resolvedTheme } = useTheme();
  const store = useThemePresetStore();
  const { bgmEnabled, bgmVolume } = usePreferencesStore();
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmGraphRef = useRef<BgmGraph | null>(null);
  const bgmSuppressed = useSyncExternalStore(subscribeBgmSuppress, isBgmSuppressed, () => false);
  const [playbackSrc, setPlaybackSrc] = useState<string | undefined>(undefined);

  const userId = session?.user?.id ?? null;
  const presetBgmUrl = store.activePreset?.bgmUrl ?? null;

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

  // Native: play remote ASAP (element.volume), then upgrade to a cached capacitor://
  // URL so GainNode can control volume without CORS silence from MediaElementSource.
  useEffect(() => {
    let cancelled = false;

    if (!presetBgmUrl) {
      setPlaybackSrc(undefined);
      return () => {
        cancelled = true;
      };
    }

    const remoteUrl = resolveFileAssetUrl(presetBgmUrl) || presetBgmUrl;

    if (!isNative()) {
      setPlaybackSrc(remoteUrl);
      return () => {
        cancelled = true;
      };
    }

    // Prefer an already-cached local URL; otherwise start with remote so the
    // switch can play immediately via element.volume (no MediaElementSource yet).
    setPlaybackSrc((prev) => (prev && isCachedPlaybackUrl(prev) ? prev : remoteUrl));

    void resolvePlaybackAudio({ url: remoteUrl || presetBgmUrl, role: 'bgm', asFileUri: false })
      .then((local) => {
        if (cancelled || !local) return;
        // Keep the same <audio> + MediaElementSource for the element lifetime;
        // only swap the src to the same-origin capacitor:// URL.
        setPlaybackSrc((prev) => (prev === local ? prev : local));
      })
      .catch(() => {
        if (!cancelled) setPlaybackSrc((prev) => prev || remoteUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [presetBgmUrl]);

  // 清理：组件卸载时恢复默认并释放 AudioContext
  useEffect(() => {
    return () => {
      clearPresetColors();
      closeBgmGraph(bgmGraphRef);
    };
  }, []);

  /**
   * Web / remote COS URLs: createMediaElementSource → CORS silence.
   * Only wire GainNode for local Capacitor playback URLs (iOS element.volume is unreliable).
   */
  const ensureBgmGraph = (audio: HTMLAudioElement): BgmGraph | null => {
    if (!isNative()) return null;
    if (!canUseBgmWebAudioGraph(audio.currentSrc || audio.src || playbackSrc)) return null;
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

  const primeBgmPlayback = () => {
    const audio = bgmAudioRef.current;
    if (!audio || !playbackSrc) return;
    applyBgmGain(audio);
    const graph = bgmGraphRef.current ?? ensureBgmGraph(audio);
    if (graph && graph.context.state === 'suspended') {
      void graph.context.resume().catch(() => undefined);
    }
    void audio.play().catch(() => undefined);
  };

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;
    applyBgmGain(audio);
  }, [bgmVolume, store.activePreset?.bgmVolume, playbackSrc]);

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;

    if (!bgmEnabled || !playbackSrc || bgmSuppressed) {
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

    const startPlayback = () => {
      if (cancelled) return;
      const graph = ensureBgmGraph(audio);
      if (graph && graph.context.state === 'suspended') {
        void graph.context.resume().catch(() => undefined);
      }
      void audio.play().catch(() => {
        // iOS WKWebView often rejects play() outside the original gesture stack.
        if (!cancelled) {
          document.addEventListener('pointerdown', resumePlayback, { once: true });
          document.addEventListener('touchstart', resumePlayback, { once: true, passive: true });
          document.addEventListener('click', resumePlayback, { once: true });
        }
      });
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    } else {
      audio.addEventListener('canplay', startPlayback, { once: true });
      try {
        audio.load();
      } catch {
        startPlayback();
      }
    }

    return () => {
      cancelled = true;
      audio.removeEventListener('canplay', startPlayback);
      document.removeEventListener('pointerdown', resumePlayback);
      document.removeEventListener('touchstart', resumePlayback);
      document.removeEventListener('click', resumePlayback);
    };
  }, [bgmEnabled, bgmSuppressed, playbackSrc]);

  return (
    <ThemePresetContext.Provider
      value={{
        presets: store.presets,
        activePreset: store.activePreset,
        setActivePreset: store.setActivePreset,
        loading: store.loading,
        primeBgmPlayback,
      }}
    >
      <audio
        ref={bgmAudioRef}
        src={playbackSrc}
        data-persistent-media
        loop
        playsInline
        preload={bgmEnabled && playbackSrc ? 'auto' : 'none'}
      />
      {children}
    </ThemePresetContext.Provider>
  );
}

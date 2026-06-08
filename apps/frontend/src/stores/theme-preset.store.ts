import { create } from 'zustand';
import type { ThemePreset } from '@/features/admin/theme-manage/api/theme-api';
import { themeApi } from '@/features/admin/theme-manage/api/theme-api';

// ── 默认主题 ID（不需要请求 /themes/default，从 presets 列表中查找即可） ──
const DEFAULT_PRESET_ID = 'theme-default';

// ── 主题列表缓存（localStorage, 1 小时 TTL） ──
const THEMES_CACHE_KEY = 'manyu-themes-cache';
const THEMES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时

// ── 当前激活主题缓存（localStorage, 7 天 TTL，后台异步刷新） ──
const ACTIVE_PRESET_CACHE_KEY = 'manyu-active-preset';

interface ActivePresetCache {
  /** 缓存的主题完整数据 */
  preset: ThemePreset;
  cachedAt: number;
}

interface ThemesCache {
  data: ThemePreset[];
  cachedAt: number;
}

function readCache<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cache = JSON.parse(raw) as { cachedAt: number } & T;
    if (Date.now() - cache.cachedAt > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    return cache as unknown as T;
  } catch {
    return null;
  }
}

function writeCache<T extends object>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, cachedAt: Date.now() }));
  } catch {
    // localStorage full, ignore
  }
}

// ── 从 presets 列表中查找默认主题 ──
function findDefault(presets: ThemePreset[]): ThemePreset | null {
  return presets.find((p) => p.id === DEFAULT_PRESET_ID)
    || presets.find((p) => p.isDefault)
    || presets[0]
    || null;
}

// ── Store ──

interface ThemePresetStore {
  presets: ThemePreset[];
  activePreset: ThemePreset | null;
  presetsLoaded: boolean;
  loading: boolean;
  error: string | null;

  /** 确保主题列表已加载（缓存优先） */
  ensurePresets: () => Promise<void>;
  /** 加载当前激活的主题（缓存优先，API 后台刷新） */
  loadActivePreset: (isLoggedIn: boolean) => Promise<void>;
  /** 切换主题（乐观更新 + 本地缓存 + API 后台同步） */
  setActivePreset: (presetId: string | null) => Promise<void>;
  /** 清除 */
  reset: () => void;
}

export const useThemePresetStore = create<ThemePresetStore>((set, get) => ({
  presets: [],
  activePreset: null,
  presetsLoaded: false,
  loading: false,
  error: null,

  ensurePresets: async () => {
    const { presetsLoaded } = get();
    if (presetsLoaded) return;

    // 1. 尝试读缓存
    const cache = readCache<ThemesCache>(THEMES_CACHE_KEY, THEMES_CACHE_TTL_MS);
    if (cache) {
      set({ presets: cache.data, presetsLoaded: true });
      return;
    }

    // 2. 网络请求
    try {
      const data = await themeApi.listActive();
      writeCache(THEMES_CACHE_KEY, { data });
      set({ presets: data, presetsLoaded: true });
    } catch {
      set({ presetsLoaded: true });
    }
  },

  loadActivePreset: async (isLoggedIn: boolean) => {
    set({ loading: true, error: null });

    // ── 第一步：读本地缓存（立即生效，0 请求） ──
    const localActive = readCache<ActivePresetCache>(ACTIVE_PRESET_CACHE_KEY, 7 * 24 * 60 * 60 * 1000);
    if (localActive) {
      set({ activePreset: localActive.preset, loading: false });
    }

    if (!isLoggedIn) {
      // 未登录：仅用本地缓存，没有任何 API 请求
      if (!localActive) {
        // 本地也没缓存 → 等 presets 加载后再从中取默认
        set({ loading: false });
      }
      return;
    }

    // ── 第二步：后台异步刷新远端数据 ──
    try {
      const remote = await themeApi.getActive();
      // 远端数据优先，同步更新本地缓存
      writeCache(ACTIVE_PRESET_CACHE_KEY, { preset: remote });
      set({ activePreset: remote, loading: false });
    } catch {
      // API 失败：本地缓存已生效，无需额外处理
      if (!localActive) {
        set({ loading: false });
      }
    }
  },

  setActivePreset: async (presetId: string | null) => {
    const { presets } = get();

    // ── 乐观更新 + 立即写本地缓存 ──
    const targetPreset = presetId
      ? presets.find((p) => p.id === presetId) ?? null
      : findDefault(presets);
    if (targetPreset) {
      set({ activePreset: targetPreset });
      writeCache(ACTIVE_PRESET_CACHE_KEY, { preset: targetPreset });
    }

    // ── API 后台同步 ──
    try {
      await themeApi.setActive(presetId);
    } catch (err: any) {
      throw new Error(err?.response?.data?.message || '切换主题失败');
    }
  },

  reset: () => {
    set({ presets: [], activePreset: null, presetsLoaded: false, loading: false, error: null });
  },
}));

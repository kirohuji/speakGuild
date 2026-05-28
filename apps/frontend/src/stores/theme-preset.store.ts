import { create } from 'zustand';
import type { ThemePreset } from '@/features/admin/theme-manage/api/theme-api';
import { themeApi } from '@/features/admin/theme-manage/api/theme-api';

interface ThemePresetStore {
  /** 所有可用主题列表 */
  presets: ThemePreset[];
  /** 当前激活的主题 */
  activePreset: ThemePreset | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 加载主题列表 */
  loadPresets: () => Promise<void>;
  /** 加载当前激活的主题 */
  loadActivePreset: (isLoggedIn: boolean) => Promise<void>;
  /** 切换主题 */
  setActivePreset: (presetId: string | null) => Promise<void>;
  /** 清除 */
  reset: () => void;
}

export const useThemePresetStore = create<ThemePresetStore>((set, get) => ({
  presets: [],
  activePreset: null,
  loading: false,
  error: null,

  loadPresets: async () => {
    try {
      const data = await themeApi.listActive();
      set({ presets: data });
    } catch {
      // 静默失败，保留已有数据
    }
  },

  loadActivePreset: async (isLoggedIn: boolean) => {
    set({ loading: true, error: null });
    try {
      if (isLoggedIn) {
        const active = await themeApi.getActive();
        set({ activePreset: active, loading: false });
      } else {
        const defaultPreset = await themeApi.getDefault();
        set({ activePreset: defaultPreset, loading: false });
      }
    } catch {
      // 回退：尝试获取默认主题
      try {
        const defaultPreset = await themeApi.getDefault();
        set({ activePreset: defaultPreset, loading: false });
      } catch {
        set({ activePreset: null, loading: false, error: '无法加载主题' });
      }
    }
  },

  setActivePreset: async (presetId: string | null) => {
    const { presets } = get();
    // ── 乐观更新：先立即切换 UI，API 后台同步 ──
    if (presetId) {
      const preset = presets.find((p) => p.id === presetId);
      if (preset) {
        set({ activePreset: preset });
      }
    }

    try {
      await themeApi.setActive(presetId);
      // API 同步成功，无需额外操作（乐观值即最终值）
    } catch (err: any) {
      // ── 同步失败，回滚到上一个状态 ──
      try {
        const defaultPreset = await themeApi.getDefault();
        set({ activePreset: defaultPreset });
      } catch {
        set({ activePreset: null });
      }
      throw new Error(err?.response?.data?.message || '切换主题失败');
    }
  },

  reset: () => {
    set({ presets: [], activePreset: null, loading: false, error: null });
  },
}));

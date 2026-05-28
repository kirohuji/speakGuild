import request from '@/lib/request';

// ── 类型定义 ──

export interface ThemeDecoration {
  type: 'glow' | 'grid' | 'particle';
  color: string;
  x?: string;
  y?: string;
  size?: string;
  blur?: string;
  animation?: Record<string, any>;
}

export interface ThemePreset {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  bgType: string;

  lightColors: Record<string, string> | null;
  lightBackground: string | null;
  lightDecorations: ThemeDecoration[] | null;

  darkColors: Record<string, string> | null;
  darkBackground: string | null;
  darkDecorations: ThemeDecoration[] | null;

  bgmUrl: string | null;
  bgmVolume: number;

  createdAt: string;
  updatedAt: string;
}

export interface CreateThemePresetInput {
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  bgType?: string;
  lightColors?: Record<string, string>;
  lightBackground?: string;
  lightDecorations?: ThemeDecoration[];
  darkColors?: Record<string, string>;
  darkBackground?: string;
  darkDecorations?: ThemeDecoration[];
  bgmUrl?: string;
  bgmVolume?: number;
}

export type UpdateThemePresetInput = Partial<CreateThemePresetInput>;

// ── 管理端 API ──

export const themeAdminApi = {
  /** 获取所有主题（含未启用） */
  list: () => request.get<ThemePreset[]>('/admin/themes'),

  /** 获取单个主题 */
  get: (id: string) => request.get<ThemePreset>(`/admin/themes/${id}`),

  /** 创建主题 */
  create: (data: CreateThemePresetInput) =>
    request.post<ThemePreset>('/admin/themes', data),

  /** 更新主题 */
  update: (id: string, data: UpdateThemePresetInput) =>
    request.put<ThemePreset>(`/admin/themes/${id}`, data),

  /** 删除主题 */
  remove: (id: string) => request.delete(`/admin/themes/${id}`),
};

// ── 用户端 API ──

export const themeApi = {
  /** 获取所有启用的主题 */
  listActive: () => request.get<ThemePreset[]>('/themes'),

  /** 获取当前用户激活的主题 */
  getActive: () => request.get<ThemePreset>('/themes/active'),

  /** 获取默认主题（无需登录） */
  getDefault: () => request.get<ThemePreset>('/themes/default'),

  /** 用户切换主题 */
  setActive: (themePresetId: string | null) =>
    request.put('/themes/active', { themePresetId }),
};

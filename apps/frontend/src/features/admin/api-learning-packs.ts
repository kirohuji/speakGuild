import { del, get, post } from '@/lib/request';

export type LearningPackStatus = 'draft' | 'building' | 'published' | 'failed';
export type LearningPackType = 'daily' | 'exam' | 'story' | 'course' | 'foundation';

export interface LearningPackSceneOption {
  id: string;
  title: string;
  location: string;
  packageType?: LearningPackType;
}

export interface LearningPackItem {
  id: string;
  sceneId: string;
  version: number;
  title: string;
  type?: LearningPackType;
  status: LearningPackStatus;
  fileAssetId?: string | null;
  zipChecksum?: string | null;
  zipSize?: number | null;
  buildLog?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  scene?: LearningPackSceneOption;
  fileAsset?: {
    id: string;
    size: number;
    sha256: string;
    filename: string;
    createdAt: string;
  } | null;
}

export interface LearningPackListResult {
  list: LearningPackItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LearningPackFilters {
  packageTypes: string[]
  categories: { id: string; name: string }[]
}

export const learningPackAdminApi = {
  list: (params?: { sceneId?: string; packageType?: string; categoryId?: string; status?: string; page?: number; pageSize?: number }) =>
    get<LearningPackListResult>('/admin/learning-packs', params),
  scenes: () => get<LearningPackSceneOption[]>('/admin/learning-packs/scenes'),
  filters: () => get<LearningPackFilters>('/admin/learning-packs/filters'),
  generate: (data: { sceneId: string; version?: number; title?: string; publish?: boolean }) =>
    post<LearningPackItem>('/admin/learning-packs/generate', data),
  upload: (data: { sceneId: string; assetId: string; version?: number; title?: string; publish?: boolean }) =>
    post<LearningPackItem>('/admin/learning-packs/upload', data),
  download: (id: string) =>
    get<ArrayBuffer>(`/admin/learning-packs/${id}/download`, undefined, {
      dedupe: false,
      responseType: 'arraybuffer',
      timeout: 120_000,
    }),
  publish: (id: string) => post<LearningPackItem>(`/admin/learning-packs/${id}/publish`),
  remove: (id: string) => del<{ success: boolean }>(`/admin/learning-packs/${id}`),
};

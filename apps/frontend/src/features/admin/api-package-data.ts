import { post, get, del } from '@/lib/request';

export interface ImportResult {
  sceneId: string;
  sceneTitle: string;
  vocabCount: number;
  chunkCount: number;
  topicCount: number;
  patternCount: number;
  episodeCount: number;
  warmupTopics: number;
  contentPrepareTaskId?: string;
}

export interface PackageImportPreview {
  packageName: string;
  scene: { title: string; category: string; description: string; packageType: string; willReplace: boolean };
  counts: { topics: number; documents: number; exercises: number; vocabularies: number; chunks: number; patterns: number; episodes: number };
  importPlan: Array<{ title: string; detail: string; status: string }>;
  documents: Array<{
    topicTitle: string;
    filename: string | null;
    exists: boolean;
    willImport: boolean;
    content: string;
    materials: Record<'vocabulary' | 'chunk' | 'pattern', Array<{ text: string; status: 'existing' | 'missing' }>>;
  }>;
  exercises: Array<{ topicTitle: string; groupTitle: string; prompt: string; answer: string }>;
  corpus: Record<'vocabulary' | 'chunk' | 'pattern', { existing: string[]; missing: string[] }>;
  warnings: string[];
  notices: string[];
  canImport: boolean;
}

export const packageDataAdminApi = {
  preview: (file: File, packageDirName: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('packageDirName', packageDirName);
    return post<PackageImportPreview>('/admin/content/packages/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
  },

  import: (file: File, packageDirName: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('packageDirName', packageDirName);
    return post<ImportResult>('/admin/content/packages/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
  },

  export: (sceneId: string) =>
    get<ArrayBuffer>(`/admin/content/packages/${sceneId}/export`, undefined, {
      dedupe: false,
      responseType: 'arraybuffer',
      timeout: 120_000,
    }),

  updateFromDisk: (sceneId: string) =>
    post<{ oldSceneId: string; newSceneId: string; packageDir: string; vocabCount?: number; topicCount?: number }>(
      `/admin/content/packages/${sceneId}/update-from-disk`,
      {},
      { timeout: 120_000 },
    ),

  prepareContent: (sceneId: string) =>
    post<{ taskId: string; status: string }>(`/admin/content/packages/${sceneId}/prepare-content`),

  delete: (sceneId: string) =>
    del(`/admin/content/packages/${sceneId}`),
};

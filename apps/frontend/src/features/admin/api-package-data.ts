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

export const packageDataAdminApi = {
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

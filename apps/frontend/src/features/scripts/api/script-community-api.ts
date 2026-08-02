import { del, get, patch, post, put } from '@/lib/request'

export type ScriptPracticeMode = 'vn' | 'repeat'
export type ScriptWorkKind = 'vn_video' | 'repeat_video' | 'progress_card'
export type ScriptWorkStatus = 'draft' | 'rendering' | 'ready' | 'published' | 'failed' | 'hidden'
export interface ScriptPracticeRecord {
  id: string
  episodeId: string
  mode: ScriptPracticeMode
  status: 'active' | 'completed' | 'abandoned'
  durationSec: number
  turnCount: number
  lineCount: number
  usedChunkCount: number
  completedObjectiveCount: number
  score: number | null
  completedAt: string | null
  createdAt: string
  resultSnapshot?: {
    dialogue?: Array<{ speaker?: string; text: string; isUser?: boolean }>
    recordingAssets?: Record<string, string>
  } | null
  episode: {
    id: string
    title: string
    chapterName: string
    characterName: string
    scene: { id: string; title: string; coverImage?: string | null }
  }
  works?: Array<{ id: string; status: ScriptWorkStatus; kind: ScriptWorkKind }>
}

export interface ScriptWork {
  id: string
  userId: string
  episodeId: string
  recordId: string | null
  kind: ScriptWorkKind
  status: ScriptWorkStatus
  title: string
  caption: string | null
  durationSec: number
  publishedAt: string | null
  createdAt: string
  videoUrl: string | null
  videoMimeType: string | null
  coverUrl: string | null
  renderPayload?: {
    mode?: ScriptPracticeMode
    resultSnapshot?: Record<string, unknown>
  } | null
  liked: boolean
  myReaction: string | null
  reactionGroups: Array<{ reaction: string; count: number }>
  user: {
    id: string
    name: string
    username: string | null
    image: string | null
    userLevel: number
  }
  episode: {
    id: string
    title: string
    chapterName: string
    scene: { id: string; title: string; coverImage?: string | null }
  }
  _count: { likes: number; reactions: number }
}

export interface CursorResult<T> {
  list: T[]
  nextCursor: string | null
}

export type ScriptPublishHistoryStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled'
export interface ScriptPublishHistoryItem {
  id: string
  targetId: string
  status: ScriptPublishHistoryStatus
  progress: number
  currentStep: string | null
  errorMessage: string | null
  summary: { videoAssetId?: string } | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  work: {
    id: string
    title: string
    kind: ScriptWorkKind
    episodeId: string
    episode: {
      title: string
      chapterName: string
      scene: { id: string; title: string }
    }
  } | null
}

export interface ScriptPublishHistoryResult {
  items: ScriptPublishHistoryItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const scriptCommunityApi = {
  completeRecord: (
    episodeId: string,
    data: {
      mode: ScriptPracticeMode
      durationSec?: number
      turnCount?: number
      lineCount?: number
      usedChunkCount?: number
      completedObjectiveCount?: number
      score?: number
    resultSnapshot?: Record<string, unknown>
    audioAssetId?: string
    recordingAssetIds?: string[]
    recordingBatchId?: string
      videoAssetId?: string
    },
  ) => post<ScriptPracticeRecord>(`/scripts/episodes/${episodeId}/records`, data),

  myRecords: (params?: { mode?: ScriptPracticeMode; cursor?: string; limit?: number }) =>
    get<CursorResult<ScriptPracticeRecord>>('/scripts/records/mine', params),

  createWork: (data: {
    recordId: string
    kind: ScriptWorkKind
    title: string
    caption?: string
    videoAssetId?: string
    coverAssetId?: string
  }) => post<ScriptWork>('/scripts/works', data),

  myWorks: (params?: { cursor?: string; limit?: number }) =>
    get<CursorResult<ScriptWork>>('/scripts/works/mine', params),

  publishHistory: (params?: { workId?: string; episodeId?: string; page?: number; pageSize?: number }) =>
    get<ScriptPublishHistoryResult>('/scripts/publish-history', params, { dedupe: false }),

  updateWork: (id: string, data: { title?: string; caption?: string; videoAssetId?: string; coverAssetId?: string }) =>
    patch<ScriptWork>(`/scripts/works/${id}`, data),

  publishWork: (id: string) => post<ScriptWork>(`/scripts/works/${id}/publish`),
  renderWork: (id: string, frames: Record<string, unknown>[]) =>
    post<{ taskId: string; workId: string }>(`/scripts/works/${id}/render`, { frames }),
  renderStatus: (id: string) =>
    get<{
      work: { id: string; status: ScriptWorkStatus; renderError: string | null; videoAssetId: string | null }
      task: { id: string; status: string; progress: number; currentStep: string | null; errorMessage: string | null } | null
    }>(`/scripts/works/${id}/render-status`, undefined, { dedupe: false }),
  unpublishWork: (id: string) => post<ScriptWork>(`/scripts/works/${id}/unpublish`),
  deleteWork: (id: string) => del<{ success: true }>(`/scripts/works/${id}`),

  feed: (params?: { cursor?: string; limit?: number }) =>
    get<CursorResult<ScriptWork>>('/scripts/square/feed', params),

  like: (id: string) => post<{ liked: true }>(`/scripts/works/${id}/like`),
  unlike: (id: string) => del<{ liked: false }>(`/scripts/works/${id}/like`),
  react: (id: string, reaction: string) =>
    put(`/scripts/works/${id}/reaction`, { reaction }),
  removeReaction: (id: string) =>
    del<{ success: true }>(`/scripts/works/${id}/reaction`),
  report: (id: string, data: { reason: string; detail?: string }) =>
    post<{ success: true }>(`/scripts/works/${id}/report`, data),
}

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
  episode: {
    id: string
    title: string
    chapterName: string
    characterName: string
    scene: { id: string; title: string }
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
  coverUrl: string | null
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
    scene: { id: string; title: string }
  }
  _count: { likes: number; reactions: number }
}

export interface CursorResult<T> {
  list: T[]
  nextCursor: string | null
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

  updateWork: (id: string, data: { title?: string; caption?: string; videoAssetId?: string; coverAssetId?: string }) =>
    patch<ScriptWork>(`/scripts/works/${id}`, data),

  publishWork: (id: string) => post<ScriptWork>(`/scripts/works/${id}/publish`),
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

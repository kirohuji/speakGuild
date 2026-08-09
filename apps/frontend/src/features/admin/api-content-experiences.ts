import { del, get, patch, post, put } from '@/lib/request'
import type { Chunk, Scene, SentencePatternFull, Vocabulary } from './api-content-admin'

export type ContentMode = Scene['contentMode']

export interface PackageGroup {
  id: string
  slug: string
  name: string
  description?: string | null
  coverImage?: string | null
  contentMode?: ContentMode | null
  status: 'draft' | 'published' | 'archived'
  items?: Array<{
    id: string
    sceneId: string
    sortOrder: number
    volumeLabel?: string | null
    requiredPrevious: boolean
    scene: Pick<Scene, 'id' | 'title' | 'contentMode' | 'coverImage'>
  }>
}

export interface AdminSceneExperience {
  id: string
  contentMode: ContentMode
  groupItem?: {
    sortOrder: number
    volumeLabel?: string | null
    requiredPrevious: boolean
    group: PackageGroup
  } | null
  sceneVocabularies: Array<{ vocabularyId: string; vocabulary: Vocabulary }>
  sceneChunks: Array<{ chunkId: string; chunk: Chunk }>
  scenePatterns: Array<{ patternId: string; pattern: SentencePatternFull }>
  novelPackage?: {
    id: string
    epubAssetId: string
    epubUrl: string
    metadata: Record<string, any>
    toc: Array<{ label: string; href: string; children?: any[] }>
  } | null
}

export interface AiWritingTopicDraft {
  title: string
  description: string
  promptEn: string
  promptZh: string
  difficulty: string
  suggestedDurationSec: number
  contentConfig: { writing: Record<string, any> }
}

/** 组内重排后的引用冲突（规则 C：允许重排，但必须展示） */
export interface GroupReorderConflict {
  sceneId: string
  sceneTitle: string
  sortOrder: number
  conflicts: Array<{
    kind: 'vocab' | 'chunk' | 'pattern'
    materialId: string
    text: string
    source: string
    sourceSortOrder: number
  }>
}

export interface AssignGroupResult {
  experience: AdminSceneExperience
  reorderConflicts: GroupReorderConflict[]
}

/** 包级知识保存结果：正常返回 experience；引用冲突时返回 { conflicts } */
export type UpdateKnowledgeResult = AdminSceneExperience | { conflicts: Array<{
  kind: 'vocab' | 'chunk' | 'pattern'
  materialId: string
  text: string
  sourceType: 'pack' | 'topic'
  source: string
  sourceSortOrder: number
}> }

export const contentExperienceAdminApi = {
  listGroups: () => get<PackageGroup[]>('/admin/content-experiences/groups'),
  createGroup: (data: Partial<PackageGroup>) => post<PackageGroup>('/admin/content-experiences/groups', data),
  updateGroup: (id: string, data: Partial<PackageGroup>) => patch<PackageGroup>(`/admin/content-experiences/groups/${id}`, data),
  deleteGroup: (id: string) => del(`/admin/content-experiences/groups/${id}`),
  getScene: (sceneId: string) => get<AdminSceneExperience>(`/admin/content-experiences/scenes/${sceneId}`),
  assignGroup: (sceneId: string, data: { groupId?: string | null; sortOrder?: number; volumeLabel?: string; requiredPrevious?: boolean }) =>
    put<AssignGroupResult>(`/admin/content-experiences/scenes/${sceneId}/group`, data),
  updateKnowledge: (sceneId: string, data: { vocabularyIds: string[]; chunkIds: string[]; patternIds: string[]; forceReview?: boolean }) =>
    put<UpdateKnowledgeResult>(`/admin/content-experiences/scenes/${sceneId}/knowledge`, data),
  attachEpub: (sceneId: string, assetId: string) =>
    post(`/admin/content-experiences/scenes/${sceneId}/epub`, { assetId }),
  generateWritingTopic: (sceneId: string, data: Record<string, unknown>) =>
    post<AiWritingTopicDraft>(`/admin/content-experiences/scenes/${sceneId}/writing-topics/ai-draft`, data),
}

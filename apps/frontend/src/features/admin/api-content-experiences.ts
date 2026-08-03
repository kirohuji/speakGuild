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

export const contentExperienceAdminApi = {
  listGroups: () => get<PackageGroup[]>('/admin/content-experiences/groups'),
  createGroup: (data: Partial<PackageGroup>) => post<PackageGroup>('/admin/content-experiences/groups', data),
  updateGroup: (id: string, data: Partial<PackageGroup>) => patch<PackageGroup>(`/admin/content-experiences/groups/${id}`, data),
  deleteGroup: (id: string) => del(`/admin/content-experiences/groups/${id}`),
  getScene: (sceneId: string) => get<AdminSceneExperience>(`/admin/content-experiences/scenes/${sceneId}`),
  assignGroup: (sceneId: string, data: { groupId?: string | null; sortOrder?: number; volumeLabel?: string; requiredPrevious?: boolean }) =>
    put<AdminSceneExperience>(`/admin/content-experiences/scenes/${sceneId}/group`, data),
  updateKnowledge: (sceneId: string, data: { vocabularyIds: string[]; chunkIds: string[]; patternIds: string[] }) =>
    put<AdminSceneExperience>(`/admin/content-experiences/scenes/${sceneId}/knowledge`, data),
  attachEpub: (sceneId: string, assetId: string) =>
    post(`/admin/content-experiences/scenes/${sceneId}/epub`, { assetId }),
}

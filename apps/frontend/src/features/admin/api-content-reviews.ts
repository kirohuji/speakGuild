import { get, post } from '@/lib/request'

export type ContentReviewStatus = 'pending' | 'approved' | 'rejected' | 'canceled' | 'superseded'
export type ContentReviewKind = 'learning_package' | 'narrative_package'

export interface ContentReviewRequest {
  id: string
  kind: ContentReviewKind
  status: ContentReviewStatus
  sceneId: string
  requestedVersion: number
  reviewNote?: string | null
  submittedAt: string
  owner: { id: string; name: string; email: string }
  reviewer?: { id: string; name: string; email: string } | null
  scene: { id: string; title: string; packageType?: string }
  generatedPackage?: { id: string; version: number; status: string } | null
}

export const contentReviewApi = {
  list: (params?: { status?: ContentReviewStatus; page?: number; pageSize?: number }) =>
    get<{ items: ContentReviewRequest[]; total: number; page: number; pageSize: number; totalPages: number }>('/admin/content-reviews', params),
  submit: (data: { sceneId: string; kind: ContentReviewKind }) =>
    post<ContentReviewRequest>('/admin/content-reviews', data),
  approve: (id: string, reviewNote?: string) =>
    post<ContentReviewRequest>(`/admin/content-reviews/${id}/approve`, { reviewNote }, { timeout: 10 * 60_000 }),
  reject: (id: string, reviewNote: string) =>
    post<ContentReviewRequest>(`/admin/content-reviews/${id}/reject`, { reviewNote }),
}

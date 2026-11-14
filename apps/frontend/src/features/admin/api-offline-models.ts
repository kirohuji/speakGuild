import { get, post, put, del } from '@/lib/request'
import type { AdminTaskDetail, AdminTask } from './api-admin-tasks'
export interface OfflineModelPreset { variantId: string; modelId: string; label: string; purpose: 'stt' | 'embedding'; dtype: string; files: string[] }
export interface OfflineModelFile { path: string; assetId: string; size: number; sha256: string }
export interface OfflineModelVersion {
  id: string; variantId: string; version: string; modelId: string; purpose: 'stt' | 'embedding'; dtype: string
  sourceRevision: string; sourceCommit?: string; status: string; isPublished: boolean; publishedAt?: string
  files: OfflineModelFile[]; totalBytes: number; bundleAssetId?: string; bundleUrl?: string; importAssetId?: string
  taskId?: string; task?: AdminTaskDetail | AdminTask | null; errorMessage?: string; createdAt: string
  deviceValidation: 'unverified' | 'passed' | 'failed'; validationNote?: string
}
export const offlineModelsApi = {
  list: () => get<{ catalog: OfflineModelPreset[]; versions: OfflineModelVersion[] }>('/admin/offline-models', undefined, { failureCooldownMs: 0 }),
  detail: (id: string) => get<OfflineModelVersion>(`/admin/offline-models/${id}`, undefined, { failureCooldownMs: 0 }),
  prepare: (input: { variantId: string; version: string; sourceRevision?: string; importAssetId?: string }) => post<OfflineModelVersion>('/admin/offline-models', input),
  retry: (id: string) => post<OfflineModelVersion>(`/admin/offline-models/${id}/retry`),
  cancel: (id: string) => post<OfflineModelVersion>(`/admin/offline-models/${id}/cancel`),
  publish: (id: string) => post(`/admin/offline-models/${id}/publish`),
  unpublish: (id: string) => post(`/admin/offline-models/${id}/unpublish`),
  validate: (id: string, input: { deviceValidation: string; validationNote: string }) => put(`/admin/offline-models/${id}/validation`, input),
  remove: (id: string) => del(`/admin/offline-models/${id}`),
}

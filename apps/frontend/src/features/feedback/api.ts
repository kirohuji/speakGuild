import { get, post, patch } from '@/lib/request'

export interface FeedbackResult {
  id: string
  userId: string
  type: string
  content: string
  contact?: string
  status: 'pending' | 'resolved' | 'closed'
  isCritical?: boolean
  adminNote?: string
  createdAt: string
  updatedAt: string
}

export function submitFeedback(data: { type: string; content: string; contact?: string }) {
  return post<FeedbackResult>('/feedbacks', data)
}

/** 匿名反馈（无需登录），仅需邮箱 + 内容 */
export function submitAnonymousFeedback(data: { email: string; content: string }) {
  return post<{ id: string }>('/feedbacks/anonymous', data)
}

export function getMyFeedbacks(page = 1, pageSize = 20) {
  return get<{ items: FeedbackResult[]; total: number }>('/feedbacks/mine', { page, pageSize })
}

export function getAllFeedbacks(params?: { status?: string; isCritical?: boolean; page?: number; pageSize?: number }) {
  return get<{ items: (FeedbackResult & { user?: { name: string; email: string } })[]; total: number }>('/feedbacks', params)
}

export const FEEDBACK_STATS_CHANGED_EVENT = 'admin-feedbacks:changed'

/** 管理员待处理反馈数量，供侧边栏角标使用 */
export function getFeedbackStats() {
  return get<{ pending: number }>('/feedbacks/stats')
}

export function notifyFeedbackStatsChanged() {
  window.dispatchEvent(new Event(FEEDBACK_STATS_CHANGED_EVENT))
}

export function updateFeedback(id: string, data: { status: string; adminNote?: string; isCritical?: boolean }) {
  return patch<FeedbackResult>(`/feedbacks/${id}`, data)
}

/** 管理员回复反馈，后端会自动发送通知给用户 */
export function replyFeedback(id: string, adminNote: string) {
  return post<{ success: boolean; notificationId: string }>(`/feedbacks/${id}/reply`, { adminNote })
}

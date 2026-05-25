import { get, post, patch } from '@/lib/request'

export interface FeedbackResult {
  id: string
  userId: string
  type: string
  content: string
  contact?: string
  status: 'pending' | 'resolved' | 'closed'
  adminNote?: string
  createdAt: string
  updatedAt: string
}

export function submitFeedback(data: { type: string; content: string; contact?: string }) {
  return post<FeedbackResult>('/feedbacks', data)
}

export function getMyFeedbacks(page = 1, pageSize = 20) {
  return get<{ items: FeedbackResult[]; total: number }>('/feedbacks/mine', { page, pageSize })
}

export function getAllFeedbacks(params?: { status?: string; page?: number; pageSize?: number }) {
  return get<{ items: (FeedbackResult & { user?: { name: string; email: string } })[]; total: number }>('/feedbacks', params)
}

export function updateFeedback(id: string, data: { status: string; adminNote?: string }) {
  return patch<FeedbackResult>(`/feedbacks/${id}`, data)
}

/** 管理员回复反馈，后端会自动发送通知给用户 */
export function replyFeedback(id: string, adminNote: string) {
  return post<{ success: boolean; notificationId: string }>(`/feedbacks/${id}/reply`, { adminNote })
}

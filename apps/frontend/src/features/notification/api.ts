import { get, post } from '@/lib/request';

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type: 'broadcast' | 'targeted';
  sentById: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  readAt: string | null;
}

export interface NotificationListResult {
  list: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getUserNotifications(params: {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}) {
  return get<NotificationListResult>('/notifications', params);
}

export async function getUnreadCount() {
  return get<{ count: number }>('/notifications/unread-count');
}

export async function markAsRead(notificationId: string) {
  return post(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead() {
  return post('/notifications/read-all');
}

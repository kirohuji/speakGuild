import { get, post } from '@/lib/request';

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type: 'broadcast' | 'targeted';
  imageUrl?: string;
  isSpecial?: boolean;
  actionUrl?: string;
  sentById: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  readAt: string | null;
}

export function getNotificationActionUrl(item: NotificationItem): string | undefined {
  if (item.actionUrl?.startsWith('/')) return item.actionUrl
  // Prefer in-app hash/path links embedded in markdown
  const markdownLink = item.content.match(/\]\((#[^)]+|\/[^)\s]+)\)/)?.[1]
  if (markdownLink?.startsWith('#') || markdownLink?.startsWith('/')) return markdownLink
  return undefined
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

export interface SpecialNotification {
  id: string
  title: string
  content: string
  imageUrl?: string
  createdAt: string
}

export async function getSpecialNotifications() {
  return get<SpecialNotification[]>('/notifications/special');
}

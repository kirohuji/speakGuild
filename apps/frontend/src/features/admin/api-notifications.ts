import { get, post, patch, del } from '@/lib/request';
import instance from '@/lib/request';

export interface AdminNotificationItem {
  id: string;
  title: string;
  content: string;
  type: 'broadcast' | 'targeted';
  sentById: string;
  sentBy: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
  _count: { reads: number; targets: number };
}

export interface AdminNotificationListResult {
  list: AdminNotificationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchUserResult {
  id: string;
  email: string;
  name: string;
  username: string | null;
  image: string | null;
}

export async function listNotifications(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  return get<AdminNotificationListResult>('/admin/notifications', params);
}

export async function createNotification(data: {
  title: string;
  content: string;
  type: 'broadcast' | 'targeted';
  targetUserIds?: string[];
}) {
  return post('/admin/notifications', data);
}

export async function searchUsers(keyword: string) {
  return get<SearchUserResult[]>('/admin/notifications/search-users', { keyword });
}

export async function uploadNotificationImage(file: File): Promise<{ url: string; assetId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await instance.post('/admin/notifications/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data ?? res.data;
}

export interface NotificationImageItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface NotificationImageListResult {
  list: NotificationImageItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listNotificationImages(params: {
  page?: number;
  pageSize?: number;
}) {
  return get<NotificationImageListResult>('/admin/notifications/images', params);
}

export interface NotificationStats {
  total: number;
  broadcast: number;
  targeted: number;
  totalReads: number;
}

export async function getNotificationStats() {
  return get<NotificationStats>('/admin/notifications/stats');
}

export async function updateNotification(
  id: string,
  data: { title?: string; content?: string; type?: 'broadcast' | 'targeted' },
) {
  return patch(`/admin/notifications/${id}`, data);
}

export async function deleteNotification(id: string) {
  return del(`/admin/notifications/${id}`);
}

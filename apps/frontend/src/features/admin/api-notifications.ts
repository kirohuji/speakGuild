import { get, post, patch, del } from '@/lib/request';
import instance from '@/lib/request';

export interface AdminNotificationItem {
  id: string;
  title: string;
  content: string;
  type: 'broadcast' | 'targeted';
  sentById: string;
  sentBy: { id: string; name: string; email: string };
  isSpecial: boolean;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { reads: number; targets: number };
  /** 定向通知的目标用户（列表最多返回前 10 个） */
  targets?: { user: SearchUserResult }[];
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

export interface AdminNotificationDetail extends AdminNotificationItem {
  targets: { user: SearchUserResult }[];
}

export async function listNotifications(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  userId?: string;
}) {
  return get<AdminNotificationListResult>('/admin/notifications', params);
}

export async function createNotification(data: {
  title: string;
  content: string;
  type: 'broadcast' | 'targeted';
  targetUserIds?: string[];
  isSpecial?: boolean;
  imageUrl?: string;
}) {
  return post('/admin/notifications', data);
}

export async function searchUsers(keyword: string) {
  return get<SearchUserResult[]>('/admin/notifications/search-users', { keyword });
}

export async function getNotification(id: string) {
  return get<AdminNotificationDetail>(`/admin/notifications/${id}`);
}

export async function uploadNotificationImage(file: File): Promise<{ url: string; assetId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return instance.post('/admin/notifications/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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
  data: { title?: string; content?: string; type?: 'broadcast' | 'targeted'; targetUserIds?: string[]; isSpecial?: boolean; imageUrl?: string | null },
) {
  return patch(`/admin/notifications/${id}`, data);
}

export async function deleteNotification(id: string) {
  return del(`/admin/notifications/${id}`);
}

import { get, post, patch, del } from '@/lib/request';

export interface ResourceNodeAsset {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ResourceTreeNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'video_url' | 'video' | 'audio' | 'pdf' | 'image' | 'document' | 'other';
  region: string | null;
  assetId: string | null;
  url: string | null;
  description: string | null;
  mimeType: string | null;
  fileSize: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children: ResourceTreeNode[];
  asset?: ResourceNodeAsset | null;
}

export interface CreateResourceNodePayload {
  parentId?: string;
  name: string;
  type: string;
  region?: string;
  assetId?: string;
  url?: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
  sortOrder?: number;
}

export interface UpdateResourceNodePayload {
  name?: string;
  type?: string;
  region?: string;
  assetId?: string;
  url?: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
  sortOrder?: number;
}

export interface MoveResourceNodePayload {
  parentId?: string | null;
  sortOrder?: number;
}

export async function getResourceTree(region?: string) {
  return get<ResourceTreeNode[]>('/admin/resources/tree', region ? { region } : undefined);
}

export async function getResourceRegions() {
  return get<string[]>('/admin/resources/regions');
}

export async function getResourceNode(id: string) {
  return get<ResourceTreeNode>(`/admin/resources/${id}`);
}

export async function createResourceNode(data: CreateResourceNodePayload) {
  return post<ResourceTreeNode>('/admin/resources', data);
}

export async function updateResourceNode(id: string, data: UpdateResourceNodePayload) {
  return patch<ResourceTreeNode>(`/admin/resources/${id}`, data);
}

export async function deleteResourceNode(id: string) {
  return del<{ deleted: number }>(`/admin/resources/${id}`);
}

export async function moveResourceNode(id: string, data: MoveResourceNodePayload) {
  return patch<ResourceTreeNode>(`/admin/resources/${id}/move`, data);
}

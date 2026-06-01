import { get, post } from '@/lib/request';

export interface CosPolicy {
  url: string;
  formData: Record<string, string>;
  key: string;
}

export interface CompletedAsset {
  id: string;
  sha256: string;
  url: string;
  mimeType: string;
  size: number;
}

/** 获取 COS 上传签名策略 */
export async function getCosPolicy(filename: string, mimeType: string): Promise<CosPolicy> {
  return post('/file-assets/cos-policy', { filename, mimeType });
}

/** 通知后端上传完成 */
export async function completeUpload(key: string, sha256: string, size: number): Promise<CompletedAsset> {
  return post('/file-assets/complete', { key, sha256, size });
}

/** 前端直传 COS + 后端回调确认（一站式） */
export async function uploadFileToCosAndComplete(file: File): Promise<CompletedAsset> {
  const policy = await getCosPolicy(file.name, file.type);

  const fd = new FormData();
  for (const [k, v] of Object.entries(policy.formData)) {
    fd.append(k, v);
  }
  fd.append('file', file);

  await fetch(policy.url, { method: 'POST', body: fd });

  return completeUpload(policy.key, '', file.size);
}

/** 获取文件长期访问 URL */
export async function getFileAssetLongLivedUrl(assetId: string): Promise<{ url: string }> {
  return { url: '' };
}

/** 获取当前头像 */
export async function getCurrentAvatar(): Promise<{ url: string }> {
  return get('/file-assets/avatar/current');
}

/** 设置当前头像 */
export async function setCurrentAvatar(assetId: string): Promise<{ url: string }> {
  return post('/file-assets/avatar/set', { assetId });
}

/** 删除文件引用 */
export async function deleteFileReference(assetId: string): Promise<void> {
  return;
}

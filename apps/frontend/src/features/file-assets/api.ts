import { del, get, post } from '@/lib/request'

export type FileAssetGroup = 'avatar' | 'library' | 'tts' | 'notification'

export interface CosPolicy {
  exists: boolean
  asset?: CompletedAsset
  key?: string
  uploadUrl?: string
  method?: 'PUT'
  headers?: Record<string, string>
}

export interface CompletedAsset {
  id: string
  sha256: string
  mimeType: string
  size: number
  filename?: string
  url?: string
}

interface CompleteUploadResult {
  asset: CompletedAsset
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** 前端直传 COS + 后端回调确认（一站式） */
export async function uploadFileToCosAndComplete({
  file,
  group = 'library',
}: {
  file: File
  group?: FileAssetGroup
}): Promise<CompletedAsset> {
  const fileSha256 = await sha256(file)
  const policy = await post<CosPolicy>('/file-assets/cos-policy', {
    group,
    filename: file.name,
    mimeType: file.type,
    sha256: fileSha256,
  })

  if (policy.exists && policy.asset) return policy.asset
  if (!policy.key || !policy.uploadUrl) throw new Error('上传签名缺少必要信息')

  const uploadResponse = await fetch(policy.uploadUrl, {
    method: policy.method || 'PUT',
    headers: policy.headers,
    body: file,
  })
  if (!uploadResponse.ok) throw new Error(`上传失败 (${uploadResponse.status})`)

  const result = await post<CompleteUploadResult>('/file-assets/complete', {
    group,
    key: policy.key,
    sha256: fileSha256,
    size: file.size,
    filename: file.name,
    mimeType: file.type,
  })
  return result.asset
}

/** 获取文件长期访问 URL */
export function getFileAssetLongLivedUrl(assetId: string): Promise<{ url: string }> {
  return get(`/file-assets/${assetId}/long-lived-url`)
}

/** 获取当前头像 */
export function getCurrentAvatar(): Promise<{ url: string } | null> {
  return get('/file-assets/avatar/current')
}

/** 设置当前头像 */
export function setCurrentAvatar(assetId: string): Promise<{ url: string }> {
  return post('/file-assets/avatar/current', { assetId })
}

/** 删除文件引用 */
export function deleteFileReference(assetId: string, bizType: string, bizId: string): Promise<void> {
  return del('/file-assets/references', { assetId, bizType, bizId })
}

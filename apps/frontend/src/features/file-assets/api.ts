import { del, get, post } from '@/lib/request'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { digestSync } from '@/lib/offline/asset-cache.service'

export type FileAssetGroup = 'avatar' | 'library' | 'tts' | 'notification' | 'mobile_bundle' | 'learning_pack' | 'scene_cover' | 'user_recording' | 'epub'

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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu').replace(/\/$/, '')

/** Permanent application URL. The backend refreshes the COS signature per request. */
export function getFileAssetContentUrl(assetId: string): string {
  const path = `${apiBaseUrl}/file-assets/${encodeURIComponent(assetId)}/content`
  if (/^https?:\/\//i.test(path)) return path
  if (typeof window !== 'undefined') return new URL(path, window.location.origin).toString()
  return path
}

interface CompleteUploadResult {
  asset: CompletedAsset
}

async function blobToBase64(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < buffer.length; index += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

async function uploadToCos(policy: CosPolicy, file: File) {
  if (!policy.uploadUrl) throw new Error('上传签名缺少必要信息')
  if (Capacitor.isNativePlatform()) {
    // Do not send COS PUTs through the WebView: its CORS preflight can be
    // rejected even though the signed upload itself is valid. CapacitorHttp
    // uses NSURLSession/OkHttp and accepts base64 file data in native mode.
    const response = await CapacitorHttp.put({
      url: policy.uploadUrl,
      headers: policy.headers,
      data: await blobToBase64(file),
      dataType: 'file',
      responseType: 'text',
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`原生上传失败 (${response.status})`)
    }
    return
  }

  const uploadResponse = await fetch(policy.uploadUrl, {
    method: policy.method || 'PUT',
    headers: policy.headers,
    body: file,
  })
  if (!uploadResponse.ok) throw new Error(`上传失败 (${uploadResponse.status})`)
}

async function sha256(file: File): Promise<string> {
  // Capacitor live mode does not consistently expose crypto.subtle. Reuse
  // the same pure-JS SHA-256 implementation as offline pack verification.
  return digestSync(await file.arrayBuffer())
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

  await uploadToCos(policy, file)

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

/** @deprecated Use getFileAssetContentUrl. Kept so older forms persist stable URLs. */
export function getFileAssetLongLivedUrl(assetId: string): Promise<{ url: string }> {
  return Promise.resolve({ url: getFileAssetContentUrl(assetId) })
}

/** 获取文件当前可播放/下载 URL。URL 会过期，不要长期保存；长期保存 assetId。 */
export function getFileAssetPrivateUrl(assetId: string): Promise<{ url: string; expiresInSeconds?: number }> {
  return get(`/file-assets/${assetId}/private-url`)
}

/** 获取当前头像 */
export function getCurrentAvatar(): Promise<{ url: string } | null> {
  return get('/file-assets/avatar/current')
}

/** 设置当前头像 */
export function setCurrentAvatar(assetId: string): Promise<{ url: string }> {
  return post('/file-assets/avatar/current', { assetId })
}

/** 将已上传资产绑定到当前用户的业务记录，供后端执行归属校验。 */
export function createFileReference(assetId: string, bizType: string, bizId: string): Promise<void> {
  return post('/file-assets/references', { assetId, bizType, bizId })
}

/** 删除文件引用 */
export function deleteFileReference(assetId: string, bizType: string, bizId: string): Promise<void> {
  return del('/file-assets/references', { assetId, bizType, bizId })
}

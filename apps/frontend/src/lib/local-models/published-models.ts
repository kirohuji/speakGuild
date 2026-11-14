import { get } from '@/lib/request'
export interface PublishedModelFile { path: string; assetId: string; size: number; sha256: string; url: string }
export interface PublishedModel { id: string; version: string; modelId: string; variantId: string; dtype: string; totalBytes: number; files: PublishedModelFile[] }
export async function getPublishedModel(variantId: string, modelId: string, expectedFiles: string[]): Promise<PublishedModel> {
  const manifest = await get<PublishedModel>(`/offline-models/${encodeURIComponent(variantId)}/manifest`, undefined, { failureCooldownMs: 0 })
  if (manifest.modelId !== modelId || manifest.variantId !== variantId || !Array.isArray(manifest.files) || manifest.files.length !== expectedFiles.length || new Set(manifest.files.map(file => file.path)).size !== expectedFiles.length) throw new Error('发布的模型清单与所选型号不一致，请联系管理员')
  for (const path of expectedFiles) {
    const file = manifest.files.find(item => item.path === path)
    if (!file || !file.assetId || !Number.isSafeInteger(file.size) || file.size <= 0 || !/^[a-f0-9]{64}$/.test(file.sha256) || !/^https?:\/\//.test(file.url)) throw new Error('模型清单缺少有效的下载文件或校验信息')
  }
  if (manifest.totalBytes !== manifest.files.reduce((sum, file) => sum + file.size, 0)) throw new Error('模型清单大小不一致')
  return manifest
}
export function modelDownloadProgress(files: Array<{ path: string; size: number }>, callback?: (p: { file: string; loadedBytes: number; totalBytes: number; percent: number }) => void) {
  const loaded = new Map<string, number>(), sizes = new Map(files.map(file => [file.path, file.size]))
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const report = (file: string, bytes: number) => {
    loaded.set(file, Math.max(loaded.get(file) ?? 0, Math.min(sizes.get(file) ?? 0, bytes)))
    const loadedBytes = [...loaded.values()].reduce((sum, value) => sum + value, 0)
    callback?.({ file, loadedBytes, totalBytes, percent: Math.min(99, Math.floor(loadedBytes / totalBytes * 100)) })
  }
  return { report, complete: () => callback?.({ file: '安装校验完成', loadedBytes: totalBytes, totalBytes, percent: 100 }) }
}

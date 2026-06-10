import { Directory, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { isNative } from '@/lib/native'
import { localDb } from './unified-storage'

export interface AssetRef {
  assetId?: string
  url: string
  sha256?: string | null
  mimeType?: string | null
  size?: number | null
  role?: 'background' | 'sprite' | 'voice' | 'bgm' | 'sfx' | 'thumbnail' | string
}

export interface LocalAsset {
  id: string
  assetId: string
  remoteUrl: string
  sha256?: string | null
  mimeType?: string | null
  size?: number | null
  localPath: string | null
  localUri: string | null
  status: 'missing' | 'downloading' | 'ready' | 'failed'
  downloadedAt: string | null
  lastAccessedAt: string | null
  lastError?: string
}

function normalizeUrl(url: string) {
  if (url.startsWith('//')) return `https:${url}`
  return url
}

async function digest(value: string | ArrayBuffer, algorithm = 'SHA-256'): Promise<string> {
  const input = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value
  const hash = await crypto.subtle.digest(algorithm, input)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function extensionFrom(url: string, mimeType?: string | null) {
  const pathname = (() => {
    try { return new URL(normalizeUrl(url)).pathname } catch { return url }
  })()
  const match = pathname.match(/\.([a-z0-9]{2,5})$/i)
  if (match) return match[1].toLowerCase()
  if (mimeType?.includes('png')) return 'png'
  if (mimeType?.includes('jpeg') || mimeType?.includes('jpg')) return 'jpg'
  if (mimeType?.includes('webp')) return 'webp'
  if (mimeType?.includes('mpeg')) return 'mp3'
  if (mimeType?.includes('ogg')) return 'ogg'
  if (mimeType?.includes('wav')) return 'wav'
  return 'bin'
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function assetKey(ref: AssetRef) {
  return ref.assetId || ref.sha256 || await digest(normalizeUrl(ref.url))
}

/**
 * 将 file:// URI 转为 WebView 可加载的 URL。
 *
 * iOS WKWebView 安全沙箱禁止直接加载 file:// 资源，
 * Capacitor 内置的 convertFileSrc 将其转换为 capacitor://localhost scheme，
 * 由 Capacitor 注册的本地 scheme handler 提供服务。
 *
 * @see https://capacitorjs.com/docs/apis/filesystem
 */
function toLoadableUrl(fileUri: string): string {
  if (!fileUri) return fileUri
  try {
    return Capacitor.convertFileSrc(fileUri)
  } catch {
    return fileUri
  }
}

export const assetCacheService = {
  async resolve(ref: AssetRef): Promise<string> {
    const url = normalizeUrl(ref.url)
    if (!url || !isNative()) return url

    const key = await assetKey({ ...ref, url })
    const cached = await localDb.get<LocalAsset>('local_assets', key)
    if (cached?.status === 'ready' && cached.localUri) {
      await localDb.put('local_assets', { ...cached, lastAccessedAt: new Date().toISOString() })
      return toLoadableUrl(cached.localUri)
    }

    return this.download({ ...ref, url })
  },

  async download(ref: AssetRef): Promise<string> {
    const url = normalizeUrl(ref.url)
    if (!isNative()) return url

    const key = await assetKey({ ...ref, url })
    const ext = extensionFrom(url, ref.mimeType)
    const path = `offline-assets/${key}.${ext}`
    const now = new Date().toISOString()

    await localDb.put<LocalAsset>('local_assets', {
      id: key,
      assetId: key,
      remoteUrl: url,
      sha256: ref.sha256,
      mimeType: ref.mimeType,
      size: ref.size,
      localPath: path,
      localUri: null,
      status: 'downloading',
      downloadedAt: null,
      lastAccessedAt: now,
    })

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Download failed (${response.status})`)
      const buffer = await response.arrayBuffer()

      if (ref.sha256) {
        const actual = await digest(buffer)
        if (actual.toLowerCase() !== ref.sha256.toLowerCase()) {
          throw new Error('Downloaded asset hash mismatch')
        }
      }

      await Filesystem.writeFile({
        path,
        data: arrayBufferToBase64(buffer),
        directory: Directory.Data,
        recursive: true,
      })
      const uri = await Filesystem.getUri({ path, directory: Directory.Data })

      await localDb.put<LocalAsset>('local_assets', {
        id: key,
        assetId: key,
        remoteUrl: url,
        sha256: ref.sha256,
        mimeType: ref.mimeType,
        size: ref.size ?? buffer.byteLength,
        localPath: path,
        localUri: uri.uri,
        status: 'ready',
        downloadedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      })

      return toLoadableUrl(uri.uri)
    } catch (error) {
      await localDb.put<LocalAsset>('local_assets', {
        id: key,
        assetId: key,
        remoteUrl: url,
        sha256: ref.sha256,
        mimeType: ref.mimeType,
        size: ref.size,
        localPath: path,
        localUri: null,
        status: 'failed',
        downloadedAt: null,
        lastAccessedAt: now,
        lastError: error instanceof Error ? error.message : String(error),
      })
      return url
    }
  },

  async remove(assetId: string): Promise<void> {
    const cached = await localDb.get<LocalAsset>('local_assets', assetId)
    if (!cached) return
    if (isNative() && cached.localPath) {
      try {
        await Filesystem.deleteFile({ path: cached.localPath, directory: Directory.Data })
      } catch {
        // Already gone.
      }
    }
    await localDb.delete('local_assets', assetId)
  },

  async removeRef(ref: AssetRef): Promise<void> {
    const key = await assetKey(ref)
    await this.remove(key)
  },
}

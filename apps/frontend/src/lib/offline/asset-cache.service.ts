import { Directory, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { isNative } from '@/lib/native'
import { localDb } from './unified-storage'

export interface AssetRef {
  assetId?: string
  url: string
  path?: string
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

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType?: string | null) {
  return `data:${mimeType || 'application/octet-stream'};base64,${arrayBufferToBase64(buffer)}`
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
    if (!url) return url

    const key = await assetKey({ ...ref, url })
    const cached = await localDb.get<LocalAsset>('local_assets', key)
    if (cached?.status === 'ready' && cached.localUri) {
      await localDb.put('local_assets', { ...cached, lastAccessedAt: new Date().toISOString() })
      return isNative() ? toLoadableUrl(cached.localUri) : cached.localUri
    }

    if (!isNative()) return url
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

  async saveFromBuffer(ref: AssetRef, buffer: ArrayBuffer): Promise<string> {
    return this.saveFromBufferWithSha256(ref, buffer, null)
  },

  /**
   * 与 saveFromBuffer 相同，但接受调用方预先计算好的 SHA-256，
   * 避免重复哈希计算。传入 null 则内部自动计算。
   *
   * 用于 pack 安装场景：zip 提取循环中已计算过 SHA-256，
   * 此处直接复用，省去一次 crypto.subtle.digest 调用。
   */
  async saveFromBufferWithSha256(ref: AssetRef, buffer: ArrayBuffer, precomputedSha256: string | null): Promise<string> {
    const url = normalizeUrl(ref.url)
    const key = await assetKey({ ...ref, url })
    const ext = extensionFrom(ref.path ?? url, ref.mimeType)
    const path = `offline-assets/${key}.${ext}`

    const effectiveSha256 = precomputedSha256 ?? await digest(buffer)

    if (ref.sha256 && effectiveSha256.toLowerCase() !== ref.sha256.toLowerCase()) {
      throw new Error('Pack asset hash mismatch')
    }

    if (!isNative()) {
      if (!import.meta.env.DEV) return url

      const dataUrl = arrayBufferToDataUrl(buffer, ref.mimeType)
      const now = new Date().toISOString()
      await localDb.put<LocalAsset>('local_assets', {
        id: key,
        assetId: key,
        remoteUrl: url,
        sha256: effectiveSha256,
        mimeType: ref.mimeType,
        size: ref.size ?? buffer.byteLength,
        localPath: path,
        localUri: dataUrl,
        status: 'ready',
        downloadedAt: now,
        lastAccessedAt: now,
      })
      const kb = (buffer.byteLength / 1024).toFixed(1)
      console.log(`[asset-cache] 💾 WEB 模式存储: ${ref.path ?? ref.url?.slice(-40)} (${kb}KB) → local_assets/${key}`)
      return dataUrl
    }

    await Filesystem.writeFile({
      path,
      data: arrayBufferToBase64(buffer),
      directory: Directory.Data,
      recursive: true,
    })
    const uri = await Filesystem.getUri({ path, directory: Directory.Data })
    const now = new Date().toISOString()

    await localDb.put<LocalAsset>('local_assets', {
      id: key,
      assetId: key,
      remoteUrl: url,
      sha256: effectiveSha256,
      mimeType: ref.mimeType,
      size: ref.size ?? buffer.byteLength,
      localPath: path,
      localUri: uri.uri,
      status: 'ready',
      downloadedAt: now,
      lastAccessedAt: now,
    })

    return toLoadableUrl(uri.uri)
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

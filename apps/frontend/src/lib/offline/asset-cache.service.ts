import { Directory, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { isNative } from '@/lib/native'
import { localDb } from './unified-storage'

export interface AssetRef {
  assetId?: string
  /** Stable server-side file asset ID. Unlike a signed URL it survives refreshes. */
  fileAssetId?: string
  /** Ink tag alias (e.g. bg_city); another SQLite alias for the same file. */
  alias?: string
  url: string
  path?: string
  sha256?: string | null
  mimeType?: string | null
  size?: number | null
  role?: 'background' | 'sprite' | 'voice' | 'bgm' | 'sfx' | 'thumbnail' | string
  /** For an installed package, a cache miss must not silently issue a network request. */
  offlineOnly?: boolean
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

/** A COS signature changes, but the object pathname is the stable resource identity. */
function stableRemoteUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url
  }
}

function isLoadableLocalUrl(url: string) {
  return url.startsWith('capacitor://')
    || url.startsWith('http://localhost/_capacitor_file_')
    || url.startsWith('https://localhost/_capacitor_file_')
}

// ── Pure-JS SHA-256 — works everywhere, no crypto.subtle needed ──

function sha256Pure(data: ArrayBuffer): Uint8Array {
  const msg = new Uint8Array(data)
  // Pre-processing
  const ml = msg.length * 8
  const padLen = (56 - (msg.length + 1) % 64 + 64) % 64
  const totalLen = msg.length + 1 + padLen + 8
  const buf = new Uint8Array(totalLen)
  buf.set(msg)
  buf[msg.length] = 0x80

  // 64-bit big-endian message length (in bits) at the end of the padding
  const dv = new DataView(buf.buffer)
  dv.setUint32(totalLen - 8, Math.floor(ml / 0x100000000), false)
  dv.setUint32(totalLen - 4, ml >>> 0, false)

  // Initial hash values
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])

  // Round constants
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ])

  // Process 64-byte blocks
  for (let i = 0; i < totalLen; i += 64) {
    const W = new Uint32Array(64)
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr(W[t-15], 7) ^ rotr(W[t-15], 18) ^ (W[t-15] >>> 3))
      const s1 = (rotr(W[t-2], 17) ^ rotr(W[t-2], 19) ^ (W[t-2] >>> 10))
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0
    }
    let [a,b,c,d,e,f,g,h] = H
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const T1 = (h + S1 + ch + K[t] + W[t]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const T2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + T1) >>> 0
      d = c; c = b; b = a; a = (T1 + T2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    out[i*4]   = (H[i] >>> 24) & 0xff
    out[i*4+1] = (H[i] >>> 16) & 0xff
    out[i*4+2] = (H[i] >>>  8) & 0xff
    out[i*4+3] =  H[i]         & 0xff
  }
  return out
}
function rotr(x: number, n: number): number { return (x >>> n) | (x << (32 - n)) }

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function digestSync(data: ArrayBuffer): string {
  return hexFromBytes(sha256Pure(data))
}
export { digestSync }

async function digest(value: string | ArrayBuffer): Promise<string> {
  if (typeof value === 'string') {
    return digestSync(new TextEncoder().encode(value).buffer as ArrayBuffer)
  }
  return digestSync(value)
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
  const chunkSize = 0x8000
  // 分块 btoa：避免先拼接整个 binary 字符串再编码，降低大文件（音频/图片）峰值内存。
  // 原实现会同时持有「完整 binary 字符串 + 完整 base64」两份大内存。
  let result = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    result += btoa(String.fromCharCode(...chunk))
  }
  return result
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType?: string | null) {
  return `data:${mimeType || 'application/octet-stream'};base64,${arrayBufferToBase64(buffer)}`
}

async function assetKey(ref: AssetRef) {
  // `sha256` is the canonical on-disk key for package assets. A stable file
  // asset ID is deliberately only an alias: using it as the primary key would
  // break SHA based cross-package deduplication and uninstall reference counts.
  return ref.assetId || ref.sha256 || await digest(normalizeUrl(ref.url))
}

async function putAliases(record: LocalAsset, ref: AssetRef, url: string): Promise<void> {
  // One physical file may have multiple ways to be addressed. Keep aliases in
  // SQLite, never as extra files. In particular fileAssetId makes an installed
  // pack work after the server generates a new signed URL for the same asset.
  const aliases = new Set<string>([
    await digest(url),
    await digest(stableRemoteUrl(url)),
  ])
  if (ref.assetId) aliases.add(ref.assetId)
  if (ref.fileAssetId) aliases.add(ref.fileAssetId)
  if (ref.alias) aliases.add(ref.alias)
  aliases.delete(record.id)
  await Promise.all([...aliases].map((id) => localDb.put<LocalAsset>('local_assets', {
    ...record,
    id,
    assetId: record.id,
  })))
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
  /** Attach another manifest reference to an already written SHA file. */
  async addAliases(canonicalId: string, ref: AssetRef): Promise<void> {
    const record = await localDb.get<LocalAsset>('local_assets', canonicalId)
    if (!record?.localUri || record.status !== 'ready') return
    await putAliases(record, ref, normalizeUrl(ref.url))
  },

  /** Verify that the SQLite metadata still points to an actual local file. */
  async isReady(assetId: string): Promise<boolean> {
    const cached = await localDb.get<LocalAsset>('local_assets', assetId)
    if (cached?.status !== 'ready' || !cached.localUri) return false
    if (isNative() && cached.localPath) {
      try {
        await Filesystem.stat({ path: cached.localPath, directory: Directory.Data })
      } catch {
        const canonicalId = cached.assetId || cached.id
        await localDb.deleteWhere<LocalAsset>('local_assets', (asset) =>
          asset.id === canonicalId || asset.assetId === canonicalId,
        )
        console.warn('[offline-assets] removed stale metadata', { assetId, canonicalId, path: cached.localPath })
        return false
      }
    }
    return true
  },

  async resolve(ref: AssetRef): Promise<string> {
    const url = normalizeUrl(ref.url)
    if (!url) return url
    // Never hash, cache, or fetch a URL that already points at Capacitor's
    // local file handler. Re-processing it used to create a second file.
    if (isLoadableLocalUrl(url)) return url

    const key = await assetKey({ ...ref, url })
    // A previous failed on-demand record may exist under fileAssetId while the
    // package installer has already saved the exact same resource under its
    // URL/SHA alias. Probe every stable identity and only treat a *ready* row
    // as authoritative; failed metadata must never shadow a real local file.
    const candidateIds = [...new Set([
      key,
      await digest(url),
      await digest(stableRemoteUrl(url)),
      ref.sha256 ?? '',
      ref.fileAssetId ?? '',
    ].filter(Boolean))]
    let cached: LocalAsset | null = null
    let matchedKey = key
    for (const candidateId of candidateIds) {
      const candidate = await localDb.get<LocalAsset>('local_assets', candidateId)
      if (candidate?.status === 'ready' && candidate.localUri) {
        cached = candidate
        matchedKey = candidateId
        break
      }
    }
    if (cached?.status === 'ready' && cached.localUri) {
      if (isNative() && cached.localPath) {
        try {
          await Filesystem.stat({ path: cached.localPath, directory: Directory.Data })
        } catch {
          await localDb.delete('local_assets', matchedKey)
          if (ref.offlineOnly) {
            console.error('[offline-assets] offline package file is missing; remote request blocked', {
              key: matchedKey,
              requestedUrl: url,
              localPath: cached.localPath,
            })
            return '__offline_resource_missing__'
          }
          return this.download({ ...ref, url })
        }
      }
      await localDb.put('local_assets', { ...cached, lastAccessedAt: new Date().toISOString() })
      console.log('[offline-assets] resolve hit', { key: matchedKey, requestedUrl: url, localPath: cached.localPath })
      return isNative() ? toLoadableUrl(cached.localUri) : cached.localUri
    }

    if (!isNative()) return url
    // Native is intentionally local-only. Package installation is the sole
    // explicit network-to-disk transition; normal rendering must never turn a
    // missing cache row into an invisible COS request.
    if (ref.offlineOnly || isNative()) {
      console.error('[offline-assets] native resource missing; remote request blocked', {
        key,
        requestedUrl: url,
        assetId: ref.assetId,
      })
      return '__offline_resource_missing__'
    }
    console.warn('[offline-assets] resolve miss; downloading remote fallback', { key, requestedUrl: url, assetId: ref.assetId })
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

      const now = new Date().toISOString()
      const record: LocalAsset = {
        id: key,
        assetId: key,
        remoteUrl: url,
        sha256: ref.sha256,
        mimeType: ref.mimeType,
        size: ref.size ?? buffer.byteLength,
        localPath: path,
        localUri: uri.uri,
        status: 'ready',
        downloadedAt: now,
        lastAccessedAt: now,
      }
      await localDb.put<LocalAsset>('local_assets', record)
      await putAliases(record, ref, url)
      console.log('[offline-assets] download saved', { key, bytes: buffer.byteLength, path, fileAssetId: ref.fileAssetId })

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
   * 此处直接复用，省去一次纯 JS 哈希计算。
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
      const record: LocalAsset = {
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
      }
      await localDb.put<LocalAsset>('local_assets', record)
      await putAliases(record, ref, url)
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

    const record: LocalAsset = {
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
    }
    await localDb.put<LocalAsset>('local_assets', record)
    await putAliases(record, ref, url)
    console.log('[offline-assets] pack file saved', {
      key,
      bytes: buffer.byteLength,
      path,
      fileAssetId: ref.fileAssetId,
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
    // Delete every alias together; otherwise a later install can see a stale
    // ready row and incorrectly deduplicate to a file that has been removed.
    const canonicalId = cached.assetId || cached.id
    await localDb.deleteWhere<LocalAsset>('local_assets', (asset) =>
      asset.id === canonicalId || asset.assetId === canonicalId,
    )
    console.log('[offline-assets] removed', { requestedId: assetId, canonicalId, path: cached.localPath })
  },

  async removeRef(ref: AssetRef): Promise<void> {
    const key = await assetKey(ref)
    await this.remove(key)
  },
}

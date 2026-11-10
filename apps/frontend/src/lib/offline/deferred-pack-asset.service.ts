import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { BlobReader, BlobWriter, ZipReader, type Entry } from '@zip.js/zip.js'
import { fileAssetIdFromUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'
import { assetCacheService, type AssetRef } from './asset-cache.service'
import { digestBuffer } from './sha256-worker.service'
import { localDb } from './unified-storage'

export interface DeferredPackAsset {
  id: string
  packId: string
  lookupKey: string
  fileAssetId?: string | null
  /** The complete package version which contains zipPath. */
  sourceZipVersion: number
  contentUrl: string
  signedUrl?: string | null
  zipPath: string
  sha256: string
  mimeType?: string | null
  size?: number | null
  role: string
  status: 'deferred' | 'invalid'
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

const openZips = new Map<string, { reader: ZipReader<any>; entries: Map<string, Entry> }>()
const fileWrites = new Map<string, Promise<void>>()
const materializations = new Map<string, Promise<string | null>>()
const packLocks = new Map<string, Promise<void>>()

function stableContentUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url
  }
}

export function deferredLookupKeys(url: string, assetId?: string | null): string[] {
  const fileAssetId = assetId || fileAssetIdFromUrl(url)
  return [...new Set([
    fileAssetId ? `asset:${fileAssetId}` : '',
    `url:${stableContentUrl(url)}`,
  ].filter(Boolean))]
}

export function learningPackZipPath(packId: string, version: number) {
  return `learning-packs/${packId}/${version}.zip`
}

async function readZip(packId: string, version: number) {
  const key = `${packId}:${version}`
  const cached = openZips.get(key)
  if (cached) return cached

  const uri = await Filesystem.getUri({ path: learningPackZipPath(packId, version), directory: Directory.Data })
  // Fetching Capacitor's local URL avoids Filesystem.readFile's base64 string
  // expansion. Keep one opened package only; a vocabulary dialog can otherwise
  // retain multiple full package Blobs in WKWebView memory.
  for (const [openKey, open] of openZips) {
    await open.reader.close().catch(() => undefined)
    openZips.delete(openKey)
  }
  const response = await fetch(Capacitor.convertFileSrc(uri.uri))
  if (!response.ok) throw new Error(`Cannot read retained package (${response.status})`)
  const reader = new ZipReader(new BlobReader(await response.blob()))
  const entries = new Map<string, Entry>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) entries.set(entry.filename.replace(/\\/g, '/').replace(/^\/+/, ''), entry)
  }
  const opened = { reader, entries }
  openZips.set(key, opened)
  return opened
}

async function readEntry(entry: Entry) {
  const readable = entry as Entry & { getData?: (writer: BlobWriter) => Promise<Blob> }
  if (!readable.getData) throw new Error(`Zip entry is not readable: ${entry.filename}`)
  return (await readable.getData(new BlobWriter())).arrayBuffer()
}

async function ensurePhysicalFile(asset: DeferredPackAsset) {
  const existing = fileWrites.get(asset.sha256)
  if (existing) return existing
  const work = (async () => {
    if (await assetCacheService.isReady(asset.sha256)) return
    const { entries } = await readZip(asset.packId, asset.sourceZipVersion)
    const entry = entries.get(asset.zipPath.replace(/\\/g, '/').replace(/^\/+/, ''))
    if (!entry) throw new Error(`Retained package is missing ${asset.zipPath}`)
    const buffer = await readEntry(entry)
    const actual = await digestBuffer(buffer)
    if (actual.toLowerCase() !== asset.sha256.toLowerCase()) {
      throw new Error(`Pack asset hash mismatch: ${asset.zipPath}`)
    }
    const ref: AssetRef = {
      url: asset.contentUrl,
      fileAssetId: asset.fileAssetId ?? undefined,
      path: asset.zipPath,
      sha256: asset.sha256,
      mimeType: asset.mimeType,
      size: asset.size,
      role: asset.role,
    }
    await assetCacheService.saveFromBufferWithSha256(ref, buffer, asset.sha256)
  })()
  fileWrites.set(asset.sha256, work)
  try {
    await work
  } finally {
    fileWrites.delete(asset.sha256)
  }
}

async function materialize(asset: DeferredPackAsset): Promise<string | null> {
  try {
    await ensurePhysicalFile(asset)
  } catch (error) {
    // A corrupt/missing entry should not cause every later playback to reread
    // the package. Keep transient I/O errors retryable, but disable proven bad
    // entries and let resolvePlaybackAudio take its existing network fallback.
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('missing') || message.includes('hash mismatch')) {
      await localDb.put('deferred_pack_assets', {
        ...asset,
        status: 'invalid',
        lastError: message,
        updatedAt: new Date().toISOString(),
      })
    }
    return null
  }

  // Uninstall may have completed while the ZIP was being read. Do not restore
  // a reference for a pack that no longer owns this resource.
  return thisService.withPackLock(asset.packId, async () => {
    // Re-read the row while holding the pack lock: a full update/uninstall may
    // have removed it while its ZIP entry was being decoded.
    const [pack, current] = await Promise.all([
      localDb.get<{ status?: string }>('downloaded_packs', asset.packId),
      localDb.get<DeferredPackAsset>('deferred_pack_assets', asset.id),
    ])
    if (pack?.status !== 'installed' || current?.status !== 'deferred' || current.sha256 !== asset.sha256) return null

    const ref: AssetRef = {
      url: asset.contentUrl,
      fileAssetId: asset.fileAssetId ?? undefined,
      path: asset.zipPath,
      sha256: asset.sha256,
      mimeType: asset.mimeType,
      size: asset.size,
      role: asset.role,
    }
    await assetCacheService.addAliases(asset.sha256, ref)
    await localDb.put('asset_refs', {
      id: `${asset.packId}:${asset.sha256}`,
      sha256: asset.sha256,
      packId: asset.packId,
      logicalPath: asset.zipPath,
      ext: asset.zipPath.split('.').pop() || 'bin',
      updatedAt: new Date().toISOString(),
      data: JSON.stringify({ role: asset.role }),
    })
    await localDb.delete('deferred_pack_assets', asset.id)
    return assetCacheService.resolve({ ...ref, asFileUri: false })
  })
}

const thisService = {
  async withPackLock<T>(packId: string, work: () => Promise<T>): Promise<T> {
    const previous = packLocks.get(packId) ?? Promise.resolve()
    let release!: () => void
    const turn = new Promise<void>((resolve) => { release = resolve })
    const queued = previous.then(() => turn)
    packLocks.set(packId, queued)
    await previous.catch(() => undefined)
    try {
      return await work()
    } finally {
      release()
      if (packLocks.get(packId) === queued) packLocks.delete(packId)
    }
  },
  async resolve(input: { url: string; assetId?: string | null; role?: string; asFileUri?: boolean }): Promise<string | null> {
    if (!isNative() || !input.url) return null
    const candidates = await localDb.findByIndexIn<DeferredPackAsset>(
      'deferred_pack_assets',
      'lookup_key',
      deferredLookupKeys(input.url, input.assetId),
    )
    const asset = candidates.find((candidate) => candidate.status === 'deferred')
    if (!asset) return null
    const existing = materializations.get(asset.id)
    const work = existing ?? materialize(asset)
    materializations.set(asset.id, work)
    try {
      const resolved = await work
      if (!resolved) return null
      if (!input.asFileUri) return resolved
      return assetCacheService.resolve({
        url: asset.contentUrl,
        fileAssetId: asset.fileAssetId ?? undefined,
        sha256: asset.sha256,
        asFileUri: true,
      })
    } finally {
      materializations.delete(asset.id)
    }
  },

  async discardPack(packId: string) {
    for (const [key, open] of openZips) {
      if (!key.startsWith(`${packId}:`)) continue
      await open.reader.close().catch(() => undefined)
      openZips.delete(key)
    }
  },

  /** Warm only the vocabulary currently being inspected; no network fallback. */
  async preload(urls: Array<string | null | undefined>) {
    await Promise.all(urls.filter((url): url is string => Boolean(url)).map((url) => (
      this.resolve({ url }).catch(() => null)
    )))
  },

  /**
   * Background drain: materialize deferred pack assets from retained zips.
   * Processes one pack at a time so a single ZipReader stays hot in memory.
   */
  async materializePending(packId?: string): Promise<void> {
    if (!isNative()) return
    const concurrency = 2
    for (;;) {
      const pending = packId
        ? (await localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'pack_id', packId))
          .filter((row) => row.status === 'deferred')
        : (await localDb.findByIndex<DeferredPackAsset>('deferred_pack_assets', 'status', 'deferred'))
      if (pending.length === 0) return

      const byPack = new Map<string, DeferredPackAsset[]>()
      for (const row of pending) {
        const list = byPack.get(row.packId) ?? []
        list.push(row)
        byPack.set(row.packId, list)
      }

      let progressed = false
      for (const [currentPackId, rows] of byPack) {
        const pack = await localDb.get<{ status?: string }>('downloaded_packs', currentPackId)
        if (pack?.status !== 'installed') continue
        for (let i = 0; i < rows.length; i += concurrency) {
          const batch = rows.slice(i, i + concurrency)
          const results = await Promise.all(batch.map(async (asset) => {
            const existing = materializations.get(asset.id)
            const work = existing ?? materialize(asset)
            materializations.set(asset.id, work)
            try {
              return await work
            } finally {
              materializations.delete(asset.id)
            }
          }))
          if (results.some((value) => value != null)) progressed = true
        }
      }
      // Avoid a tight loop when every row is invalid / pack uninstalled.
      if (!progressed) return
    }
  },

  async clearOpenZips() {
    for (const open of openZips.values()) await open.reader.close().catch(() => undefined)
    openZips.clear()
  },
}

export const deferredPackAssetService = thisService

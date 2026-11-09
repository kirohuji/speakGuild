import { Capacitor } from '@capacitor/core'
import { Assets, Texture } from 'pixi.js'
import { getBearerToken } from '@/features/auth/client'
import { inlineFileAssetContentUrl, resolveDisplayAssetUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'

/**
 * VN texture runtime
 *
 * Goals:
 * - Seamless stage: CSS/<img> can show capacitor:// immediately while WebGL catches up
 * - On-demand decode for Pixi (fetch→blob/ImageBitmap — required on iOS)
 * - Warm soon-needed URLs without keeping them forever
 * - LRU eviction for unused decoded textures so long sessions don't grow forever
 *
 * Display URL (CSS/img) ≠ GPU texture. Never Texture.from(capacitor HTMLImageElement).
 */

const DEFAULT_MAX_ENTRIES = 16

type RuntimeEntry = {
  key: string
  texture: Texture | null
  blobUrl: string | null
  retain: number
  lastUsed: number
  promise: Promise<Texture> | null
}

function isCapacitorLocalUrl(url: string) {
  return url.startsWith('capacitor:')
    || url.startsWith('file:')
    || url.startsWith('http://localhost/_capacitor_file_')
    || url.startsWith('https://localhost/_capacitor_file_')
}

function isOwnCosUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith('.myqcloud.com')
  } catch {
    return false
  }
}

function hasImageExtension(url: string) {
  return /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#]|$)/i.test(url)
}

/** Stable cache key + WebView-displayable local URL. */
export function toVnDisplayUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  const display = resolveDisplayAssetUrl(url) ?? url
  if (!display) return undefined
  if (display.startsWith('file:')) {
    try {
      return Capacitor.convertFileSrc(display)
    } catch {
      return display
    }
  }
  return display
}

async function fetchBlob(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`vn texture fetch failed (${response.status})`)
  return response.blob()
}

async function decodeViaBlob(url: string): Promise<{ texture: Texture; blobUrl: string | null }> {
  const blob = await fetchBlob(url)
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    const texture = Texture.from(bitmap)
    texture.source.scaleMode = 'linear'
    return { texture, blobUrl: null }
  }
  const blobUrl = URL.createObjectURL(blob)
  const texture = await Assets.load<Texture>({
    src: blobUrl,
    parser: 'texture',
    data: { scaleMode: 'linear' },
  })
  if (!texture) throw new Error('empty texture from blob')
  texture.source.scaleMode = 'linear'
  return { texture, blobUrl }
}

async function decodeViaAssets(url: string): Promise<{ texture: Texture; blobUrl: string | null }> {
  if (hasImageExtension(url)) {
    const texture = await Assets.load<Texture>(url)
    if (!texture) throw new Error('empty texture')
    texture.source.scaleMode = 'linear'
    return { texture, blobUrl: null }
  }
  if (Assets.cache.has(url)) {
    const cached = Assets.get<Texture>(url)
    if (cached) {
      cached.source.scaleMode = 'linear'
      return { texture: cached, blobUrl: null }
    }
    await Assets.unload(url)
  }
  const texture = await Assets.load<Texture>({
    src: url,
    parser: 'texture',
    data: { scaleMode: 'linear' },
  })
  if (!texture) throw new Error('empty texture')
  texture.source.scaleMode = 'linear'
  return { texture, blobUrl: null }
}

async function resolveWebLoadUrl(displayUrl: string): Promise<string> {
  const inline = inlineFileAssetContentUrl(displayUrl)
  if (inline) return inline
  if (!isOwnCosUrl(displayUrl)) return displayUrl
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu').replace(/\/$/, '')
  const endpoint = `${apiBase}/file-assets/sampling/proxy?url=${encodeURIComponent(displayUrl)}`
  const token = getBearerToken()
  const response = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error(`texture proxy failed: ${response.status}`)
  return URL.createObjectURL(await response.blob())
}

async function decodeTexture(key: string): Promise<{ texture: Texture; blobUrl: string | null }> {
  if (isNative()) {
    // Local + remote on device: always blob path for untainted WebGL.
    return decodeViaBlob(key)
  }
  if (key.startsWith('blob:') || key.startsWith('data:')) {
    return decodeViaAssets(key)
  }
  const loadUrl = await resolveWebLoadUrl(key)
  const ownedBlob = loadUrl.startsWith('blob:') && loadUrl !== key ? loadUrl : null
  try {
    const decoded = await decodeViaAssets(loadUrl)
    return { texture: decoded.texture, blobUrl: ownedBlob }
  } catch (error) {
    if (ownedBlob) URL.revokeObjectURL(ownedBlob)
    throw error
  }
}

class VnTextureRuntime {
  private entries = new Map<string, RuntimeEntry>()
  private maxEntries = DEFAULT_MAX_ENTRIES
  /** URLs currently pinned by the live stage (bg + sprite). */
  private visibleKeys = new Set<string>()

  setBudget(maxEntries: number) {
    this.maxEntries = Math.max(4, maxEntries)
    this.trim()
  }

  isReady(url?: string | null) {
    const key = toVnDisplayUrl(url)
    if (!key) return false
    const entry = this.entries.get(key)
    return Boolean(entry?.texture && !entry.texture.destroyed)
  }

  /** Decode if needed; does not change retain count. */
  async ensure(url: string): Promise<Texture> {
    const key = toVnDisplayUrl(url)
    if (!key) throw new Error('empty vn texture url')

    const existing = this.entries.get(key)
    if (existing?.texture && !existing.texture.destroyed) {
      existing.lastUsed = Date.now()
      return existing.texture
    }
    if (existing?.promise) return existing.promise

    const entry: RuntimeEntry = existing ?? {
      key,
      texture: null,
      blobUrl: null,
      retain: 0,
      lastUsed: Date.now(),
      promise: null,
    }
    this.entries.set(key, entry)

    entry.promise = decodeTexture(key).then(({ texture, blobUrl }) => {
      if (entry.texture && entry.texture !== texture && !entry.texture.destroyed) {
        entry.texture.destroy(true)
      }
      if (entry.blobUrl && entry.blobUrl !== blobUrl) URL.revokeObjectURL(entry.blobUrl)
      entry.texture = texture
      entry.blobUrl = blobUrl
      entry.promise = null
      entry.lastUsed = Date.now()
      this.trim()
      return texture
    }).catch((error) => {
      entry.promise = null
      throw error
    })

    return entry.promise
  }

  /** Keep a texture alive while it is on stage. */
  async acquire(url: string): Promise<Texture> {
    const key = toVnDisplayUrl(url)
    if (!key) throw new Error('empty vn texture url')
    const texture = await this.ensure(url)
    const entry = this.entries.get(key)
    if (entry) {
      entry.retain += 1
      entry.lastUsed = Date.now()
    }
    return texture
  }

  release(url?: string | null) {
    const key = toVnDisplayUrl(url)
    if (!key) return
    const entry = this.entries.get(key)
    if (!entry) return
    entry.retain = Math.max(0, entry.retain - 1)
    entry.lastUsed = Date.now()
    this.trim()
  }

  /**
   * Stage-facing pin set: retain the new visible URLs, release ones that left.
   * Warm/decode happens in parallel for newcomers.
   */
  setVisible(urls: Array<string | null | undefined>) {
    const next = new Set<string>()
    for (const url of urls) {
      const key = toVnDisplayUrl(url)
      if (key) next.add(key)
    }

    for (const key of this.visibleKeys) {
      if (!next.has(key)) {
        const entry = this.entries.get(key)
        if (entry) entry.retain = Math.max(0, entry.retain - 1)
      }
    }

    for (const key of next) {
      if (!this.visibleKeys.has(key)) {
        void this.acquire(key).catch((error) => {
          console.warn('[vn-texture] visible acquire failed', key, error)
        })
      } else {
        const entry = this.entries.get(key)
        if (entry) entry.lastUsed = Date.now()
      }
    }

    this.visibleKeys = next
    this.trim()
  }

  /** Soft prefetch — decode now, eligible for LRU immediately after. */
  warmup(urls: Array<string | null | undefined>) {
    for (const url of urls) {
      if (!url) continue
      void this.ensure(url).catch(() => undefined)
    }
  }

  clear() {
    for (const entry of [...this.entries.values()]) this.destroyEntry(entry)
    this.visibleKeys.clear()
  }

  private destroyEntry(entry: RuntimeEntry) {
    if (entry.texture && !entry.texture.destroyed) {
      try {
        entry.texture.destroy(true)
      } catch {
        /* ignore */
      }
    }
    if (entry.blobUrl) {
      try {
        URL.revokeObjectURL(entry.blobUrl)
      } catch {
        /* ignore */
      }
    }
    this.entries.delete(entry.key)
  }

  private trim() {
    if (this.entries.size <= this.maxEntries) return
    const victims = [...this.entries.values()]
      .filter((entry) => entry.retain === 0 && !entry.promise && !this.visibleKeys.has(entry.key))
      .sort((a, b) => a.lastUsed - b.lastUsed)

    while (this.entries.size > this.maxEntries && victims.length > 0) {
      const victim = victims.shift()
      if (!victim) break
      this.destroyEntry(victim)
    }
  }
}

export const vnTextureRuntime = new VnTextureRuntime()

/** @deprecated Prefer vnTextureRuntime.acquire / ensure from VN stage. */
export async function loadPixiTextureViaRuntime(url: string): Promise<Texture> {
  return vnTextureRuntime.ensure(url)
}

export function isVnLocalDisplayUrl(url: string) {
  return isCapacitorLocalUrl(url)
}

import { Capacitor } from '@capacitor/core'
import { Assets, Texture } from 'pixi.js'
import { inlineFileAssetContentUrl, resolveDisplayAssetUrl } from '@/lib/file-asset-reference'
import { isNative } from '@/lib/native'

function hasImageExtension(url: string) {
  return /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#]|$)/i.test(url)
}

function isOwnCosUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith('.myqcloud.com')
  } catch {
    return false
  }
}

function isCapacitorLocalUrl(url: string) {
  return url.startsWith('capacitor:')
    || url.startsWith('file:')
    || url.startsWith('http://localhost/_capacitor_file_')
    || url.startsWith('https://localhost/_capacitor_file_')
}

const proxiedTextureUrls = new Map<string, string>()

async function materializeBlobUrl(sourceUrl: string, fetchUrl = sourceUrl): Promise<string> {
  const cached = proxiedTextureUrls.get(sourceUrl)
  if (cached) return cached
  const response = await fetch(fetchUrl)
  if (!response.ok) throw new Error(`texture fetch failed: ${response.status}`)
  const blobUrl = URL.createObjectURL(await response.blob())
  proxiedTextureUrls.set(sourceUrl, blobUrl)
  return blobUrl
}

/**
 * WebGL fetches pixels itself. `asset://` is not a browser scheme, and a
 * redirect to COS has no CORS header. Resolve the reference, ask our API for
 * the bytes, or proxy an already-signed COS URL.
 *
 * On native, `<img>` can load `capacitor://`, but Pixi/WebGL often cannot.
 * Materialize a blob: URL from the local file bytes instead.
 *
 * Immersive VN should prefer `vnTextureRuntime` (CSS underlay + retain/LRU).
 */
export async function pixiLoadableUrl(url: string): Promise<string> {
  const displayUrl = resolveDisplayAssetUrl(url) ?? url
  if (isNative()) {
    if (!isCapacitorLocalUrl(displayUrl)) return displayUrl
    const fetchUrl = displayUrl.startsWith('file:')
      ? Capacitor.convertFileSrc(displayUrl)
      : displayUrl
    return materializeBlobUrl(displayUrl, fetchUrl)
  }
  const inline = inlineFileAssetContentUrl(displayUrl)
  if (inline) return inline
  if (!isOwnCosUrl(displayUrl)) return displayUrl
  return materializeBlobUrl(displayUrl)
}

export function isPixiFetchableUrl(url: string) {
  return /^(data:|blob:|file:|capacitor:|https?:)/i.test(url)
}

/** Content URLs have no file extension, so Pixi will not pick an image parser on its own. */
export async function loadPixiTexture(url: string): Promise<Texture> {
  const loadUrl = await pixiLoadableUrl(url)
  if (!isPixiFetchableUrl(loadUrl)) {
    throw new Error(`unresolved local asset: ${url}`)
  }
  if (hasImageExtension(loadUrl)) {
    const texture = await Assets.load<Texture>(loadUrl)
    if (!texture) throw new Error(`empty texture: ${url}`)
    texture.source.scaleMode = 'linear'
    return texture
  }
  if (Assets.cache.has(loadUrl)) {
    const cached = Assets.get<Texture>(loadUrl)
    if (cached) {
      cached.source.scaleMode = 'linear'
      return cached
    }
    await Assets.unload(loadUrl)
  }
  const texture = await Assets.load<Texture>({
    src: loadUrl,
    parser: 'texture',
    data: { scaleMode: 'linear' },
  })
  if (!texture) throw new Error(`empty texture: ${url}`)
  texture.source.scaleMode = 'linear'
  return texture
}

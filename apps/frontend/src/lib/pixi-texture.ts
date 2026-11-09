import { Assets, Texture } from 'pixi.js'
import { getBearerToken } from '@/features/auth/client'
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

const proxiedTextureUrls = new Map<string, string>()

/**
 * WebGL fetches pixels itself. `asset://` is not a browser scheme, and a
 * redirect to COS has no CORS header. Resolve the reference, ask our API for
 * the bytes, or proxy an already-signed COS URL. Native builds keep the
 * original local file URL.
 */
export async function pixiLoadableUrl(url: string): Promise<string> {
  const displayUrl = resolveDisplayAssetUrl(url) ?? url
  if (isNative()) return displayUrl
  const inline = inlineFileAssetContentUrl(displayUrl)
  if (inline) return inline
  if (!isOwnCosUrl(displayUrl)) return displayUrl
  const cached = proxiedTextureUrls.get(displayUrl)
  if (cached) return cached
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu').replace(/\/$/, '')
  const endpoint = `${apiBase}/file-assets/sampling/proxy?url=${encodeURIComponent(displayUrl)}`
  const token = getBearerToken()
  const response = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error(`texture proxy failed: ${response.status}`)
  const blobUrl = URL.createObjectURL(await response.blob())
  proxiedTextureUrls.set(displayUrl, blobUrl)
  return blobUrl
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
    return texture
  }
  if (Assets.cache.has(loadUrl)) {
    const cached = Assets.get<Texture>(loadUrl)
    if (cached) return cached
    await Assets.unload(loadUrl)
  }
  const texture = await Assets.load<Texture>({
    src: loadUrl,
    parser: 'texture',
    data: { scaleMode: 'linear' },
  })
  if (!texture) throw new Error(`empty texture: ${url}`)
  return texture
}

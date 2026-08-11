const FILE_ASSET_SCHEME = 'asset://'

function apiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '/api/v1/manyu').replace(/\/$/, '')
}

function isTraversable(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (value instanceof Date) return false
  if (typeof Blob !== 'undefined' && value instanceof Blob) return false
  if (typeof FormData !== 'undefined' && value instanceof FormData) return false
  return Object.getPrototypeOf(value) === Object.prototype
}

export function createFileAssetReference(assetId: string, suffix = '') {
  return `${FILE_ASSET_SCHEME}${encodeURIComponent(assetId)}${suffix}`
}

export function parseFileAssetReference(value?: string | null): { assetId: string; suffix: string } | null {
  if (!value?.startsWith(FILE_ASSET_SCHEME)) return null
  const raw = value.slice(FILE_ASSET_SCHEME.length)
  const suffixIndex = raw.search(/[?#]/)
  const encodedId = suffixIndex >= 0 ? raw.slice(0, suffixIndex) : raw
  if (!encodedId || encodedId.includes('/')) return null
  try {
    return {
      assetId: decodeURIComponent(encodedId),
      suffix: suffixIndex >= 0 ? raw.slice(suffixIndex) : '',
    }
  } catch {
    return null
  }
}

export function parseFileAssetContentUrl(value?: string | null): { assetId: string; suffix: string } | null {
  if (!value) return null
  try {
    const parsed = new URL(value, 'http://manyu.local')
    const match = parsed.pathname.match(/\/file-assets\/([^/]+)\/content\/?$/)
    if (!match?.[1]) return null
    return {
      assetId: decodeURIComponent(match[1]),
      suffix: `${parsed.search}${parsed.hash}`,
    }
  } catch {
    return null
  }
}

export function getFileAssetContentUrl(assetId: string, suffix = ''): string {
  const path = `${apiBaseUrl()}/file-assets/${encodeURIComponent(assetId)}/content${suffix}`
  if (/^https?:\/\//i.test(path)) return path
  if (typeof window !== 'undefined') return new URL(path, window.location.origin).toString()
  return path
}

/** Resolve a persisted asset:// reference for img/audio/video at runtime. */
export function resolveFileAssetUrl(value?: string | null): string {
  if (!value) return ''
  const reference = parseFileAssetReference(value)
  return reference ? getFileAssetContentUrl(reference.assetId, reference.suffix) : value
}

function transformDeep(value: unknown, transformString: (value: string) => string): unknown {
  if (typeof value === 'string') return transformString(value)
  if (Array.isArray(value)) return value.map((item) => transformDeep(item, transformString))
  if (isTraversable(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, transformDeep(item, transformString)]),
    )
  }
  return value
}

/** Convert runtime media URLs back to the only format allowed in persistence. */
export function serializeFileAssetReferences<T>(value: T): T {
  return transformDeep(value, (current) => {
    const content = parseFileAssetContentUrl(current)
    return content
      ? createFileAssetReference(content.assetId, content.suffix)
      : current
  }) as T
}

/** Convert API asset references to URLs using this device's API base URL. */
export function resolveFileAssetReferences<T>(value: T): T {
  return transformDeep(value, resolveFileAssetUrl) as T
}

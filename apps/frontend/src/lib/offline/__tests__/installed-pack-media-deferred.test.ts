import { beforeEach, describe, expect, it, vi } from 'vitest'

const localAssets = new Map<string, any>()
const packs = new Map<string, any>()
const resolveDeferred = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    convertFileSrc: (url: string) => url.replace(/^file:\/\//, 'capacitor://localhost/_capacitor_file_'),
    isNativePlatform: () => true,
    registerPlugin: vi.fn(),
  },
  registerPlugin: vi.fn(),
}))

vi.mock('../asset-cache.service', () => ({
  OFFLINE_RESOURCE_MISSING: '__offline_resource_missing__',
}))

vi.mock('../deferred-pack-asset.service', () => ({
  deferredPackAssetService: {
    resolve: (...args: unknown[]) => resolveDeferred(...args),
  },
}))

vi.mock('../unified-storage', () => ({
  localDb: {
    get: vi.fn(async (store: string, id: string) => {
      if (store === 'local_assets') return localAssets.get(id) ?? null
      if (store === 'downloaded_packs') return packs.get(id) ?? null
      return null
    }),
  },
}))

vi.mock('@/lib/file-asset-reference', () => ({
  createFileAssetReference: (id: string) => `asset://${id}`,
  fileAssetIdFromUrl: (url?: string | null) => {
    if (!url) return null
    const match = /^asset:\/\/([^/?#]+)/.exec(url)
    return match?.[1] ?? null
  },
  resolveFileAssetUrl: (url?: string | null) => url || undefined,
}))

import { resolveInstalledMedia } from '../installed-pack-media'

describe('resolveInstalledMedia deferred materialize', () => {
  beforeEach(() => {
    localAssets.clear()
    packs.clear()
    resolveDeferred.mockReset()
    packs.set('pack-a', {
      manifest: {
        assets: [
          {
            sha256: 'sha-bg',
            fileAssetId: 'file-bg',
            url: 'https://cdn.example/bg.png?sig=1',
            alias: 'bg',
          },
        ],
      },
    })
  })

  it('returns local_assets hit without calling deferred', async () => {
    localAssets.set('sha-bg', {
      id: 'sha-bg',
      status: 'ready',
      localUri: 'capacitor://localhost/_capacitor_file_/offline-assets/sha-bg.png',
    })

    const url = await resolveInstalledMedia('pack-a', { fileAssetId: 'file-bg' })
    expect(url).toContain('sha-bg.png')
    expect(resolveDeferred).not.toHaveBeenCalled()
  })

  it('materializes deferred asset when local_assets miss', async () => {
    resolveDeferred.mockResolvedValue('capacitor://localhost/_capacitor_file_/offline-assets/sha-bg.png')

    const url = await resolveInstalledMedia('pack-a', {
      url: 'asset://file-bg',
      fileAssetId: 'file-bg',
    })

    expect(resolveDeferred).toHaveBeenCalledWith({
      url: 'asset://file-bg',
      assetId: 'file-bg',
    })
    expect(url).toContain('sha-bg.png')
  })

  it('keeps miss empty when deferred cannot materialize', async () => {
    resolveDeferred.mockResolvedValue(null)
    const url = await resolveInstalledMedia('pack-a', { fileAssetId: 'file-bg' })
    expect(url).toBeUndefined()
  })
})

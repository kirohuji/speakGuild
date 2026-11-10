import { beforeEach, describe, expect, it, vi } from 'vitest'

const deferredRows: any[] = []
const packs = new Map<string, any>()
const materializeCalls: string[] = []

vi.mock('@/lib/native', () => ({
  isNative: () => true,
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    convertFileSrc: (url: string) => url,
  },
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: {
    getUri: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///data/${path}` })),
  },
}))

vi.mock('@zip.js/zip.js', () => ({
  BlobReader: vi.fn(),
  BlobWriter: vi.fn(),
  ZipReader: vi.fn(),
}))

vi.mock('@/lib/file-asset-reference', () => ({
  fileAssetIdFromUrl: vi.fn(),
}))

vi.mock('../sha256-worker.service', () => ({
  digestBuffer: vi.fn(async () => 'sha-1'),
}))

vi.mock('../asset-cache.service', () => ({
  assetCacheService: {
    isReady: vi.fn(async () => false),
    saveFromBufferWithSha256: vi.fn(),
    addAliases: vi.fn(),
    resolve: vi.fn(async () => 'capacitor://local/sha-1.bin'),
  },
}))

vi.mock('../unified-storage', () => ({
  localDb: {
    get: vi.fn(async (store: string, id: string) => {
      if (store === 'downloaded_packs') return packs.get(id) ?? null
      if (store === 'deferred_pack_assets') return deferredRows.find((row) => row.id === id) ?? null
      return null
    }),
    findByIndex: vi.fn(async (store: string, column: string, value: string) => {
      if (store !== 'deferred_pack_assets') return []
      if (column === 'pack_id') return deferredRows.filter((row) => row.packId === value)
      if (column === 'status') return deferredRows.filter((row) => row.status === value)
      return []
    }),
    findByIndexIn: vi.fn(async () => []),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async (_store: string, id: string) => {
      const index = deferredRows.findIndex((row) => row.id === id)
      if (index >= 0) deferredRows.splice(index, 1)
    }),
  },
}))

// Force materialize to succeed without opening a real zip by stubbing through resolve path:
// we spy materializePending's per-row work via a thin wrapper after import.
import { deferredPackAssetService } from '../deferred-pack-asset.service'

describe('deferredPackAssetService.materializePending', () => {
  beforeEach(() => {
    deferredRows.length = 0
    packs.clear()
    materializeCalls.length = 0
    packs.set('pack-a', { status: 'installed' })
    deferredRows.push(
      {
        id: 'pack-a:1:asset:a',
        packId: 'pack-a',
        lookupKey: 'asset:a',
        sourceZipVersion: 1,
        contentUrl: 'asset://a',
        zipPath: 'assets/a.bin',
        sha256: 'sha-a',
        role: 'image',
        status: 'deferred',
      },
      {
        id: 'pack-a:1:asset:b',
        packId: 'pack-a',
        lookupKey: 'asset:b',
        sourceZipVersion: 1,
        contentUrl: 'asset://b',
        zipPath: 'assets/b.bin',
        sha256: 'sha-b',
        role: 'image',
        status: 'deferred',
      },
    )
  })

  it('skips packs that are no longer installed', async () => {
    packs.set('pack-a', { status: 'installing' })
    await deferredPackAssetService.materializePending('pack-a')
    expect(deferredRows).toHaveLength(2)
  })

  it('stops when every pending row stays deferred after failed materialize', async () => {
    // Without a readable retained zip, materialize marks nothing deleted and returns null.
    await deferredPackAssetService.materializePending('pack-a')
    expect(deferredRows).toHaveLength(2)
  })
})

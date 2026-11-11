import { beforeEach, describe, expect, it, vi } from 'vitest'

const kv = new Map<string, any>()
const packs = new Map<string, any>()
const assetRefs: any[] = []
const removedAssets: string[] = []
const rmdirCalls: string[] = []

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  },
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: {
    rmdir: vi.fn(async ({ path }: { path: string }) => {
      rmdirCalls.push(path)
    }),
  },
}))

vi.mock('@capacitor/file-transfer', () => ({ FileTransfer: {} }))
vi.mock('@capacitor/network', () => ({ Network: { getStatus: vi.fn() } }))
vi.mock('@/features/auth/client', () => ({ getBearerToken: vi.fn() }))
vi.mock('@/features/learning/api/learning-api', () => ({ learningApi: {} }))
vi.mock('@/lib/file-asset-reference', () => ({
  createFileAssetReference: vi.fn(),
  fileAssetIdFromUrl: vi.fn(),
}))
vi.mock('capacitor-blob-writer', () => ({ default: vi.fn() }))
vi.mock('@zip.js/zip.js', () => ({
  BlobReader: vi.fn(),
  BlobWriter: vi.fn(),
  TextWriter: vi.fn(),
  ZipReader: vi.fn(),
}))

vi.mock('../asset-cache.service', () => ({
  assetCacheService: {
    remove: vi.fn(async (sha256: string) => {
      removedAssets.push(sha256)
    }),
  },
}))

vi.mock('../deferred-pack-asset.service', () => ({
  deferredPackAssetService: {
    withPackLock: vi.fn(async (_packId: string, fn: () => Promise<unknown>) => fn()),
    discardPack: vi.fn(async () => undefined),
    materializePending: vi.fn(async () => undefined),
  },
  deferredLookupKeys: vi.fn(),
  learningPackZipPath: vi.fn(),
}))

vi.mock('../learning-content.repository', () => ({
  learningContentRepository: {
    removePackContentIndex: vi.fn(async () => undefined),
  },
}))

vi.mock('../pack-audit.service', () => ({
  packAuditService: {
    record: vi.fn(async () => undefined),
    cleanup: vi.fn(async () => undefined),
  },
}))

vi.mock('../sha256-worker.service', () => ({ digestBuffer: vi.fn() }))
vi.mock('../learning-pack-read-model', () => ({
  readStoredTopicDetail: vi.fn(),
  readStoredUnitDetail: vi.fn(),
  writePackProjection: vi.fn(),
}))
vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../unified-storage', () => ({
  localDb: {
    get: vi.fn(async (store: string, id: string) => {
      if (store === 'kv') return kv.get(id) ?? null
      if (store === 'downloaded_packs') return packs.get(id) ?? null
      return null
    }),
    put: vi.fn(async (store: string, value: any) => {
      if (store === 'kv') kv.set(value.id, value)
      if (store === 'downloaded_packs') packs.set(value.id ?? value.packId, value)
    }),
    delete: vi.fn(async (store: string, id: string) => {
      if (store === 'kv') kv.delete(id)
      if (store === 'downloaded_packs') packs.delete(id)
      if (store === 'downloaded_unit_details') return
    }),
    list: vi.fn(async (store: string) => {
      if (store === 'kv') return [...kv.values()]
      if (store === 'downloaded_packs') return [...packs.values()]
      return []
    }),
    findByIndex: vi.fn(async (store: string, column: string, value: string) => {
      if (store === 'asset_refs' && column === 'pack_id') {
        return assetRefs.filter((ref) => ref.packId === value)
      }
      if (store === 'asset_refs' && column === 'sha256') {
        return assetRefs.filter((ref) => ref.sha256 === value)
      }
      return []
    }),
    findByIndexIn: vi.fn(async (store: string, column: string, values: Array<string | number>) => {
      const wanted = new Set(values.map(String))
      if (store === 'asset_refs' && column === 'sha256') {
        return assetRefs.filter((ref) => wanted.has(String(ref.sha256)))
      }
      return []
    }),
    deleteByIndex: vi.fn(async (store: string, column: string, value: string) => {
      if (store === 'asset_refs' && column === 'pack_id') {
        for (let i = assetRefs.length - 1; i >= 0; i--) {
          if (assetRefs[i].packId === value) assetRefs.splice(i, 1)
        }
      }
    }),
  },
}))

import { learningPackService } from '../learning-pack.service'

describe('learning pack uninstall GC', () => {
  beforeEach(() => {
    kv.clear()
    packs.clear()
    assetRefs.length = 0
    removedAssets.length = 0
    rmdirCalls.length = 0

    packs.set('pack-a', {
      id: 'pack-a',
      packId: 'pack-a',
      version: 3,
      title: 'Cafe',
      manifest: { packId: 'pack-a', version: 3, title: 'Cafe' },
      status: 'installed',
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    assetRefs.push(
      { id: 'ref-1', packId: 'pack-a', sha256: 'sha-unique' },
      { id: 'ref-2', packId: 'pack-a', sha256: 'sha-shared' },
      { id: 'ref-3', packId: 'pack-b', sha256: 'sha-shared' },
    )
  })

  it('uninstallMetadata removes pack row and enqueues GC without deleting files yet', async () => {
    await learningPackService.uninstallMetadata('pack-a')

    expect(packs.has('pack-a')).toBe(false)
    expect(removedAssets).toEqual([])
    expect(rmdirCalls).toEqual([])

    const job = kv.get('learning-pack-gc:pack-a')
    expect(job).toMatchObject({
      packId: 'pack-a',
      status: 'pending',
      title: 'Cafe',
      version: 3,
    })
    expect(job.filesToRemove).toEqual(['sha-unique'])
    expect(kv.get('learning-pack-operation:pack-a')?.phase).toBe('committing')
  })

  it('drainPackGcQueue removes unshared assets, rmdirs pack dir, and clears journal/job', async () => {
    await learningPackService.uninstallMetadata('pack-a')
    await learningPackService.drainPackGcQueue()

    expect(removedAssets).toEqual(['sha-unique'])
    expect(rmdirCalls).toContain('learning-packs/pack-a')
    expect(kv.has('learning-pack-gc:pack-a')).toBe(false)
    expect(kv.has('learning-pack-operation:pack-a')).toBe(false)
  })

  it('installUnit waits for pending GC before starting', async () => {
    await learningPackService.uninstallMetadata('pack-a')
    expect(kv.has('learning-pack-gc:pack-a')).toBe(true)

    const installSpy = vi.spyOn(learningPackService, 'installUnitFromZip').mockResolvedValue({
      id: 'pack-a',
      packId: 'pack-a',
      version: 4,
      title: 'Cafe',
      manifest: { packId: 'pack-a', version: 4, title: 'Cafe' } as any,
      status: 'installed',
      installedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    await learningPackService.installUnit('pack-a')

    expect(kv.has('learning-pack-gc:pack-a')).toBe(false)
    expect(removedAssets).toEqual(['sha-unique'])
    expect(installSpy).toHaveBeenCalled()
    installSpy.mockRestore()
  })
})

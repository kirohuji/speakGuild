import { beforeEach, describe, expect, it, vi } from 'vitest'

const assetRefs: any[] = []
const localAssets = new Map<string, any>()
const removedAssets: string[] = []
const releasedShas: string[] = []

vi.mock('@/lib/native', () => ({
  isNative: () => true,
}))

vi.mock('@/lib/file-asset-reference', () => ({
  fileAssetIdFromUrl: (url?: string | null) => {
    if (!url?.startsWith('asset://')) return null
    return decodeURIComponent(url.slice('asset://'.length))
  },
}))

vi.mock('../playback-audio', () => ({
  resolvePlaybackAudio: vi.fn(async ({ url }: { url: string }) => `local:${url}`),
}))

vi.mock('../asset-cache.service', () => ({
  stableRemoteUrl: (url: string) => url,
  assetCacheService: {
    findReadyAssetForUrl: vi.fn(async (url: string) => {
      const id = url.startsWith('asset://') ? decodeURIComponent(url.slice('asset://'.length)) : url
      return localAssets.get(id) ?? localAssets.get(`sha-for-${id}`) ?? null
    }),
    addAliases: vi.fn(async () => undefined),
    releaseIfUnreferenced: vi.fn(async (sha256: string) => {
      releasedShas.push(sha256)
      const remaining = assetRefs.filter((ref) => ref.sha256 === sha256)
      if (remaining.length === 0) removedAssets.push(sha256)
    }),
  },
}))

vi.mock('../unified-storage', () => ({
  localDb: {
    get: vi.fn(async (store: string, id: string) => {
      if (store === 'asset_refs') return assetRefs.find((ref) => ref.id === id) ?? null
      return null
    }),
    put: vi.fn(async (store: string, value: any) => {
      if (store === 'asset_refs') {
        const index = assetRefs.findIndex((ref) => ref.id === value.id)
        if (index >= 0) assetRefs[index] = value
        else assetRefs.push(value)
      }
    }),
    findByIndex: vi.fn(async (store: string, column: string, value: string) => {
      if (store !== 'asset_refs') return []
      if (column === 'pack_id') return assetRefs.filter((ref) => ref.packId === value)
      if (column === 'sha256') return assetRefs.filter((ref) => ref.sha256 === value)
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

import {
  collectPlaybackUrls,
  favoriteAudioPackId,
  favoriteAudioPinService,
} from '../favorite-audio-pin.service'

describe('favorite audio pin', () => {
  beforeEach(() => {
    assetRefs.length = 0
    localAssets.clear()
    removedAssets.length = 0
    releasedShas.length = 0
    localAssets.set('audio-us', {
      id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      assetId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      localUri: 'file://us.mp3',
      status: 'ready',
    })
    localAssets.set('audio-ex', {
      id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      assetId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      localUri: 'file://ex.mp3',
      status: 'ready',
    })
  })

  it('collects pronunciation and example audio urls', () => {
    expect(collectPlaybackUrls({
      audioUsUrl: 'asset://audio-us',
      audioUkUrl: 'asset://audio-uk',
      examples: [
        { en: 'Hi', audioUrl: 'asset://audio-ex' },
        { en: 'No audio' },
        { en: 'Dup', audioUrl: 'asset://audio-us' },
      ],
    })).toEqual([
      'asset://audio-us',
      'asset://audio-uk',
      'asset://audio-ex',
    ])
  })

  it('pins materialized audio under favorite:{entryId}', async () => {
    await favoriteAudioPinService.pinExpressionAudio({
      id: 'word:hello',
      contentSnapshot: {
        audioUsUrl: 'asset://audio-us',
        examples: [{ en: 'Hi', audioUrl: 'asset://audio-ex' }],
      },
    })

    const packId = favoriteAudioPackId('word:hello')
    expect(assetRefs.map((ref) => ref.packId)).toEqual([packId, packId])
    expect(assetRefs.map((ref) => ref.sha256).sort()).toEqual([
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ].sort())
  })

  it('unpin removes only unshared favorite audio', async () => {
    const shaShared = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    const shaAlone = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
    assetRefs.push(
      { id: 'favorite:word:a:sha-shared', packId: 'favorite:word:a', sha256: shaShared },
      { id: 'favorite:word:b:sha-shared', packId: 'favorite:word:b', sha256: shaShared },
      { id: 'favorite:word:a:sha-alone', packId: 'favorite:word:a', sha256: shaAlone },
      { id: 'pack-a:sha-shared', packId: 'pack-a', sha256: shaShared },
    )

    await favoriteAudioPinService.unpinExpressionAudio('word:a')

    expect(assetRefs.some((ref) => ref.packId === 'favorite:word:a')).toBe(false)
    expect(assetRefs.some((ref) => ref.packId === 'favorite:word:b')).toBe(true)
    expect(releasedShas.sort()).toEqual([shaAlone, shaShared].sort())
    expect(removedAssets).toEqual([shaAlone])
  })
})

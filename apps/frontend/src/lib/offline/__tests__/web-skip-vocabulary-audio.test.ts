import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = { value: false }

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.value,
    getPlatform: () => (native.value ? 'ios' : 'web'),
  },
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: {},
}))
vi.mock('@capacitor/file-transfer', () => ({ FileTransfer: {} }))
vi.mock('@capacitor/network', () => ({ Network: { getStatus: vi.fn() } }))
vi.mock('@/features/auth/client', () => ({ getBearerToken: vi.fn() }))
vi.mock('@/features/learning/api/learning-api', () => ({ learningApi: {} }))
vi.mock('@/lib/file-asset-reference', () => ({
  createFileAssetReference: (id: string) => `asset://${id}`,
  fileAssetIdFromUrl: vi.fn(),
}))
vi.mock('capacitor-blob-writer', () => ({ default: vi.fn() }))
vi.mock('@zip.js/zip.js', () => ({
  BlobReader: vi.fn(),
  BlobWriter: vi.fn(),
  TextWriter: vi.fn(),
  ZipReader: vi.fn(),
}))
vi.mock('../unified-storage', () => ({ localDb: {} }))
vi.mock('../asset-cache.service', () => ({ assetCacheService: {} }))
vi.mock('../deferred-pack-asset.service', () => ({
  deferredLookupKeys: vi.fn(),
  deferredPackAssetService: {},
  learningPackZipPath: vi.fn(),
}))
vi.mock('../learning-content.repository', () => ({ learningContentRepository: {} }))
vi.mock('../sha256-worker.service', () => ({ digestBuffer: vi.fn() }))
vi.mock('../installed-pack-media', () => ({ invalidateInstalledPackMediaCache: vi.fn() }))
vi.mock('../learning-pack-install-perf', () => ({ PackInstallPerfSession: { begin: vi.fn() } }))
vi.mock('../offline-logger', () => ({ createOfflineLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }))

describe('shouldSkipWebVocabularyAudio', () => {
  beforeEach(() => {
    native.value = false
    vi.resetModules()
  })

  it('skips pronunciation and example audio roles on web', async () => {
    const { shouldSkipWebVocabularyAudio } = await import('../learning-pack.service')
    expect(shouldSkipWebVocabularyAudio({ role: 'vocabulary_pronunciation_us' })).toBe(true)
    expect(shouldSkipWebVocabularyAudio({ role: 'vocabulary_pronunciation_uk' })).toBe(true)
    expect(shouldSkipWebVocabularyAudio({ role: 'vocabulary_example_audio' })).toBe(true)
    expect(shouldSkipWebVocabularyAudio({ role: 'background' })).toBe(false)
  })

  it('skips packaged path prefixes on web', async () => {
    const { shouldSkipWebVocabularyAudio } = await import('../learning-pack.service')
    expect(shouldSkipWebVocabularyAudio(null, 'assets/vocabulary_example_audio/abc.mp3')).toBe(true)
    expect(shouldSkipWebVocabularyAudio(null, 'assets/vocabulary_pronunciation_us/abc.mp3')).toBe(true)
    expect(shouldSkipWebVocabularyAudio(null, 'assets/backgrounds/bg.jpg')).toBe(false)
  })

  it('never skips on native', async () => {
    native.value = true
    const { shouldSkipWebVocabularyAudio } = await import('../learning-pack.service')
    expect(shouldSkipWebVocabularyAudio({ role: 'vocabulary_example_audio' })).toBe(false)
    expect(shouldSkipWebVocabularyAudio({ role: 'vocabulary_pronunciation_us' })).toBe(false)
  })
})

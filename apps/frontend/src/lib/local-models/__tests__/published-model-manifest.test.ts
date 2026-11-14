import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/request', () => ({ get: state.get }))
import { getPublishedModel } from '../published-models'
const manifest = () => ({ id: 'release', version: 'v1', modelId: 'Xenova/test', variantId: 'q8', dtype: 'q8', totalBytes: 10,
  files: [{ path: 'config.json', assetId: 'asset', size: 10, sha256: 'a'.repeat(64), url: 'https://resources.example/config.json' }] })
beforeEach(() => state.get.mockReset())
it('loads the published manifest from the application backend', async () => {
  state.get.mockResolvedValue(manifest())
  expect((await getPublishedModel('q8', 'Xenova/test', ['config.json'])).id).toBe('release')
  expect(state.get).toHaveBeenCalledWith('/offline-models/q8/manifest', undefined, { failureCooldownMs: 0 })
})
it('rejects a manifest for a different model or repeated file paths', async () => {
  state.get.mockResolvedValue({ ...manifest(), modelId: 'other' })
  await expect(getPublishedModel('q8', 'Xenova/test', ['config.json'])).rejects.toThrow('不一致')
  const repeated = manifest(); repeated.files.push(repeated.files[0]); state.get.mockResolvedValue(repeated)
  await expect(getPublishedModel('q8', 'Xenova/test', ['config.json'])).rejects.toThrow('不一致')
})
it('rejects absent checksums and mismatched total byte counts', async () => {
  const missing = manifest(); missing.files[0].sha256 = ''; state.get.mockResolvedValue(missing)
  await expect(getPublishedModel('q8', 'Xenova/test', ['config.json'])).rejects.toThrow('校验信息')
  state.get.mockResolvedValue({ ...manifest(), totalBytes: 11 })
  await expect(getPublishedModel('q8', 'Xenova/test', ['config.json'])).rejects.toThrow('大小不一致')
})

import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { modelDownloadProgress } from '../published-models'
import { modelPreset, validateModelContents, validateResourceManifest } from '../../../../../backend/src/modules/offline-models/offline-model-catalog'
import { writeModelArchive } from '../../../../../backend/src/modules/offline-models/model-archive'
const server = new URL('../../../../../backend/src/modules/offline-models/offline-models.service.ts', import.meta.url).href
const { OfflineModelsService } = await import(/* @vite-ignore */ server)
const requireBackend = createRequire(new URL('../../../../../backend/package.json', import.meta.url))
const AdmZip = requireBackend('adm-zip')
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const fileManifest = modelPreset('q8').files.map(path => ({ path, assetId: path, size: 2000000, sha256: 'a'.repeat(64) }))
function fixture(overrides: any = {}) {
  const version: any = { id: 'version', variantId: 'q8', version: 'v1', modelId: 'Xenova/all-MiniLM-L6-v2', purpose: 'embedding', dtype: 'q8',
    sourceRevision: 'main', status: 'ready', isPublished: false, files: fileManifest, bundleAssetId: 'bundle', deviceValidation: 'unverified', taskId: 'task', createdById: 'admin', ...overrides }
  const task: any = { id: 'task', status: 'queued' }
  const stored = new Map(fileManifest.map(file => [file.assetId, { id: file.assetId, sha256: file.sha256, size: file.size }]))
  stored.set('bundle', { id: 'bundle', sha256: 'b'.repeat(64), size: 50 })
  const assets: any = { getAssetReference: (id: string) => `asset://${id}`, getPrivateUrlByAssetId: vi.fn(async () => ({ url: 'https://storage.example/model.zip' })),
    createSystemReference: vi.fn(async () => {}), syncPersistentAssetReferences: vi.fn(async () => {}),
    createAssetFromPath: vi.fn(async ({ path, filename }: any) => { const bytes = await readFile(path); const sha256 = createHash('sha256').update(bytes).digest('hex'); const asset = { id: filename, size: bytes.length, sha256 }; stored.set(asset.id, asset); return asset }),
  }
  const prisma: any = {
    offlineModelVersion: {
      findUnique: vi.fn(async () => version), findFirst: vi.fn(async () => version.isPublished ? version : null),
      update: vi.fn(async ({ data }) => Object.assign(version, data)),
      updateMany: vi.fn(async ({ where, data }) => { if (where.taskId && where.taskId !== version.taskId) return { count: 0 }; Object.assign(version, data); return { count: 1 } }),
      delete: vi.fn(async () => version),
    },
    fileAsset: { findMany: vi.fn(async ({ where }) => where.id.in.map(id => stored.get(id)).filter(Boolean)), findUnique: vi.fn(async ({ where }) => stored.get(where.id) ?? null) },
    fileReference: { deleteMany: vi.fn(async () => {}) },
    adminTask: {
      findUnique: vi.fn(async () => task), update: vi.fn(async ({ data }) => Object.assign(task, data)),
      updateMany: vi.fn(async ({ where, data }) => { if (where.status === 'running' && task.status !== 'running' || task.status === 'canceled') return { count: 0 }; Object.assign(task, data); return { count: 1 } }),
    }, adminTaskLog: { create: vi.fn(async () => {}) },
  }
  prisma.$transaction = async (work: any) => typeof work === 'function' ? work(prisma) : Promise.all(work)
  return { version, task, prisma, assets, stored, service: new OfflineModelsService(prisma, assets, {} as any) }
}

it('requires complete unique checksummed model resources and validates architecture', () => {
  expect(() => validateResourceManifest(modelPreset('q8'), fileManifest)).not.toThrow()
  expect(() => validateResourceManifest(modelPreset('q8'), fileManifest.slice(1))).toThrow('不完整')
  expect(() => validateResourceManifest(modelPreset('q8'), [...fileManifest.slice(1), fileManifest[1]])).toThrow('重复')
  expect(() => validateModelContents('config.json', Buffer.from('{"model_type":"bert"}'), 'stt')).toThrow('用途不一致')
  expect(() => modelPreset('../unknown')).toThrow('不支持')
})
it('publishes only ready versions whose resources still match checksums', async () => {
  const { service, prisma } = fixture()
  const result = await service.publish('version')
  expect(result.isPublished).toBe(true)
  expect(prisma.offlineModelVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { variantId: 'q8', isPublished: true }, data: { isPublished: false } }))
  const broken = fixture(); broken.stored.delete('config.json')
  await expect(broken.service.publish('version')).rejects.toThrow('资源缺失')
  await expect(fixture({ deviceValidation: 'failed' }).service.publish('version')).rejects.toThrow('真机验证失败')
})
it('provides only the explicitly published release and asset references to the App', async () => {
  await expect(fixture().service.manifest('q8')).rejects.toThrow('尚未发布')
  const { service } = fixture({ isPublished: true })
  const manifest = await service.manifest('q8')
  expect(manifest.files.every(file => file.url.startsWith('asset://'))).toBe(true)
  expect(JSON.stringify(manifest)).not.toContain('huggingface')
})
it('protects published and active versions from deletion', async () => {
  await expect(fixture({ isPublished: true }).service.remove('version')).rejects.toThrow('先下架')
  await expect(fixture({ status: 'downloading' }).service.remove('version')).rejects.toThrow('取消任务')
  const { service, prisma } = fixture()
  await service.remove('version')
  expect(prisma.fileReference.deleteMany).toHaveBeenCalledWith({ where: { bizType: 'offline_model_version', bizId: 'version' } })
})
it('does not download a canceled task', async () => {
  const { service, task } = fixture({ status: 'queued' }); task.status = 'canceled'
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  await service.run('task', 'version')
  expect(fetch).not.toHaveBeenCalled()
})
it.each(['', 'https://models.example/'])('downloads pinned files and metadata from the configured source (%s)', async endpoint => {
  vi.stubEnv('HF_ENDPOINT', endpoint)
  const origin = endpoint.replace(/\/+$/, '') || 'https://hf-mirror.com'
  const commit = 'c'.repeat(40)
  const files = new Map(modelPreset('q8').files.map(path => [path, path.endsWith('.json') ? Buffer.from('{"model_type":"bert","model":{}}') : Buffer.alloc(1024 * 1024, 7)]))
  const metadata = { sha: commit, siblings: [...files].map(([rfilename, data]) => ({ rfilename, size: data.length, lfs: { size: data.length, sha256: createHash('sha256').update(data).digest('hex') } })) }
  const fetch = vi.fn(async (url: string) => {
    if (url === `${origin}/api/models/Xenova/all-MiniLM-L6-v2/revision/main?blobs=true`) return Response.json(metadata)
    const prefix = `${origin}/Xenova/all-MiniLM-L6-v2/resolve/${commit}/`
    if (url.startsWith(prefix) && files.has(url.slice(prefix.length))) return new Response(new Uint8Array(files.get(url.slice(prefix.length))!))
    throw new Error(`Unexpected model download: ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  const { service, version, task } = fixture({ status: 'queued', files: [], bundleAssetId: null })
  await service.run('task', 'version')
  expect(version.sourceCommit).toBe(commit)
  expect(version.status).toBe('ready'); expect(task.status).toBe('completed')
  expect(fetch).toHaveBeenCalledTimes(files.size + 1)
})
it('imports a complete model bundle, pins files and commits a ready version', async () => {
  const archive = new AdmZip()
  for (const path of modelPreset('q8').files) archive.addFile(`model/${path}`, path.endsWith('.json') ? Buffer.from('{"model_type":"bert","model":{}}') : Buffer.alloc(1024 * 1024, 7))
  const { service, version, task, assets } = fixture({ status: 'queued', files: [], bundleAssetId: null, importAssetId: 'import' })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(archive.toBuffer()))))
  await service.run('task', 'version')
  expect(version.status).toBe('ready'); expect(version.isPublished).toBe(false)
  expect(version.files).toHaveLength(4); expect(task.status).toBe('completed')
  expect(assets.createSystemReference).toHaveBeenCalledTimes(5)
  expect(assets.syncPersistentAssetReferences).toHaveBeenCalled()
})
it('rejects missing model dependencies without marking installation ready', async () => {
  const archive = new AdmZip(); archive.addFile('config.json', Buffer.from('{"model_type":"bert"}'))
  const { service, version, task } = fixture({ status: 'queued', files: [], bundleAssetId: null, importAssetId: 'import' })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(archive.toBuffer()))))
  await expect(service.run('task', 'version')).rejects.toThrow('缺少或重复包含')
  expect(version.status).toBe('failed'); expect(task.status).toBe('failed'); expect(version.isPublished).toBe(false)
})
it('writes interoperable ZIP files without loading model weights as one buffer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'model-archive-test-'))
  try {
    const weights = Buffer.alloc(1024 * 1024 + 3, 9), path = join(directory, 'weights')
    await writeFile(path, weights)
    const archive = join(directory, 'bundle.zip')
    await writeModelArchive(archive, [{ path: 'onnx/model.onnx', diskPath: path }])
    const zip = new AdmZip(archive)
    expect(zip.getEntry('onnx/model.onnx').getData()).toEqual(weights)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
it('counts each downloaded byte once and reports 100% only after installation', () => {
  const callback = vi.fn(), progress = modelDownloadProgress([{ path: 'config.json', size: 10 }, { path: 'model.onnx', size: 90 }], callback)
  progress.report('config.json', 10); progress.report('config.json', 10)
  expect(callback.mock.calls.at(-1)[0].percent).toBe(10)
  progress.report('model.onnx', 90)
  expect(callback.mock.calls.at(-1)[0].percent).toBe(99)
  progress.complete(); expect(callback.mock.calls.at(-1)[0].percent).toBe(100)
})

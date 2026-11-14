import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { sha256 } from '@noble/hashes/sha2.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const newJson = '{"model_type":"bert","model":{"type":"WordPiece"}}'
const goodJson = '{"model_type":"bert","model":{}}'
const weight = 'w'.repeat(2 * 1024 * 1024)
const hex = (value: string) => Array.from(sha256(new TextEncoder().encode(value)), byte => byte.toString(16).padStart(2, '0')).join('')
const state = vi.hoisted(() => ({ files: new Map<string, { data: string; size: number }>(), failWeights: false, badJson: false, newRelease: false, failInstall: false }))
vi.mock('@/lib/native', () => ({ isNative: () => true }))
vi.mock('@capacitor/core', () => ({ Capacitor: { convertFileSrc: (uri: string) => `capacitor://localhost/_capacitor_file_/${uri}` } }))
vi.mock('@capacitor/file-transfer', () => ({ FileTransfer: {
  addListener: vi.fn(async () => ({ remove: vi.fn(async () => {}) })),
  downloadFile: vi.fn(async ({ path }: any) => {
    const data = path.includes('.json') ? state.badJson ? '<html>unavailable</html>' : state.newRelease ? newJson : goodJson : state.failWeights ? '' : weight
    state.files.set(path.replace('file:///', ''), { data, size: data.length })
  }),
} }))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Data: 'DATA' }, Encoding: { UTF8: 'utf8' }, Filesystem: {
  mkdir: vi.fn(async () => {}), getUri: vi.fn(async ({ path }: any) => ({ uri: `file:///${path}` })),
  stat: vi.fn(async ({ path }: any) => { const row = state.files.get(path); if (!row) { if ([...state.files.keys()].some(key => key.startsWith(path + '/'))) return { size: 0, type: 'directory' }; throw new Error('missing file') }; return { size: row.size, type: 'file' } }),
  readFileInChunks: vi.fn(async ({ path }: any, callback: any) => { const row = state.files.get(path); if (!row) throw new Error('missing file'); for (let i = 0; i < row.data.length; i += 1024 * 1024) callback({ data: btoa(row.data.slice(i, i + 1024 * 1024)) }); callback({ data: '' }); return 'callback' }),
  readFile: vi.fn(async ({ path }: any) => { const row = state.files.get(path); if (!row) throw new Error('missing file'); return { data: row.data } }),
  writeFile: vi.fn(async ({ path, data }: any) => { state.files.set(path, { data, size: data.length }) }),
  copy: vi.fn(async ({ from, to }: any) => { const row = state.files.get(from); if (!row) throw new Error('missing file'); state.files.set(to, { ...row }) }),
  rmdir: vi.fn(async ({ path }: any) => { for (const key of [...state.files.keys()]) if (key.startsWith(path + '/')) state.files.delete(key) }),
  rename: vi.fn(async ({ from, to }: any) => {
    if (state.failInstall && from.endsWith('/.install-q8')) throw new Error('install failed')
    if (state.files.has(to) || [...state.files.keys()].some(key => key.startsWith(to + '/'))) throw new Error('destination exists')
    const row = state.files.get(from)
    if (row) { state.files.set(to, row); state.files.delete(from); return }
    const children = [...state.files.entries()].filter(([key]) => key.startsWith(from + '/'))
    if (!children.length) throw new Error('source missing')
    for (const [key, value] of children) { state.files.set(to + key.slice(from.length), value); state.files.delete(key) }
  }), deleteFile: vi.fn(async ({ path }: any) => { state.files.delete(path) }),
} }))
vi.mock('../published-models', async importOriginal => {
  const original = await importOriginal<typeof import('../published-models')>()
  return { ...original, getPublishedModel: async (variantId: string, modelId: string, paths: string[]) => ({
    id: 'release', version: 'v1', variantId, modelId, files: paths.map(path => ({ path, assetId: path,
      size: path.endsWith('.json') ? (state.newRelease ? newJson : goodJson).length : weight.length, sha256: hex(path.endsWith('.json') ? (state.newRelease ? newJson : goodJson) : weight), url: `https://resources.example.com/${path}` })),
  }) }
})
import { warmupModelManager } from '../../local-ai/warmup-model-manager'
import { localSttModelManager } from '../../local-stt/local-stt-model-manager'
import { downloadModelFile } from '../native-model-files'
import { modelFetch } from '../model-fetch'
beforeEach(() => { state.files.clear(); state.failWeights = false; state.badJson = false; state.newRelease = false; state.failInstall = false; vi.clearAllMocks() })

describe('iOS model downloads', () => {
  it('installs every embedding dependency and provides native JSON to the worker', async () => {
    await warmupModelManager.download('q8')
    expect((await warmupModelManager.getStatus('q8')).installed).toBe(true)
    const config = await warmupModelManager.getLoadConfig('q8')
    expect(Object.keys(config!.localJsonFiles!)).toEqual(['config.json', 'tokenizer.json', 'tokenizer_config.json'])
  })
  it('installs all Whisper configuration and both model weights', async () => {
    await localSttModelManager.download('tiny-en-q8')
    const status = await localSttModelManager.getStatus('tiny-en-q8')
    expect(status.health).toBe('ready')
    expect(status.manifestFiles).toHaveLength(7)
  })
  it('rejects error pages without replacing an existing valid config', async () => {
    state.files.set('config.json', { data: '{"old":true}', size: 12 }); state.badJson = true
    await expect(downloadModelFile('https://example.com/config.json', 'config.json', 1000)).rejects.toThrow('无法下载 config.json')
    expect(state.files.get('config.json')?.data).toBe('{"old":true}')
    expect(state.files.has('config.json.part')).toBe(false)
  })
  it('does not publish an installed manifest after an empty weight download', async () => {
    state.failWeights = true
    await expect(warmupModelManager.download('q8')).rejects.toThrow('无法下载 model_quantized.onnx')
    expect((await warmupModelManager.getStatus('q8')).installed).toBe(false)
    expect(state.files.has('ai-models/Xenova/all-MiniLM-L6-v2/manyu-manifest.json')).toBe(false)
  })
  it('supports replacing files when iOS refuses an existing destination', async () => {
    state.files.set('config.json', { data: '{"old":true}', size: 12 })
    await downloadModelFile('https://resources.example/config.json', 'config.json', 1000, { size: goodJson.length, sha256: hex(goodJson) })
    expect(state.files.get('config.json')?.data).toBe(goodJson)
    expect([...state.files.keys()].some(path => /\.(part|previous)$/.test(path))).toBe(false)
  })
  it('serves only the selected model JSON from native storage to the worker', async () => {
    const fallback = vi.fn(async () => new Response('fallback'))
    const fetchModel = modelFetch({ modelId: 'Xenova/test', localModelPath: 'capacitor://localhost/models/', localJsonFiles: { 'config.json': '{"ok":true}' } }, fallback)
    expect(await (await fetchModel('capacitor://localhost/models/Xenova/test/config.json')).json()).toEqual({ ok: true })
    expect(fallback).not.toHaveBeenCalled()
    await fetchModel('https://example.com/config.json')
    expect(fallback).toHaveBeenCalledOnce()
  })
})

it('reuses a complete checksum-matching installation without downloading the files again', async () => {
  await warmupModelManager.download('q8')
  vi.mocked(FileTransfer.downloadFile).mockClear()
  await warmupModelManager.download('q8')
  expect(FileTransfer.downloadFile).not.toHaveBeenCalled()
})
it('rejects a wrong SHA-256 without replacing the previous file', async () => {
  state.files.set('config.json', { data: '{"old":true}', size: 12 })
  await expect(downloadModelFile('https://resources.example/config.json', 'config.json', 1000, { size: goodJson.length, sha256: '0'.repeat(64) }))
    .rejects.toMatchObject({ cause: { message: '模型文件 SHA-256 校验失败' } })
  expect(state.files.get('config.json')?.data).toBe('{"old":true}')
})

it('keeps the complete installed model when a replacement download fails', async () => {
  await warmupModelManager.download('q8')
  const installed = new Map([...state.files.entries()].filter(([key]) => key.startsWith('ai-models/q8/')))
  state.newRelease = true; state.badJson = true
  await expect(warmupModelManager.download('q8')).rejects.toThrow('无法下载 config.json')
  expect(new Map([...state.files.entries()].filter(([key]) => key.startsWith('ai-models/q8/')))).toEqual(installed)
  expect((await warmupModelManager.getStatus('q8')).installed).toBe(true)
  expect([...state.files.keys()].some(key => key.includes('.install-'))).toBe(false)
})
it('rolls back the whole installed model if the directory switch fails', async () => {
  await warmupModelManager.download('q8')
  const installed = new Map([...state.files.entries()].filter(([key]) => key.startsWith('ai-models/q8/')))
  state.newRelease = true; state.failInstall = true
  await expect(warmupModelManager.download('q8')).rejects.toThrow('模型安装未完成')
  expect(new Map([...state.files.entries()].filter(([key]) => key.startsWith('ai-models/q8/')))).toEqual(installed)
  expect((await warmupModelManager.getStatus('q8')).installed).toBe(true)
})
it('recovers a previous directory after an interrupted installation without network', async () => {
  await warmupModelManager.download('q8')
  await Filesystem.rename({ from: 'ai-models/q8', to: 'ai-models/q8.previous', directory: Directory.Data, toDirectory: Directory.Data })
  vi.mocked(FileTransfer.downloadFile).mockClear()
  expect((await warmupModelManager.getStatus('q8')).installed).toBe(true)
  expect(FileTransfer.downloadFile).not.toHaveBeenCalled()
})

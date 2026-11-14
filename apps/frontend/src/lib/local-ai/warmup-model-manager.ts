import { getPublishedModel, modelDownloadProgress } from '@/lib/local-models/published-models'
import { downloadModelFile, ensureModelDirectory, installModelDirectory, recoverModelDirectory, localModelJsonFiles, validateModelFile } from '@/lib/local-models/native-model-files'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { isNative } from '@/lib/native'

export type LocalWarmupModelVariantId = 'q8' | 'fp16' | 'fp32'

export interface LocalWarmupModelVariant {
  id: LocalWarmupModelVariantId
  dtype: 'q8' | 'fp16' | 'fp32'
  modelFile: string
  estimatedBytes: number
}

export interface LocalWarmupModelStatus {
  nativeAvailable: boolean
  installed: boolean
  health: 'unavailable' | 'ready' | 'missing_files' | 'manifest_missing' | 'manifest_mismatch'
  installing: boolean
  modelId: string
  variantId: LocalWarmupModelVariantId
  bytes: number
  expectedBytes: number
  updatedAt?: string
  localModelPath?: string
  storageDirectory?: string
  resourceVersionId?: string
  missingFiles: string[]
  manifestFiles: string[]
}

export interface LocalWarmupModelLoadConfig {
  modelId: string
  dtype: LocalWarmupModelVariant['dtype']
  localModelPath?: string
  allowRemoteModels?: boolean
  localJsonFiles?: Record<string, string>
  modelRevision?: string
}

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
const REVISION = 'main'
const ROOT_DIR = 'ai-models'
const MODEL_DIR = `${ROOT_DIR}/${MODEL_ID}`
const MANIFEST_PATH = `${MODEL_DIR}/manyu-manifest.json`

const SHARED_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json']

type WarmupModelManifest = {
  modelId: string
  revision: string
  variants?: Partial<Record<LocalWarmupModelVariantId, {
    files: string[]
    sizes: Record<string, number>
    resourceVersionId?: string
    updatedAt: string
  }>>
  variantId?: LocalWarmupModelVariantId
  files?: string[]
  updatedAt?: string
}

export const LOCAL_WARMUP_MODEL_VARIANTS: LocalWarmupModelVariant[] = [
  {
    id: 'q8',
    dtype: 'q8',
    modelFile: 'onnx/model_quantized.onnx',
    estimatedBytes: 23 * 1024 * 1024,
  },
  {
    id: 'fp16',
    dtype: 'fp16',
    modelFile: 'onnx/model_fp16.onnx',
    estimatedBytes: 46 * 1024 * 1024,
  },
  {
    id: 'fp32',
    dtype: 'fp32',
    modelFile: 'onnx/model.onnx',
    estimatedBytes: 91 * 1024 * 1024,
  },
]

let installing = false

function isBrowserModelRuntimeAvailable() {
  return typeof window !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof indexedDB !== 'undefined'
}

function variantById(variantId: LocalWarmupModelVariantId) {
  return LOCAL_WARMUP_MODEL_VARIANTS.find((variant) => variant.id === variantId) ?? LOCAL_WARMUP_MODEL_VARIANTS[0]
}

function filesForVariant(variantId: LocalWarmupModelVariantId) {
  return [...SHARED_FILES, variantById(variantId).modelFile]
}



function expectedBytes(variantId: LocalWarmupModelVariantId) {
  const sharedApproxBytes = 650 * 1024
  return variantById(variantId).estimatedBytes + sharedApproxBytes
}

async function safeStat(path: string) {
  try {
    await validateModelFile(path)
    return await Filesystem.stat({ path, directory: Directory.Data })
  } catch {
    return null
  }
}

async function safeReadManifest(path = MANIFEST_PATH) {
  try {
    const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
    const data = typeof result.data === 'string' ? result.data : ''
    return JSON.parse(data) as WarmupModelManifest
  } catch {
    return null
  }
}

function manifestEntry(manifest: WarmupModelManifest | null, variantId: LocalWarmupModelVariantId) {
  const modern = manifest?.variants?.[variantId]
  if (modern) return modern
  if (manifest?.variantId === variantId && manifest.files && manifest.updatedAt) {
    return { files: manifest.files, sizes: {}, updatedAt: manifest.updatedAt }
  }
  return null
}



export const warmupModelManager = {
  variants: LOCAL_WARMUP_MODEL_VARIANTS,
  modelId: MODEL_ID,

  async getStatus(variantId: LocalWarmupModelVariantId): Promise<LocalWarmupModelStatus> {
    if (!isNative()) {
      const browserAvailable = isBrowserModelRuntimeAvailable()
      return {
        nativeAvailable: browserAvailable,
        installed: browserAvailable,
        installing,
        modelId: MODEL_ID,
        variantId,
        bytes: 0,
        expectedBytes: expectedBytes(variantId),
        missingFiles: browserAvailable ? [] : filesForVariant(variantId),
        manifestFiles: [],
        health: browserAvailable ? 'ready' : 'unavailable',
      }
    }

    if (!installing) await recoverModelDirectory(`${ROOT_DIR}/${variantId}`)
    const publishedRoot = `${ROOT_DIR}/${variantId}`
    const publishedDir = `${publishedRoot}/${MODEL_ID}`
    const publishedManifest = await safeReadManifest(`${publishedDir}/manyu-manifest.json`)
    const directory = publishedManifest ? publishedDir : MODEL_DIR
    const localRoot = publishedManifest ? publishedRoot : ROOT_DIR
    const manifest = publishedManifest ?? await safeReadManifest()
    const files = filesForVariant(variantId)
    const stats = await Promise.all(files.map(async (file) => ({ file, stat: await safeStat(`${directory}/${file}`) })))
    const missingFiles = stats.filter((item) => !item.stat || Number(item.stat.size) <= 0).map((item) => item.file)
    const bytes = stats.reduce((sum, item) => sum + Number(item.stat?.size ?? 0), 0)
    const entry = manifestEntry(manifest, variantId)
    const manifestFiles = entry?.files ?? []
    for (const { file, stat } of stats) {
      const expected = (entry as { sizes?: Record<string, number> } | null)?.sizes?.[file]
      if (stat && expected && Number(stat.size) !== expected && !missingFiles.includes(file)) missingFiles.push(file)
    }
    const expectedFiles = filesForVariant(variantId)
    const manifestMatches = Boolean(
      manifest?.modelId === MODEL_ID
      && manifest?.revision === REVISION
      && entry
      && expectedFiles.every((file) => manifestFiles.includes(file)),
    )
    const health: LocalWarmupModelStatus['health'] = missingFiles.length > 0
      ? 'missing_files'
      : !manifest
        ? 'manifest_missing'
        : !manifestMatches
          ? 'manifest_mismatch'
          : 'ready'
    const rootUri = await Filesystem.getUri({ path: localRoot, directory: Directory.Data }).catch(() => null)
    const localModelPath = rootUri?.uri ? `${Capacitor.convertFileSrc(rootUri.uri).replace(/\/$/, '')}/` : undefined

    return {
      nativeAvailable: true,
      installed: health === 'ready',
      health,
      installing,
      modelId: MODEL_ID,
      variantId,
      bytes,
      expectedBytes: expectedBytes(variantId),
      updatedAt: entry?.updatedAt,
      localModelPath,
      storageDirectory: directory,
      resourceVersionId: (entry as { resourceVersionId?: string } | null)?.resourceVersionId,
      missingFiles,
      manifestFiles,
    }
  },

  async getLoadConfig(variantId: LocalWarmupModelVariantId): Promise<LocalWarmupModelLoadConfig | null> {
    const status = await this.getStatus(variantId)
    if (!status.nativeAvailable || !status.installed) return null
    if (isNative() && !status.localModelPath) return null
    return {
      modelId: MODEL_ID,
      dtype: variantById(variantId).dtype,
      localModelPath: status.localModelPath,
      allowRemoteModels: !status.localModelPath,
      modelRevision: status.resourceVersionId ?? status.updatedAt,
      localJsonFiles: isNative() ? await localModelJsonFiles(status.storageDirectory ?? MODEL_DIR, filesForVariant(variantId)) : undefined,
    }
  },

  async download(
    variantId: LocalWarmupModelVariantId,
    onProgress?: (progress: { file: string; loadedBytes: number; totalBytes: number; percent: number }) => void,
  ) {
    if (!isNative()) throw new Error('本地模型下载仅支持 iOS / Android App')
    if (installing) throw new Error('模型正在下载中')

    installing = true
    const files = filesForVariant(variantId)
    const completed = new Map<string, number>()
    let currentFile = files[0]
    let listener: { remove: () => Promise<void> } | null = null

    const staging = `${ROOT_DIR}/.install-${variantId}`
    const installDir = `${staging}/${MODEL_ID}`
    let currentDownloadUrl = ''
    let report: (file: string, loaded: number, total?: number) => void = () => undefined
    let finishProgress: () => void = () => undefined

    try {
      onProgress?.({ file: '连接模型资源库', loadedBytes: 0, totalBytes: 0, percent: 0 })
      const published = await getPublishedModel(variantId, MODEL_ID, files)
      const progress = modelDownloadProgress(published.files, onProgress)
      report = progress.report
      finishProgress = progress.complete
      await ensureModelDirectory(ROOT_DIR)
      await recoverModelDirectory(`${ROOT_DIR}/${variantId}`)
      await Filesystem.rmdir({ path: staging, directory: Directory.Data, recursive: true }).catch(() => undefined)
      await ensureModelDirectory(installDir)
      await ensureModelDirectory(`${installDir}/onnx`)
      listener = await FileTransfer.addListener('progress', (progress) => {
        if (progress.url !== currentDownloadUrl) return
        report(currentFile, progress.bytes, progress.contentLength || variantById(variantId).estimatedBytes)
      })

      const installed = await this.getStatus(variantId)
      for (const file of files) {
        currentFile = file
        const targetPath = `${installDir}/${file}`
        const resource = published.files.find(item => item.path === file)!
        currentDownloadUrl = resource.url
        report(file, 0)
        if (installed.storageDirectory) await Filesystem.copy({ from: `${installed.storageDirectory}/${file}`, to: targetPath, directory: Directory.Data, toDirectory: Directory.Data }).catch(() => undefined)
        const size = await downloadModelFile(resource.url, targetPath, 120_000, resource)
        const stat = { size }
        completed.set(file, Number(stat?.size ?? 0))
        report(file, Number(stat?.size ?? 0), Number(stat?.size ?? 0))
      }

      await Promise.all(files.map(file => validateModelFile(`${installDir}/${file}`)))
      const variants = {
        [variantId]: {
          files,
          sizes: Object.fromEntries(completed.entries()),
          resourceVersionId: published.id,
          hashes: Object.fromEntries(published.files.map(file => [file.path, file.sha256])),
          updatedAt: new Date().toISOString(),
        },
      }
      await Filesystem.writeFile({
        path: `${installDir}/manyu-manifest.json`,
        directory: Directory.Data,
        data: JSON.stringify({
          modelId: MODEL_ID,
          revision: REVISION,
          variants,
        }),
        encoding: Encoding.UTF8,
        recursive: true,
      })
      await installModelDirectory(staging, `${ROOT_DIR}/${variantId}`)
      finishProgress()
    } finally {
      installing = false
      await Filesystem.rmdir({ path: staging, directory: Directory.Data, recursive: true }).catch(() => undefined)
      await listener?.remove().catch(() => undefined)
    }
  },

  async remove() {
    if (!isNative()) return
    await Filesystem.rmdir({ path: ROOT_DIR, directory: Directory.Data, recursive: true }).catch(() => undefined)
  },
}

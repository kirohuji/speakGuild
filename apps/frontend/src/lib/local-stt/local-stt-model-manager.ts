import { getPublishedModel, modelDownloadProgress } from '@/lib/local-models/published-models'
import { downloadModelFile, ensureModelDirectory, installModelDirectory, recoverModelDirectory, localModelJsonFiles, validateModelFile } from '@/lib/local-models/native-model-files'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { isNative } from '@/lib/native'

export type LocalSttModelVariantId = 'tiny-en-q8' | 'base-en-q8' | 'small-en-q8'

export interface LocalSttModelVariant {
  id: LocalSttModelVariantId
  label: string
  modelId: string
  dtype: 'q8' | 'fp32'
  estimatedBytes: number
  files: string[]
}

export interface LocalSttModelStatus {
  nativeAvailable: boolean
  installed: boolean
  health: 'unavailable' | 'ready' | 'missing_files' | 'manifest_missing' | 'manifest_mismatch'
  installing: boolean
  modelId: string
  variantId: LocalSttModelVariantId
  bytes: number
  expectedBytes: number
  updatedAt?: string
  localModelPath?: string
  storageDirectory?: string
  resourceVersionId?: string
  missingFiles: string[]
  manifestFiles: string[]
}

export interface LocalSttModelLoadConfig {
  modelId: string
  dtype: LocalSttModelVariant['dtype']
  localModelPath?: string
  allowRemoteModels?: boolean
  localJsonFiles?: Record<string, string>
  modelRevision?: string
}

type LocalSttModelManifest = {
  modelId: string
  revision: string
  variants?: Partial<Record<LocalSttModelVariantId, {
    files: string[]
    sizes: Record<string, number>
    resourceVersionId?: string
    updatedAt: string
  }>>
}

const REVISION = 'main'
const ROOT_DIR = 'local-stt-models'
const MANIFEST_NAME = 'manyu-manifest.json'

const WHISPER_SHARED_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
]

const WHISPER_Q8_FILES = [
  ...WHISPER_SHARED_FILES,
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
]

export const LOCAL_STT_MODEL_VARIANTS: LocalSttModelVariant[] = [
  {
    id: 'tiny-en-q8',
    label: 'Whisper Tiny EN',
    modelId: 'Xenova/whisper-tiny.en',
    dtype: 'q8',
    estimatedBytes: 45 * 1024 * 1024,
    files: WHISPER_Q8_FILES,
  },
  {
    id: 'base-en-q8',
    label: 'Whisper Base EN',
    modelId: 'Xenova/whisper-base.en',
    dtype: 'q8',
    estimatedBytes: 90 * 1024 * 1024,
    files: WHISPER_Q8_FILES,
  },
  {
    id: 'small-en-q8',
    label: 'Whisper Small EN',
    modelId: 'Xenova/whisper-small.en',
    dtype: 'q8',
    estimatedBytes: 250 * 1024 * 1024,
    files: WHISPER_Q8_FILES,
  },
]

let installing = false

function isBrowserSttRuntimeAvailable() {
  return typeof window !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof indexedDB !== 'undefined'
    && typeof AudioContext !== 'undefined'
}

function variantById(variantId: LocalSttModelVariantId) {
  return LOCAL_STT_MODEL_VARIANTS.find((variant) => variant.id === variantId) ?? LOCAL_STT_MODEL_VARIANTS[0]
}

function modelDir(modelId: string) {
  return `${ROOT_DIR}/${modelId}`
}

function manifestPath(modelId: string) {
  return `${modelDir(modelId)}/${MANIFEST_NAME}`
}



async function safeStat(path: string) {
  try {
    await validateModelFile(path)
    return await Filesystem.stat({ path, directory: Directory.Data })
  } catch {
    return null
  }
}

async function safeReadManifest(modelId: string, path = manifestPath(modelId)) {
  try {
    const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
    const data = typeof result.data === 'string' ? result.data : ''
    return JSON.parse(data) as LocalSttModelManifest
  } catch {
    return null
  }
}

function manifestEntry(manifest: LocalSttModelManifest | null, variantId: LocalSttModelVariantId) {
  return manifest?.variants?.[variantId] ?? null
}



export const localSttModelManager = {
  variants: LOCAL_STT_MODEL_VARIANTS,

  async getStatus(variantId: LocalSttModelVariantId): Promise<LocalSttModelStatus> {
    const variant = variantById(variantId)
    if (!isNative()) {
      const browserAvailable = isBrowserSttRuntimeAvailable()
      return {
        nativeAvailable: browserAvailable,
        installed: browserAvailable,
        installing,
        modelId: variant.modelId,
        variantId,
        bytes: 0,
        expectedBytes: variant.estimatedBytes,
        missingFiles: browserAvailable ? [] : variant.files,
        manifestFiles: [],
        health: browserAvailable ? 'ready' : 'unavailable',
      }
    }

    if (!installing) await recoverModelDirectory(`${ROOT_DIR}/${variantId}`)
    const publishedRoot = `${ROOT_DIR}/${variantId}`
    const publishedDir = `${publishedRoot}/${variant.modelId}`
    const publishedManifest = await safeReadManifest(variant.modelId, `${publishedDir}/${MANIFEST_NAME}`)
    const directory = publishedManifest ? publishedDir : modelDir(variant.modelId)
    const localRoot = publishedManifest ? publishedRoot : ROOT_DIR
    const manifest = publishedManifest ?? await safeReadManifest(variant.modelId)
    const stats = await Promise.all(variant.files.map(async (file) => ({ file, stat: await safeStat(`${directory}/${file}`) })))
    const missingFiles = stats.filter((item) => !item.stat || Number(item.stat.size) <= 0).map((item) => item.file)
    const bytes = stats.reduce((sum, item) => sum + Number(item.stat?.size ?? 0), 0)
    const entry = manifestEntry(manifest, variantId)
    const manifestFiles = entry?.files ?? []
    for (const { file, stat } of stats) {
      const expected = (entry as { sizes?: Record<string, number> } | null)?.sizes?.[file]
      if (stat && expected && Number(stat.size) !== expected && !missingFiles.includes(file)) missingFiles.push(file)
    }
    const manifestMatches = Boolean(
      manifest?.modelId === variant.modelId
      && manifest?.revision === REVISION
      && entry
      && variant.files.every((file) => manifestFiles.includes(file)),
    )
    const health: LocalSttModelStatus['health'] = missingFiles.length > 0
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
      modelId: variant.modelId,
      variantId,
      bytes,
      expectedBytes: variant.estimatedBytes,
      updatedAt: entry?.updatedAt,
      localModelPath,
      storageDirectory: directory,
      resourceVersionId: (entry as { resourceVersionId?: string } | null)?.resourceVersionId,
      missingFiles,
      manifestFiles,
    }
  },

  async getLoadConfig(variantId: LocalSttModelVariantId): Promise<LocalSttModelLoadConfig | null> {
    const variant = variantById(variantId)
    const status = await this.getStatus(variantId)
    if (!status.nativeAvailable || !status.installed) return null
    if (isNative() && !status.localModelPath) return null
    return {
      modelId: variant.modelId,
      dtype: variant.dtype,
      localModelPath: status.localModelPath,
      allowRemoteModels: !status.localModelPath,
      modelRevision: status.resourceVersionId ?? status.updatedAt,
      localJsonFiles: isNative() ? await localModelJsonFiles(status.storageDirectory ?? modelDir(variant.modelId), variant.files) : undefined,
    }
  },

  async download(
    variantId: LocalSttModelVariantId,
    onProgress?: (progress: { file: string; loadedBytes: number; totalBytes: number; percent: number }) => void,
  ) {
    if (!isNative()) throw new Error('本地 STT 模型下载仅支持 iOS / Android App')
    if (installing) throw new Error('本地 STT 模型正在下载中')

    installing = true
    const variant = variantById(variantId)
    const completed = new Map<string, number>()
    let currentFile = variant.files[0]
    let listener: { remove: () => Promise<void> } | null = null

    const staging = `${ROOT_DIR}/.install-${variantId}`
    const installDir = `${staging}/${variant.modelId}`
    let currentDownloadUrl = ''
    let report: (file: string, loaded: number, total?: number) => void = () => undefined
    let finishProgress: () => void = () => undefined

    try {
      onProgress?.({ file: '连接模型资源库', loadedBytes: 0, totalBytes: 0, percent: 0 })
      const published = await getPublishedModel(variantId, variant.modelId, variant.files)
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
        report(currentFile, progress.bytes, progress.contentLength || variant.estimatedBytes)
      })

      const installed = await this.getStatus(variantId)
      for (const file of variant.files) {
        currentFile = file
        const targetPath = `${installDir}/${file}`
        const resource = published.files.find(item => item.path === file)!
        currentDownloadUrl = resource.url
        report(file, 0)
        if (installed.storageDirectory) await Filesystem.copy({ from: `${installed.storageDirectory}/${file}`, to: targetPath, directory: Directory.Data, toDirectory: Directory.Data }).catch(() => undefined)
        const size = await downloadModelFile(resource.url, targetPath, 180_000, resource)
        const stat = { size }
        completed.set(file, Number(stat?.size ?? 0))
        report(file, Number(stat?.size ?? 0), Number(stat?.size ?? 0))
      }

      await Promise.all(variant.files.map(file => validateModelFile(`${installDir}/${file}`)))
      const variants = {
        [variantId]: {
          files: variant.files,
          sizes: Object.fromEntries(completed.entries()),
          resourceVersionId: published.id,
          hashes: Object.fromEntries(published.files.map(file => [file.path, file.sha256])),
          updatedAt: new Date().toISOString(),
        },
      }
      await Filesystem.writeFile({
        path: `${installDir}/manyu-manifest.json`,
        directory: Directory.Data,
        data: JSON.stringify({ modelId: variant.modelId, revision: REVISION, variants }),
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

  async remove(variantId?: LocalSttModelVariantId) {
    if (!isNative()) return
    if (variantId) {
      await Filesystem.rmdir({ path: `${ROOT_DIR}/${variantId}.previous`, directory: Directory.Data, recursive: true }).catch(() => undefined)
      await Filesystem.rmdir({ path: `${ROOT_DIR}/${variantId}`, directory: Directory.Data, recursive: true }).catch(() => undefined)
      await Filesystem.rmdir({ path: modelDir(variantById(variantId).modelId), directory: Directory.Data, recursive: true }).catch(() => undefined)
      return
    }
    await Filesystem.rmdir({ path: ROOT_DIR, directory: Directory.Data, recursive: true }).catch(() => undefined)
  },
}

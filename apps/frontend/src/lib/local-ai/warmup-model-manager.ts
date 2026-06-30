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
  missingFiles: string[]
  manifestFiles: string[]
}

export interface LocalWarmupModelLoadConfig {
  modelId: string
  dtype: LocalWarmupModelVariant['dtype']
  localModelPath?: string
  allowRemoteModels?: boolean
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

function remoteUrl(file: string) {
  return `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${file}`
}

function expectedBytes(variantId: LocalWarmupModelVariantId) {
  const sharedApproxBytes = 650 * 1024
  return variantById(variantId).estimatedBytes + sharedApproxBytes
}

async function safeStat(path: string) {
  try {
    return await Filesystem.stat({ path, directory: Directory.Data })
  } catch {
    return null
  }
}

async function safeReadManifest() {
  try {
    const result = await Filesystem.readFile({ path: MANIFEST_PATH, directory: Directory.Data, encoding: Encoding.UTF8 })
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

async function ensureModelDirectories() {
  await Filesystem.mkdir({ path: MODEL_DIR, directory: Directory.Data, recursive: true }).catch(() => undefined)
  await Filesystem.mkdir({ path: `${MODEL_DIR}/onnx`, directory: Directory.Data, recursive: true }).catch(() => undefined)
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

    const files = filesForVariant(variantId)
    const stats = await Promise.all(files.map(async (file) => ({ file, stat: await safeStat(`${MODEL_DIR}/${file}`) })))
    const missingFiles = stats.filter((item) => !item.stat).map((item) => item.file)
    const bytes = stats.reduce((sum, item) => sum + Number(item.stat?.size ?? 0), 0)
    const manifest = await safeReadManifest()
    const entry = manifestEntry(manifest, variantId)
    const manifestFiles = entry?.files ?? []
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
    const rootUri = await Filesystem.getUri({ path: ROOT_DIR, directory: Directory.Data }).catch(() => null)
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

    const report = (file: string, loaded: number, total: number) => {
      const completedBytes = Array.from(completed.values()).reduce((sum, value) => sum + value, 0)
      const totalBytes = Math.max(expectedBytes(variantId), completedBytes + total)
      const loadedBytes = Math.min(totalBytes, completedBytes + loaded)
      onProgress?.({
        file,
        loadedBytes,
        totalBytes,
        percent: totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0,
      })
    }

    try {
      await ensureModelDirectories()
      listener = await FileTransfer.addListener('progress', (progress) => {
        if (!progress.url.includes(MODEL_ID)) return
        report(currentFile, progress.bytes, progress.contentLength || variantById(variantId).estimatedBytes)
      })

      for (const file of files) {
        currentFile = file
        const targetPath = `${MODEL_DIR}/${file}`
        const targetUri = await Filesystem.getUri({ path: targetPath, directory: Directory.Data })
        await FileTransfer.downloadFile({
          url: remoteUrl(file),
          path: targetUri.uri,
          progress: true,
          readTimeout: 120_000,
          connectTimeout: 60_000,
        })
        const stat = await safeStat(targetPath)
        completed.set(file, Number(stat?.size ?? 0))
        report(file, Number(stat?.size ?? 0), Number(stat?.size ?? 0))
      }

      const previousManifest = await safeReadManifest()
      const variants = {
        ...(previousManifest?.modelId === MODEL_ID && previousManifest.revision === REVISION ? previousManifest.variants : {}),
        [variantId]: {
          files,
          sizes: Object.fromEntries(completed.entries()),
          updatedAt: new Date().toISOString(),
        },
      }
      await Filesystem.writeFile({
        path: MANIFEST_PATH,
        directory: Directory.Data,
        data: JSON.stringify({
          modelId: MODEL_ID,
          revision: REVISION,
          variants,
        }),
        encoding: Encoding.UTF8,
        recursive: true,
      })
    } finally {
      installing = false
      await listener?.remove().catch(() => undefined)
    }
  },

  async remove() {
    if (!isNative()) return
    await Filesystem.rmdir({ path: MODEL_DIR, directory: Directory.Data, recursive: true }).catch(() => undefined)
  },
}

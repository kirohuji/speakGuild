import { nativeModelSha256 } from './native-model-hash'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'

export async function ensureModelDirectory(path: string): Promise<void> {
  try { await Filesystem.mkdir({ path, directory: Directory.Data, recursive: true }) }
  catch (error) {
    const stat = await Filesystem.stat({ path, directory: Directory.Data }).catch(() => null)
    if (stat?.type !== 'directory') throw error
  }
}

export async function readModelJson(path: string): Promise<string> {
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
  if (typeof data !== 'string') throw new Error(`模型配置无法读取：${path.split('/').at(-1)}`)
  const value = JSON.parse(data)
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.error) throw new Error('模型配置格式不正确')
  return data
}

export async function validateModelFile(path: string, expectedSize?: number): Promise<number> {
  const stat = await Filesystem.stat({ path, directory: Directory.Data })
  const size = Number(stat.size)
  if (!(size > 0) || (expectedSize && size !== expectedSize)) throw new Error('模型文件不完整')
  if (path.endsWith('.json')) await readModelJson(path)
  else if (path.endsWith('.onnx') && size < 1024 * 1024) throw new Error('模型权重文件不完整')
  return size
}

/** Install only a validated temporary file; a failed retry keeps the previous installation. */
export async function downloadModelFile(url: string, path: string, readTimeout: number, expected?: { size: number; sha256: string }): Promise<number> {
  const temporary = `${path}.part`
  try {
    if (expected) {
      const current = await Filesystem.stat({ path, directory: Directory.Data }).catch(() => null)
      if (current?.size === expected.size && await nativeModelSha256(path).catch(() => '') === expected.sha256) {
        await validateModelFile(path, expected.size)
        return expected.size
      }
    }
    // Preserve the original bytes for SHA-256, including JSON whitespace.
    const target = await Filesystem.getUri({ path: temporary, directory: Directory.Data })
    await FileTransfer.downloadFile({ url, path: target.uri, progress: true, readTimeout, connectTimeout: 30_000 })
    if (path.endsWith('.json')) await readModelJson(temporary)
    const stat = await Filesystem.stat({ path: temporary, directory: Directory.Data })
    const size = Number(stat.size)
    if (!(size > 0) || (expected && size !== expected.size) || (path.endsWith('.onnx') && size < 1024 * 1024)) throw new Error('下载的模型文件不完整，请重试')
    if (expected && await nativeModelSha256(temporary) !== expected.sha256) throw new Error('模型文件 SHA-256 校验失败')
    const move = (from: string, to: string) => Filesystem.rename({ from, to, directory: Directory.Data, toDirectory: Directory.Data })
    try { await move(temporary, path) }
    catch (error) {
      // iOS filesystem implementations may reject replacing an existing destination.
      if (!(await Filesystem.stat({ path, directory: Directory.Data }).catch(() => null))) throw error
      const backup = `${path}.previous`
      await Filesystem.deleteFile({ path: backup, directory: Directory.Data }).catch(() => undefined)
      await move(path, backup)
      try { await move(temporary, path) }
      catch (replacementError) { await move(backup, path); throw replacementError }
      await Filesystem.deleteFile({ path: backup, directory: Directory.Data }).catch(() => undefined)
    }
    return size
  } catch (error) {
    throw new Error(`无法下载 ${path.split('/').at(-1)}，请检查网络和可用存储空间后重试`, { cause: error })
  } finally {
    await Filesystem.deleteFile({ path: temporary, directory: Directory.Data }).catch(() => undefined)
  }
}

export async function localModelJsonFiles(modelDir: string, files: string[]): Promise<Record<string, string>> {
  const values = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => [file, await readModelJson(`${modelDir}/${file}`)] as const))
  return Object.fromEntries(values)
}

export async function recoverModelDirectory(destination: string) {
  const current = await Filesystem.stat({ path: destination, directory: Directory.Data }).catch(() => null)
  const backup = await Filesystem.stat({ path: `${destination}.previous`, directory: Directory.Data }).catch(() => null)
  if (!current && backup) await Filesystem.rename({ from: `${destination}.previous`, to: destination, directory: Directory.Data, toDirectory: Directory.Data })
}

/** Commit a complete model tree in one rename; roll back to the previous tree on failure. */
export async function installModelDirectory(staging: string, destination: string) {
  const backup = `${destination}.previous`
  await recoverModelDirectory(destination)
  const existing = await Filesystem.stat({ path: destination, directory: Directory.Data }).catch(() => null)
  const move = (from: string, to: string) => Filesystem.rename({ from, to, directory: Directory.Data, toDirectory: Directory.Data })
  await Filesystem.rmdir({ path: backup, directory: Directory.Data, recursive: true }).catch(() => undefined)
  if (existing) await move(destination, backup)
  try { await move(staging, destination) }
  catch (error) { if (existing) await move(backup, destination); throw new Error('模型安装未完成，请重试', { cause: error }) }
  await Filesystem.rmdir({ path: backup, directory: Directory.Data, recursive: true }).catch(() => undefined)
}

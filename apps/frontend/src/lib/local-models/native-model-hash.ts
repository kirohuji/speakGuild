import { Directory, Filesystem } from '@capacitor/filesystem'
import { sha256 } from '@noble/hashes/sha2.js'
/** Stream native files through SHA-256 without loading hundreds of MB into the WebView. */
export function nativeModelSha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = sha256.create()
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      if (error) reject(error)
      else resolve(Array.from(hash.digest(), byte => byte.toString(16).padStart(2, '0')).join(''))
    }
    const timer = setTimeout(() => finish(new Error('模型文件校验超时，请重试')), 180_000)
    Filesystem.readFileInChunks({ path, directory: Directory.Data, chunkSize: 1024 * 1024 }, (chunk, error) => {
      if (settled) return
      if (error) { finish(error); return }
      const data = chunk?.data
      if (data === '' || data == null) { finish(); return }
      if (typeof data !== 'string') { finish(new Error('模型文件分块读取格式不正确')); return }
      try { hash.update(Uint8Array.from(atob(data), char => char.charCodeAt(0))) }
      catch (readError) { finish(readError) }
    }).catch(error => finish(error))
  })
}

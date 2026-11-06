import { digestSync } from './sha256'

type PendingHash = {
  resolve: (digest: string) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let workerUnavailable = false
let nextRequestId = 1
const pending = new Map<number, PendingHash>()

function rejectPending(error: Error) {
  for (const request of pending.values()) request.reject(error)
  pending.clear()
}

function getWorker(): Worker | null {
  if (workerUnavailable || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./sha256.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; digest?: string; error?: string }>) => {
      const request = pending.get(event.data.id)
      if (!request) return
      pending.delete(event.data.id)
      if (event.data.error) request.reject(new Error(event.data.error))
      else request.resolve(event.data.digest ?? '')
    }
    worker.onerror = () => {
      workerUnavailable = true
      worker?.terminate()
      worker = null
      rejectPending(new Error('SHA-256 worker failed'))
    }
    return worker
  } catch {
    workerUnavailable = true
    return null
  }
}

/**
 * Hash outside the WebView main thread without relying on crypto.subtle.
 * The buffer is cloned to the worker so callers can immediately persist it.
 * Installation keeps only a small bounded batch alive, limiting clone overhead.
 */
export async function digestBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashWorker = getWorker()
  if (!hashWorker) {
    if (typeof window !== 'undefined') {
      throw new Error('SHA-256 worker is unavailable; refusing to hash large assets on the UI thread')
    }
    // Node-based tests and SSR only.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    return digestSync(buffer)
  }
  const id = nextRequestId++
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    hashWorker.postMessage({ id, buffer })
  }).catch(async (error) => {
    if (typeof window !== 'undefined') throw error
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    return digestSync(buffer)
  })
}

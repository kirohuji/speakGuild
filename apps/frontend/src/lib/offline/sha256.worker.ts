/// <reference lib="webworker" />
import { digestSync } from './sha256'

type HashRequest = { id: number; buffer: ArrayBuffer }

self.onmessage = (event: MessageEvent<HashRequest>) => {
  const { id, buffer } = event.data
  try {
    self.postMessage({ id, digest: digestSync(buffer) })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}

export {}

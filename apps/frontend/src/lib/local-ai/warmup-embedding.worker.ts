import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = false

type WorkerRequest =
  | { id: number; type: 'preload' }
  | { id: number; type: 'embed'; texts: string[] }

let extractorPromise: Promise<any> | null = null
const embeddingCache = new Map<string, number[]>()

function getExtractor() {
  extractorPromise ??= pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  return extractorPromise
}

async function embed(text: string) {
  const key = text.trim().slice(0, 500)
  const cached = embeddingCache.get(key)
  if (cached) return cached

  const extractor = await getExtractor()
  const output = await extractor(key, { pooling: 'mean', normalize: true })
  const vector = Array.from(output.data as Float32Array)
  embeddingCache.set(key, vector)
  return vector
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  try {
    if (message.type === 'preload') {
      await getExtractor()
      self.postMessage({ id: message.id, ok: true })
      return
    }

    const embeddings = await Promise.all(message.texts.map(embed))
    self.postMessage({ id: message.id, ok: true, embeddings })
  } catch (error: any) {
    self.postMessage({ id: message.id, ok: false, error: error?.message || 'local model failed' })
  }
}

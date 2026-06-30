import { env, pipeline } from '@huggingface/transformers'
import type { LocalWarmupModelLoadConfig } from './warmup-model-manager'

env.allowLocalModels = true
env.allowRemoteModels = false

type WorkerRequest =
  | { id: number; type: 'preload'; config: LocalWarmupModelLoadConfig; references?: WarmupReferenceEmbeddingInput[] }
  | { id: number; type: 'judge-embeddings'; userAnswer: string; reference: WarmupReferenceEmbeddingInput; config: LocalWarmupModelLoadConfig }

type WarmupReferenceEmbeddingInput = {
  key: string
  expectedText: string
  promptText: string
}

let extractorPromise: Promise<any> | null = null
let extractorKey: string | null = null
const embeddingCache = new Map<string, number[]>()
const referenceCache = new Map<string, { expected: number[]; prompt: number[] }>()

function getExtractor(config: LocalWarmupModelLoadConfig) {
  const nextKey = `${config.modelId}:${config.dtype}:${config.localModelPath}`
  if (extractorKey !== nextKey) {
    extractorKey = nextKey
    extractorPromise = null
    embeddingCache.clear()
    referenceCache.clear()
    env.localModelPath = config.localModelPath
  }

  extractorPromise ??= pipeline('feature-extraction', config.modelId, {
    dtype: config.dtype,
    local_files_only: true,
  })
  return extractorPromise
}

async function embed(text: string, config: LocalWarmupModelLoadConfig) {
  const key = text.trim().slice(0, 500)
  const cached = embeddingCache.get(key)
  if (cached) return cached

  const extractor = await getExtractor(config)
  const output = await extractor(key, { pooling: 'mean', normalize: true })
  const vector = Array.from(output.data as Float32Array)
  embeddingCache.set(key, vector)
  return vector
}

async function embedReference(reference: WarmupReferenceEmbeddingInput, config: LocalWarmupModelLoadConfig) {
  const cached = referenceCache.get(reference.key)
  if (cached) return cached

  const [expected, prompt] = await Promise.all([
    embed(reference.expectedText, config),
    embed(reference.promptText, config),
  ])
  const value = { expected, prompt }
  referenceCache.set(reference.key, value)
  return value
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  try {
    if (message.type === 'preload') {
      await getExtractor(message.config)
      if (message.references?.length) {
        await Promise.all(message.references.map((reference) => embedReference(reference, message.config)))
      }
      self.postMessage({ id: message.id, ok: true })
      return
    }

    const [userEmbedding, reference] = await Promise.all([
      embed(message.userAnswer, message.config),
      embedReference(message.reference, message.config),
    ])
    self.postMessage({ id: message.id, ok: true, embeddings: [userEmbedding, reference.expected, reference.prompt] })
  } catch (error: any) {
    self.postMessage({ id: message.id, ok: false, error: error?.message || 'local model failed' })
  }
}

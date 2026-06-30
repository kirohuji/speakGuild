import { env, pipeline } from '@huggingface/transformers'
import type { LocalWarmupModelLoadConfig } from './warmup-model-manager'

type WorkerRequest =
  | { id: number; type: 'preload'; config: LocalWarmupModelLoadConfig; references?: WarmupReferenceEmbeddingInput[] }
  | { id: number; type: 'restore'; config: LocalWarmupModelLoadConfig; references: WarmupReferenceEmbeddingRestore[] }
  | { id: number; type: 'judge-embeddings'; userAnswer: string; reference: WarmupReferenceEmbeddingInput; config: LocalWarmupModelLoadConfig }

type WarmupReferenceEmbeddingInput = {
  key: string
  expectedText: string
  promptText: string
}

type WarmupReferenceEmbeddingRestore = {
  key: string
  expected: number[]
  prompt: number[]
}

let extractorPromise: Promise<any> | null = null
let extractorKey: string | null = null
const embeddingCache = new Map<string, number[]>()
const referenceCache = new Map<string, { expected: number[]; prompt: number[] }>()

function getExtractor(config: LocalWarmupModelLoadConfig) {
  const localModelPath = config.localModelPath?.trim()
  const allowRemoteModels = config.allowRemoteModels ?? !localModelPath
  const nextKey = `${config.modelId}:${config.dtype}:${localModelPath ?? ''}:${allowRemoteModels ? 'remote' : 'local'}`
  if (extractorKey !== nextKey) {
    extractorKey = nextKey
    extractorPromise = null
    embeddingCache.clear()
    referenceCache.clear()
    env.allowLocalModels = Boolean(localModelPath)
    env.allowRemoteModels = allowRemoteModels
    if (localModelPath) {
      env.localModelPath = localModelPath
    }
  }

  extractorPromise ??= pipeline('feature-extraction', config.modelId, {
    dtype: config.dtype,
    local_files_only: !allowRemoteModels,
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
    if (message.type === 'restore') {
      await getExtractor(message.config)
      for (const reference of message.references) {
        referenceCache.set(reference.key, {
          expected: reference.expected,
          prompt: reference.prompt,
        })
      }
      self.postMessage({ id: message.id, ok: true })
      return
    }

    if (message.type === 'preload') {
      await getExtractor(message.config)
      const references: WarmupReferenceEmbeddingRestore[] = []
      if (message.references?.length) {
        await Promise.all(message.references.map(async (reference) => {
          const embeddings = await embedReference(reference, message.config)
          references.push({
            key: reference.key,
            expected: embeddings.expected,
            prompt: embeddings.prompt,
          })
        }))
      }
      self.postMessage({ id: message.id, ok: true, references })
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

import { localDb } from '@/lib/offline/unified-storage'

export type WarmupEmbeddingCacheSource = 'today' | 'guided_warmup' | 'unknown'

export interface WarmupEmbeddingCacheEntry {
  id: string
  modelKey: string
  referenceKey: string
  expectedEmbedding: string
  promptEmbedding: string
  dimension: number
  source: WarmupEmbeddingCacheSource
  packId?: string | null
  topicId?: string | null
  createdAt: string
  lastUsedAt: string
}

export interface WarmupEmbeddingCacheInput {
  modelKey: string
  referenceKey: string
  expected: number[]
  prompt: number[]
  source?: WarmupEmbeddingCacheSource
  packId?: string | null
  topicId?: string | null
}

export interface WarmupEmbeddingCacheRestore {
  referenceKey: string
  expected: number[]
  prompt: number[]
}

export interface WarmupEmbeddingCacheStats {
  count: number
  bytes: number
  currentModelCount: number
  currentModelBytes: number
  modelKeys: string[]
  updatedAt?: string
}

function stableHash(value: string) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`
}

function cacheId(modelKey: string, referenceKey: string) {
  return `${stableHash(modelKey)}:${stableHash(referenceKey)}`
}

function numbersToBase64(values: number[]) {
  const bytes = new Uint8Array(new Float32Array(values).buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToNumbers(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return Array.from(new Float32Array(bytes.buffer))
}

function approximateJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return 0
  }
}

export const warmupEmbeddingCacheRepository = {
  cacheId,

  async getForReferences(modelKey: string, referenceKeys: string[]): Promise<WarmupEmbeddingCacheRestore[]> {
    if (!referenceKeys.length) return []
    const wanted = new Set(referenceKeys)
    const rows = await localDb.findByIndex<WarmupEmbeddingCacheEntry>('warmup_embedding_refs', 'model_key', modelKey)
    const matched = rows.filter((row) => wanted.has(row.referenceKey))
    const now = new Date().toISOString()

    void localDb.putMany('warmup_embedding_refs', matched.map((row) => ({
      ...row,
      lastUsedAt: now,
    }))).catch((error) => {
      console.warn('[warmup-embedding-cache] touch failed:', error)
    })

    return matched.map((row) => ({
      referenceKey: row.referenceKey,
      expected: base64ToNumbers(row.expectedEmbedding),
      prompt: base64ToNumbers(row.promptEmbedding),
    }))
  },

  async putMany(values: WarmupEmbeddingCacheInput[]): Promise<void> {
    if (!values.length) return
    const now = new Date().toISOString()
    const rows: WarmupEmbeddingCacheEntry[] = values.map((value) => ({
      id: cacheId(value.modelKey, value.referenceKey),
      modelKey: value.modelKey,
      referenceKey: value.referenceKey,
      expectedEmbedding: numbersToBase64(value.expected),
      promptEmbedding: numbersToBase64(value.prompt),
      dimension: value.expected.length,
      source: value.source ?? 'unknown',
      packId: value.packId ?? null,
      topicId: value.topicId ?? null,
      createdAt: now,
      lastUsedAt: now,
    }))
    await localDb.putMany('warmup_embedding_refs', rows)
  },

  async getStats(currentModelKey?: string): Promise<WarmupEmbeddingCacheStats> {
    const rows = await localDb.list<WarmupEmbeddingCacheEntry>('warmup_embedding_refs')
    const bytes = rows.reduce((sum, row) => sum + approximateJsonBytes(row), 0)
    const currentRows = currentModelKey ? rows.filter((row) => row.modelKey === currentModelKey) : []
    return {
      count: rows.length,
      bytes,
      currentModelCount: currentRows.length,
      currentModelBytes: currentRows.reduce((sum, row) => sum + approximateJsonBytes(row), 0),
      modelKeys: Array.from(new Set(rows.map((row) => row.modelKey))),
      updatedAt: rows[0]?.lastUsedAt ?? rows[0]?.createdAt,
    }
  },

  async clear(modelKey?: string): Promise<void> {
    if (!modelKey) {
      await localDb.clear('warmup_embedding_refs')
      return
    }
    await localDb.deleteWhere<WarmupEmbeddingCacheEntry>('warmup_embedding_refs', (row) => row.modelKey === modelKey)
  },
}

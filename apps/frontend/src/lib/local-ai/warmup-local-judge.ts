import { targetIsUsed, meaningConflict } from './warmup-answer-rules'
import type { DrillDirection } from '@/features/practice/api/english-practice-api'
import { usePreferencesStore } from '@/stores/preferences.store'
import { warmupModelManager, type LocalWarmupModelLoadConfig } from './warmup-model-manager'
import {
  warmupEmbeddingCacheRepository,
  type WarmupEmbeddingCacheSource,
} from './warmup-embedding-cache.repository'

export type WarmupJudgeScore = 'strong' | 'ok' | 'weak' | 'miss'

export interface WarmupTurnJudgeInput {
  stepType: 'chunk_substitution' | 'vocab_drill' | 'vocab_sentence_building' | 'pattern_drill' | 'sentence_decomposition'
  direction?: DrillDirection
  prompt: string
  expectedAnswer?: string
  userAnswer: string
  targetText?: string
  requiredWords?: string[]
  targetMeaning?: string
}

export interface WarmupTurnJudgeOutput {
  passed: boolean
  score: WarmupJudgeScore
  feedback: string
  correction?: string | null
}

export interface WarmupReferencePreloadInput {
  stepType: WarmupTurnJudgeInput['stepType']
  direction?: DrillDirection
  prompt: string
  expectedAnswer?: string
}

export interface WarmupReferencePreloadOptions {
  source?: WarmupEmbeddingCacheSource
  packId?: string | null
  topicId?: string | null
}

export interface WarmupLocalJudgePreloadResult {
  restoredCount: number
  computedCount: number
}

interface LocalJudgeOutput extends WarmupTurnJudgeOutput {
  confidence: number
  fallback: boolean
}

type WorkerResponse = {
  id: number
  ok: boolean
  embeddings?: number[][]
  references?: WarmupReferenceEmbeddingRestore[]
  error?: string
}

type WorkerMessage = Omit<{
  id: number
  type: 'preload' | 'restore' | 'judge-embeddings'
  references?: WarmupReferenceEmbeddingInput[] | WarmupReferenceEmbeddingRestore[]
  reference?: WarmupReferenceEmbeddingInput
  userAnswer?: string
  config: LocalWarmupModelLoadConfig
}, 'id'>

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

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void; timeoutId: number }>()

function getWorker() {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  worker = new Worker(new URL('./warmup-embedding.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const request = pending.get(response.id)
    if (!request) return
    clearTimeout(request.timeoutId)
    pending.delete(response.id)
    request.resolve(response)
  }
  worker.onerror = (event) => {
    for (const [id, request] of pending) {
      clearTimeout(request.timeoutId)
      request.reject(new Error(event.message || 'local model worker failed'))
      pending.delete(id)
    }
  }
  return worker
}

function requestWorker(message: WorkerMessage, timeoutMs = 8_000) {
  const activeWorker = getWorker()
  if (!activeWorker) return Promise.reject(new Error('worker unavailable'))

  const id = ++requestId
  return new Promise<WorkerResponse>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('local model timeout'))
    }, timeoutMs)
    pending.set(id, { resolve, reject, timeoutId })
    activeWorker.postMessage({ id, ...message })
  })
}

function normalizeReferenceText(value?: string) {
  return (value ?? '').trim().slice(0, 500)
}

function referenceKey(input: WarmupReferencePreloadInput) {
  return [
    input.stepType,
    input.direction ?? '',
    normalizeReferenceText(input.prompt),
    normalizeReferenceText(input.expectedAnswer),
  ].join('|')
}

function modelKey(config: LocalWarmupModelLoadConfig) {
  const localModelPath = config.localModelPath?.trim()
  const allowRemoteModels = config.allowRemoteModels ?? !localModelPath
  return `${config.modelId}:${config.dtype}:${config.modelRevision ?? ''}:${localModelPath ?? ''}:${allowRemoteModels ? 'remote' : 'local'}`
}

export async function getCurrentWarmupLocalJudgeModelKey() {
  const variantId = usePreferencesStore.getState().localAiWarmupModelVariant
  const config = await warmupModelManager.getLoadConfig(variantId)
  return config ? modelKey(config) : null
}

function makeReference(input: WarmupReferencePreloadInput): WarmupReferenceEmbeddingInput {
  const promptText = normalizeReferenceText(input.prompt)
  return {
    key: referenceKey(input),
    expectedText: normalizeReferenceText(input.expectedAnswer) || promptText,
    promptText,
  }
}

export function preloadWarmupLocalJudge(
  references: WarmupReferencePreloadInput[] = [],
  options: WarmupReferencePreloadOptions = {},
) {
  const variantId = usePreferencesStore.getState().localAiWarmupModelVariant
  return warmupModelManager.getLoadConfig(variantId).then(async (config) => {
    if (!config) return { restoredCount: 0, computedCount: 0 }
    const dedupedReferences = Array.from(
      new Map(references.map((reference) => {
        const prepared = makeReference(reference)
        return [prepared.key, prepared]
      })).values(),
    )
    const activeModelKey = modelKey(config)
    const cachedReferences = await warmupEmbeddingCacheRepository
      .getForReferences(activeModelKey, dedupedReferences.map((reference) => reference.key))
      .catch((error) => {
        console.warn('[warmup-embedding-cache] restore lookup failed:', error)
        return []
      })

    if (cachedReferences.length > 0) {
      const restoreResponse = await requestWorker({
        type: 'restore',
        config,
        references: cachedReferences.map((reference) => ({
          key: reference.referenceKey,
          expected: reference.expected,
          prompt: reference.prompt,
        })),
      }, 30_000)
      if (!restoreResponse.ok) throw new Error(restoreResponse.error || 'local model cache restore failed')
    }

    const cachedKeys = new Set(cachedReferences.map((reference) => reference.referenceKey))
    const missingReferences = dedupedReferences.filter((reference) => !cachedKeys.has(reference.key))
    if (missingReferences.length === 0) {
      return { restoredCount: cachedReferences.length, computedCount: 0 }
    }

    const response = await requestWorker({ type: 'preload', config, references: missingReferences }, 30_000)
    if (!response.ok) throw new Error(response.error || 'local model preload failed')
    if (response.references?.length) {
      void warmupEmbeddingCacheRepository.putMany(response.references.map((reference) => ({
        modelKey: activeModelKey,
        referenceKey: reference.key,
        expected: reference.expected,
        prompt: reference.prompt,
        source: options.source ?? 'unknown',
        packId: options.packId,
        topicId: options.topicId,
      }))).catch((error) => {
        console.warn('[warmup-embedding-cache] persist failed:', error)
      })
    }
    return {
      restoredCount: cachedReferences.length,
      computedCount: response.references?.length ?? missingReferences.length,
    }
  })
}

function expandEnglishContractions(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\byou're\b/g, 'you are')
    .replace(/\bwe're\b/g, 'we are')
    .replace(/\bthey're\b/g, 'they are')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not')
    .replace(/\b([a-z]+)'ll\b/g, '$1 will')
    .replace(/\b([a-z]+)'ve\b/g, '$1 have')
    .replace(/\b([a-z]+)'re\b/g, '$1 are')
    .replace(/\b([a-z]+)'m\b/g, '$1 am')
}

function normalizeText(value: string) {
  return expandEnglishContractions(value)
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cosine(a: number[], b: number[]) {
  let dot = 0
  let aNorm = 0
  let bNorm = 0
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i]
    aNorm += a[i] * a[i]
    bNorm += b[i] * b[i]
  }
  if (!aNorm || !bNorm) return 0
  return dot / Math.sqrt(aNorm * bNorm)
}

function answerMatchesExpected(userAnswer: string, expectedAnswer?: string) {
  // Preserve internal punctuation and symbols: 10% is not 10, $5 is not €5.
  const normalize = (value: string) => expandEnglishContractions(value.normalize('NFKC'))
    .trim().replace(/[.!?。！？]+$/u, '').replace(/\s+/g, ' ').trim()
  const expected = normalize(expectedAnswer ?? '')
  return expected.length > 0 && normalize(userAnswer) === expected
}

function tokenOverlap(a: string, b?: string) {
  const normalizedA = normalizeText(a)
  const normalizedB = normalizeText(b ?? '')
  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
  if (hasCjk.test(normalizedA) || hasCjk.test(normalizedB)) {
    const aChars = new Set(Array.from(normalizedA).filter((char) => hasCjk.test(char)))
    const bChars = Array.from(normalizedB).filter((char) => hasCjk.test(char))
    if (!aChars.size || !bChars.length) return 0
    return bChars.filter((char) => aChars.has(char)).length / bChars.length
  }

  const aTokens = new Set(normalizedA.split(' ').filter((token) => token.length > 1))
  const bTokens = normalizedB.split(' ').filter((token) => token.length > 1)
  if (!aTokens.size || !bTokens.length) return 0
  const matched = bTokens.filter((token) => aTokens.has(token)).length
  return matched / bTokens.length
}

function makeResult(params: {
  score: WarmupJudgeScore
  confidence: number
  targetMatched: boolean
  expectedAnswer?: string
  feedback?: string
}): LocalJudgeOutput {
  const passed = params.score === 'strong' || params.score === 'ok'
  const correction = params.score === 'weak' || params.score === 'miss' ? params.expectedAnswer || null : null
  const feedback = passed
    ? params.score === 'strong'
      ? '表达自然，继续。'
      : '意思到位，可以。'
    : params.targetMatched
      ? '意思还不够准确。'
      : '目标表达还没用上。'

  return {
    passed,
    score: params.score,
    feedback: params.feedback ?? feedback,
    correction,
    confidence: Math.min(params.confidence, 1),
    fallback: false,
  }
}

export function judgeExactWarmupAnswer(input: WarmupTurnJudgeInput): LocalJudgeOutput | null {
  const userAnswer = input.userAnswer.trim()
  if (!userAnswer) {
    return {
      passed: false,
      score: 'miss',
      feedback: '先写一句回答。',
      correction: input.expectedAnswer || null,
      confidence: 1,
      fallback: false,
    }
  }

  const languageMatches = input.direction === 'en_to_zh'
    ? /\p{Script=Han}/u.test(userAnswer)
    : /[a-z]/i.test(userAnswer) && !/\p{Script=Han}/u.test(userAnswer)
  if (languageMatches && answerMatchesExpected(userAnswer, input.expectedAnswer)) {
    return { ...makeResult({ score: 'strong', confidence: 1, targetMatched: true, expectedAnswer: input.expectedAnswer }), fallback: input.direction !== 'en_to_zh' && (!!input.targetText?.trim() || !!input.requiredWords?.length) }
  }

  return null
}

export async function judgeWarmupTurnLocally(input: WarmupTurnJudgeInput): Promise<LocalJudgeOutput> {
  const exact = judgeExactWarmupAnswer(input)
  if (exact) {
    if (!input.userAnswer.trim() || targetIsUsed(input)) return { ...exact, fallback: false }
    return makeResult({ score: 'weak', confidence: 1, targetMatched: false, expectedAnswer: input.expectedAnswer })
  }
  const userAnswer = input.userAnswer.trim()
  const variantId = usePreferencesStore.getState().localAiWarmupModelVariant
  const config = await warmupModelManager.getLoadConfig(variantId)
  if (!config) throw new Error('local warmup model is not downloaded')

  const response = await requestWorker({
    type: 'judge-embeddings',
    userAnswer,
    reference: makeReference(input),
    config,
  }, 8_000)
  if (!response.ok || !response.embeddings) throw new Error(response.error || 'local model failed')

  return judgeWarmupEmbeddings(input, response.embeddings)
}

/** Scoring is separate from inference so real model vectors can be regression-tested. */
export function judgeWarmupEmbeddings(input: WarmupTurnJudgeInput, embeddings: number[][]): LocalJudgeOutput {
  const exact = judgeExactWarmupAnswer(input)
  const targetMatched = targetIsUsed(input)
  if (exact && targetMatched) return { ...exact, fallback: false }
  const englishAnswer = /[a-z]/i.test(input.userAnswer)
  const languageMatched = input.direction === 'en_to_zh' ? /\p{Script=Han}/u.test(input.userAnswer) : englishAnswer
  const conflict = languageMatched ? meaningConflict(input) : '请按题目要求的语言回答。'
  if (conflict) return makeResult({ score: 'miss', confidence: 1, targetMatched, expectedAnswer: input.expectedAnswer, feedback: conflict })
  if (!targetMatched) return makeResult({ score: 'weak', confidence: 1, targetMatched, expectedAnswer: input.expectedAnswer, feedback: '意思可能接近，但目标表达还没有正确用上。' })
  // English MiniLM cannot replace a missing English reference with a Chinese prompt.
  if (!input.expectedAnswer?.trim()) throw new Error('这道题缺少参考答案，请更新学习包后重试。')
  const [userEmbedding, expectedEmbedding] = embeddings
  const similarity = cosine(userEmbedding, expectedEmbedding)
  const lexicalScore = tokenOverlap(input.userAnswer, input.expectedAnswer)
  const semanticScore = Math.max(similarity, lexicalScore * 0.88)
  const threshold = input.direction === 'en_to_zh' ? 0.6 : 0.66
  const score = semanticScore >= 0.82 ? 'strong' : semanticScore >= threshold ? 'ok' : semanticScore >= 0.5 ? 'weak' : 'miss'
  return makeResult({ score, confidence: semanticScore, targetMatched, expectedAnswer: input.expectedAnswer })
}

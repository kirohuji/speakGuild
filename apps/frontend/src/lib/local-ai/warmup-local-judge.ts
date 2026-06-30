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
  return `${config.modelId}:${config.dtype}:${localModelPath ?? ''}:${allowRemoteModels ? 'remote' : 'local'}`
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

function looksLikePastParticiple(token: string) {
  const normalized = token.toLowerCase()
  if (normalized === 'got' || normalized === 'been') return true
  if (/(ed|en|ne|wn)$/i.test(normalized)) return true
  return new Set([
    'done',
    'had',
    'made',
    'taken',
    'seen',
    'gone',
    'come',
    'found',
    'left',
    'lost',
    'heard',
    'read',
    'written',
    'eaten',
    'drunk',
    'known',
  ]).has(normalized)
}

function expandAmbiguousApostropheS(subject: string, nextToken = '') {
  return `${subject} ${looksLikePastParticiple(nextToken) ? 'has' : 'is'}${nextToken ? ` ${nextToken}` : ''}`
}

function expandEnglishContractions(value: string) {
  return value
    .toLowerCase()
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\byou're\b/g, 'you are')
    .replace(/\bwe're\b/g, 'we are')
    .replace(/\bthey're\b/g, 'they are')
    .replace(/\b(he|she|it|that|there|who|what|where|when|why|how)'s(?:\s+([a-z]+))?\b/g, (_match, subject: string, nextToken?: string) => (
      expandAmbiguousApostropheS(subject, nextToken)
    ))
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bn't\b/g, ' not')
    .replace(/\b([a-z]+)'ll\b/g, '$1 will')
    .replace(/\b([a-z]+)'ve\b/g, '$1 have')
    .replace(/\b([a-z]+)'d\b/g, '$1 would')
    .replace(/\b([a-z]+)'re\b/g, '$1 are')
    .replace(/\b([a-z]+)'m\b/g, '$1 am')
}

function normalizeText(value: string) {
  return expandEnglishContractions(value)
    .replace(/\ball of them\b/g, 'they')
    .replace(/\ball of us\b/g, 'we')
    .replace(/\bboth of them\b/g, 'they')
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

function splitTargets(targetText?: string) {
  if (!targetText) return []
  return targetText
    .split(/[,，、/|;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeTargetSkeleton(target: string) {
  return normalizeText(target
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/_{2,}/g, ' ')
    .replace(/\.{2,}/g, ' '))
}

function targetCandidates(target: string) {
  return Array.from(new Set([normalizeText(target), normalizeTargetSkeleton(target)]))
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
}

function hasTarget(userAnswer: string, targetText?: string) {
  const normalizedAnswer = normalizeText(userAnswer)
  const targets = splitTargets(targetText)
  if (!targets.length) return true
  return targets.some((target) => targetCandidates(target).some((candidate) => normalizedAnswer.includes(candidate)))
}

function answerContainsExpected(userAnswer: string, expectedAnswer?: string) {
  const normalizedAnswer = normalizeText(userAnswer)
  const normalizedExpected = normalizeText(expectedAnswer ?? '')
  return normalizedExpected.length >= 3 && normalizedAnswer.includes(normalizedExpected)
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
    feedback,
    correction,
    confidence: params.confidence,
    fallback: params.confidence < 0.58,
  }
}

export async function judgeWarmupTurnLocally(input: WarmupTurnJudgeInput): Promise<LocalJudgeOutput> {
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

  if (answerContainsExpected(userAnswer, input.expectedAnswer)) {
    return makeResult({ score: 'strong', confidence: 1, targetMatched: true, expectedAnswer: input.expectedAnswer })
  }

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

  const [userEmbedding, expectedEmbedding, promptEmbedding] = response.embeddings
  const expectedSimilarity = cosine(userEmbedding, expectedEmbedding)
  const promptSimilarity = cosine(userEmbedding, promptEmbedding)
  const containsExpected = answerContainsExpected(userAnswer, input.expectedAnswer)
  const lexicalScore = tokenOverlap(userAnswer, input.expectedAnswer)
  const semanticScore = Math.max(expectedSimilarity, promptSimilarity * 0.92, lexicalScore * 0.88)
  const targetMatched = input.direction === 'en_to_zh' || hasTarget(userAnswer, input.targetText)

  if (containsExpected && targetMatched) {
    return makeResult({ score: 'strong', confidence: Math.max(0.9, semanticScore), targetMatched, expectedAnswer: input.expectedAnswer })
  }

  if (lexicalScore >= 0.72 && targetMatched) {
    return makeResult({ score: 'ok', confidence: Math.max(0.72, semanticScore), targetMatched, expectedAnswer: input.expectedAnswer })
  }

  if (semanticScore >= 0.82 && targetMatched) {
    return makeResult({ score: 'strong', confidence: semanticScore, targetMatched, expectedAnswer: input.expectedAnswer })
  }
  if (semanticScore >= 0.66 && targetMatched) {
    return makeResult({ score: 'ok', confidence: semanticScore, targetMatched, expectedAnswer: input.expectedAnswer })
  }
  if (semanticScore >= 0.56 || !targetMatched) {
    return makeResult({ score: 'weak', confidence: Math.max(semanticScore, 0.6), targetMatched, expectedAnswer: input.expectedAnswer })
  }
  return makeResult({ score: 'miss', confidence: semanticScore, targetMatched, expectedAnswer: input.expectedAnswer })
}

import { expect, it, vi } from 'vitest'
import fixture from './fixtures/q8-warmup-regressions.json'
vi.mock('@/stores/preferences.store', () => ({ usePreferencesStore: { getState: () => ({ localAiWarmupModelVariant: 'q8' }) } }))
vi.mock('../warmup-model-manager', () => ({ warmupModelManager: {} }))
vi.mock('../warmup-embedding-cache.repository', () => ({ warmupEmbeddingCacheRepository: {} }))
import { judgeWarmupEmbeddings, type WarmupTurnJudgeInput } from '../warmup-local-judge'
it.each(fixture.cases)('keeps the real Q8 regression $id correct', ({ input, embeddings, expectedPass }) => {
  expect(judgeWarmupEmbeddings(input as WarmupTurnJudgeInput, embeddings).passed).toBe(expectedPass)
})

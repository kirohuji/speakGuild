import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/stores/preferences.store', () => ({ usePreferencesStore: { getState: () => ({ localAiWarmupModelVariant: 'test' }) } }))
vi.mock('../warmup-model-manager', () => ({ warmupModelManager: { getLoadConfig: vi.fn(async () => null) } }))
vi.mock('../warmup-embedding-cache.repository', () => ({ warmupEmbeddingCacheRepository: {} }))
import { judgeWarmupTurnLocally } from '../warmup-local-judge'
import { warmupModelManager } from '../warmup-model-manager'
const input = { stepType: 'vocab_drill' as const, prompt: '我喜欢咖啡', expectedAnswer: 'I like coffee.', userAnswer: '' }
beforeEach(() => vi.clearAllMocks())
it('accepts an exact answer with casing and punctuation differences without loading a model', async () => {
  expect(await judgeWarmupTurnLocally({ ...input, userAnswer: 'i like coffee!' })).toMatchObject({ passed: true, fallback: false })
  expect(warmupModelManager.getLoadConfig).not.toHaveBeenCalled()
})
it.each(['I do not think I like coffee.', 'I like coffee but I hate it.', 'I like coffee and tea.'])('does not auto-pass a containing answer: %s', async (userAnswer) => {
  await expect(judgeWarmupTurnLocally({ ...input, userAnswer })).rejects.toThrow('not downloaded')
})
it('accepts one-character Chinese answers', async () => {
  expect(await judgeWarmupTurnLocally({ ...input, direction: 'en_to_zh', expectedAnswer: '好', userAnswer: '好！' })).toMatchObject({ passed: true })
})
it('does not collapse both of them into they', async () => {
  await expect(judgeWarmupTurnLocally({ ...input, expectedAnswer: 'They agree.', userAnswer: 'Both of them agree.' })).rejects.toThrow('not downloaded')
})
it('normalizes curly apostrophes and negative contractions', async () => {
  expect(await judgeWarmupTurnLocally({ ...input, expectedAnswer: 'I do not agree.', userAnswer: 'I don’t agree.' })).toMatchObject({ passed: true })
})
it.each([
  ['It costs $5.', 'It costs €5.'],
  ['Growth is 10%.', 'Growth is 10.'],
  ["He has read it.", "He's read it."],
  ['I would go.', "I'd go."],
])('sends potentially meaningful differences to semantic assessment: %s / %s', async (expectedAnswer, userAnswer) => {
  await expect(judgeWarmupTurnLocally({ ...input, expectedAnswer, userAnswer })).rejects.toThrow('not downloaded')
})
it('does not approve a reference match that misses the required target', async () => {
  expect(await judgeWarmupTurnLocally({ ...input, userAnswer: input.expectedAnswer, targetText: 'enjoy' })).toMatchObject({ passed: false, score: 'weak', fallback: false })
})
it('does not approve a broken reference in the wrong language', async () => {
  await expect(judgeWarmupTurnLocally({ ...input, expectedAnswer: '我喜欢咖啡', userAnswer: '我喜欢咖啡' })).rejects.toThrow('not downloaded')
})

import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { buildWarmupJudgeSystem, warmupJudgeSchema, resolveWarmupAssessment, type WarmupAssessment } from '../../../../../../backend/src/modules/practice-ai/prompts/warmup-judge.prompt'
const source = new URL('../../../../../../backend/src/modules/practice-ai/english-practice-ai.service.ts', import.meta.url).href
const { EnglishPracticeAiService } = await import(/* @vite-ignore */ source)
const assessment: WarmupAssessment = { score: 'strong', feedback: '表达准确。', correction: null }
const dto = { stepType: 'vocab_drill' as const, direction: 'zh_to_en' as const, prompt: '我喜欢咖啡', expectedAnswer: 'I like coffee.', userAnswer: 'I enjoy coffee.' }
function fixture(raw: unknown = assessment, fail = false) {
  const generate = vi.fn(async (_request: unknown) => {
    if (fail) throw new Error('model unavailable')
    return { content: [{ type: 'text', text: JSON.stringify(raw) }], finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
      usage: { inputTokens: { total: 100 }, outputTokens: { total: 100 } } }
  })
  const model = { specificationVersion: 'v3', provider: 'test', modelId: 'test', supportedUrls: {}, doGenerate: generate }
  const service = new EnglishPracticeAiService({} as any, { recordTokens: vi.fn() } as any, { create: () => model } as any, { prefersNativeJsonMode: () => false } as any, { getLlmConfig: async () => ({ apiKey: 'fake' }) } as any, {} as any)
  return { service, generate }
}
it.each(['strong', 'ok', 'weak', 'miss'] as const)('derives one consistent verdict from %s', score => {
  expect(resolveWarmupAssessment({ ...assessment, score })).toMatchObject({ passed: score === 'strong' || score === 'ok', score })
})
it('does not rewrite a correct paraphrase', () => {
  expect(resolveWarmupAssessment({ ...assessment, score: 'ok', correction: 'unnecessary rewrite' })).toMatchObject({ passed: true, correction: null })
})
it.each(['uncertain', '', true, undefined])('rejects invalid model scores: %s', score => {
  expect(warmupJudgeSchema.safeParse({ ...assessment, score }).success).toBe(false)
})
it('uses exactly the evaluated common/type/direction rules in the application', () => {
  const evaluated = JSON.parse(readFileSync(new URL('../../../../../../../docs/evaluations/warmup-core-verbs-prompts.json', import.meta.url), 'utf8'))
  for (const stepType of ['chunk_substitution', 'vocab_drill', 'vocab_sentence_building', 'pattern_drill']) {
    for (const direction of ['zh_to_en', 'en_to_zh'] as const) {
      expect(buildWarmupJudgeSystem({ stepType, direction })).toBe([evaluated.common, evaluated[stepType], evaluated[direction]].join('\n\n'))
    }
  }
})
it('sends the selected prompt and existing task fields through the SDK fallback', async () => {
  const { service, generate } = fixture()
  expect(await service.judgeWarmupTurn({ ...dto, requiredWords: ['enjoy'] })).toMatchObject({ passed: true, score: 'strong' })
  const serialized = JSON.stringify(generate.mock.calls[0])
  expect(serialized).toContain('requiredWords')
  expect(serialized).toContain('This is vocabulary output practice.')
})
it.each([
  { userAnswer: 'I do not like coffee.' },
  { direction: 'en_to_zh', expectedAnswer: '我喜欢咖啡', userAnswer: '我不喜欢咖啡' },
  { userAnswer: 'I like coffee.', targetText: 'enjoy' },
  { userAnswer: 'I like coffee.', requiredWords: ['enjoy'] },
  { userAnswer: '随便写点什么' },
])('never invents a grade when the model is unavailable: %j', async change => {
  const { service } = fixture(assessment, true)
  await expect(service.judgeWarmupTurn({ ...dto, ...change })).rejects.toThrow()
})
it('retains a partial score and its specific feedback', async () => {
  const { service } = fixture({ score: 'weak', feedback: '漏掉了时间信息。', correction: 'I went yesterday.' })
  expect(await service.judgeWarmupTurn(dto)).toMatchObject({ passed: false, score: 'weak', feedback: '漏掉了时间信息。' })
})

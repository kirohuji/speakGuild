import { expect, it, vi } from 'vitest'
import { DESCRIPTION_LAYOUT_RULE, alignDescriptionLayout } from '../../../../../../backend/src/modules/admin/description-layout'
import { LEARNER_EXAMPLE_RULE, teachingDescriptionIssue, teachingExamplesIssue } from '../../../../../../backend/src/modules/admin/learning-content-quality'
const source = new URL('../../../../../../backend/src/modules/admin/admin-content-ai.service.ts', import.meta.url).href
const { AdminContentAiService } = await import(/* @vite-ignore */ source)
const batchSource = new URL('../../../../../../backend/src/modules/admin-tasks/jobs/library-field-batch.service.ts', import.meta.url).href
const { LibraryFieldBatchService } = await import(/* @vite-ignore */ batchSource)

const description = '**核心含义：** `test` 可表示检验能力或性能，重点是通过实际操作了解结果，既能作名词，也能作动词。\n\n**用法提示：** 说参加考试通常用 `take a test`（参加考试）；检验设备时可直接说 `test the equipment`（测试设备），根据对象选择表达。\n\n**易错点：** 不要把参加考试一律写成 `make a test`；学习者参加考试用 `take`，教师组织考试时表达会不同。\n\n**常见搭配：** `take a test`（参加考试）、`test a new idea`（检验新想法）、`a blood test`（血液检查）。'
const examples = [
  { en: 'We need to test the new printer today.', zh: '我们今天需要测试新打印机。', level: 'basic' },
  { en: 'She took a driving test last Friday.', zh: '她上周五参加了驾驶考试。', level: 'intermediate' },
  { en: 'This project will test our ability to work together.', zh: '这个项目将考验我们的合作能力。', level: 'intermediate' },
]
const valid = () => ({ description, examples, generatedExamples: examples })

function fixture(responses: any[] = [valid()]) {
  const generate = vi.fn(async () => {
    const value = responses.length > 1 ? responses.shift() : responses[0]
    return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
    finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
    usage: { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 100, text: 100, reasoning: 0 } },
  } })
  const model = { specificationVersion: 'v3', provider: 'local-test', modelId: 'fake', supportedUrls: {}, doGenerate: generate }
  const dictionary = vi.fn(async () => ({ senseClusters: [{ senses: [{ partOfSpeech: 'noun', definition: 'a careful examination', translations: { zh: '仔细检验' }, examples: [{ en: 'A reference dictionary sentence.' }] }] }] }))
  const service = new AdminContentAiService({ dictionaryEntry: { findUnique: dictionary }, chunk: { findMany: async () => [] } } as any,
    { getLlmConfig: async () => ({ apiKey: 'test-key' }) } as any, { create: () => model } as any)
  const prompt = (index = 0) => JSON.stringify(generate.mock.calls[index]?.[0]?.prompt)
  return { service, generate, prompt, dictionary }
}

it('keeps canonical headings, readable punctuation and bilingual parentheses without adding translations locally', () => {
  const normalized = alignDescriptionLayout(description.replace('（参加考试）', '(参加考试)'))
  expect(teachingDescriptionIssue(normalized)).toBeNull()
  expect(normalized).toContain('`take a test`（参加考试）')
  expect(alignDescriptionLayout(normalized)).toBe(normalized)
  expect(teachingDescriptionIssue(description.replace(/（[^）]+）/g, ''))).toContain('常见搭配')
  expect(teachingDescriptionIssue(description + '冗长说明'.repeat(100))).toContain('过长')
})
it('rejects missing, duplicate or untranslated examples', () => {
  expect(teachingExamplesIssue(examples)).toBeNull()
  expect(teachingExamplesIssue(examples.slice(0, 1))).toContain('3–4')
  expect(teachingExamplesIssue([examples[0], examples[0], examples[1]])).toContain('重复')
  expect(teachingExamplesIssue(examples.map(e => ({ ...e, zh: '' })))).toContain('中文')
})
it.each(['word', 'chunk', 'pattern'] as const)('generates only the selected field for %s with the common layout and example rules', async kind => {
  const { service, generate, prompt, dictionary } = fixture()
  const result = await service.regenerateLearningFields({ kind, text: 'test', meaning: '测试', description: '旧讲解中有用的信息', definitions: ['short gloss'], fields: ['description'] })
  expect(Object.keys(result)).toEqual(['description'])
  expect(generate).toHaveBeenCalledTimes(1)
  expect(prompt()).toContain(DESCRIPTION_LAYOUT_RULE)
  expect(prompt()).toContain(LEARNER_EXAMPLE_RULE)
  expect(prompt()).toContain('旧讲解中有用的信息')
  if (kind === 'word') {
    expect(dictionary).toHaveBeenCalled()
    expect(prompt()).toContain('a careful examination')
  }
})
it('performs at most one corrective retry for invalid quality and preserves failure if both outputs fail', async () => {
  const good = fixture([{ description: '泛泛的短说明' }, valid()])
  await expect(good.service.regenerateLearningFields({ kind: 'chunk', text: 'test out', fields: ['description'] })).resolves.toHaveProperty('description')
  expect(good.generate).toHaveBeenCalledTimes(2)
  expect(good.prompt(1)).toContain('previous output failed validation')
  const bad = fixture([{ examples: [] }])
  await expect(bad.service.regenerateLearningFields({ kind: 'pattern', text: '__ works', fields: ['examples'] })).rejects.toThrow('原内容未修改')
  expect(bad.generate).toHaveBeenCalledTimes(2)
})
it('uses the same standards and quality normalization for full word, chunk and pattern generation', async () => {
  for (const method of ['enrichVocabulary', 'enrichChunk', 'enrichPattern']) {
    const { service, prompt } = fixture()
    const result = await service[method]({ word: 'test', text: 'test out', pattern: '__ works', meaning: '测试', definitions: ['examine'], examples: [] })
    expect(prompt()).toContain(DESCRIPTION_LAYOUT_RULE)
    expect(prompt()).toContain(LEARNER_EXAMPLE_RULE)
    expect(teachingDescriptionIssue(result.description)).toBeNull()
    expect(teachingExamplesIssue(result.examples ?? result.generatedExamples)).toBeNull()
  }
})
it('corrects a bad full-generation result once using the shared selected-field generator', async () => {
  const { service, generate } = fixture([{ ...valid(), examples: [examples[0]] }, valid()])
  const result = await service.enrichChunk({ text: 'test out', meaning: '试用' })
  expect(result.examples).toHaveLength(3)
  expect(generate).toHaveBeenCalledTimes(2)
})
it.each(['word', 'chunk', 'pattern'])('routes backend field regeneration for %s through the exact same entry as insight', async kind => {
  const row = { id: 'id', word: 'test', text: 'test out', pattern: '__ works', meaning: '测试', definitionEn: 'examine', description, examples }
  const delegate = { findMany: async () => [row], update: vi.fn(async () => row) }
  const regenerate = vi.fn(async () => ({ description }))
  const ai = { regenerateLearningFields: regenerate, enrichVocabulary: vi.fn(), enrichChunk: vi.fn(), enrichPattern: vi.fn() }
  const service = new LibraryFieldBatchService({ vocabulary: delegate, chunk: delegate, sentencePattern: delegate } as any,
    { isCanceled: async () => false } as any, ai as any)
  const errors: any[] = []
  const method = kind === 'word' ? 'processVocabularies' : kind === 'chunk' ? 'processChunks' : 'processPatterns'
  const result = await service[method]('task', ['id'], 'regenerate', new Set(['description']), {}, errors, true)
  expect(result.updated).toBe(1)
  expect(errors).toEqual([])
  expect(regenerate).toHaveBeenCalledWith(expect.objectContaining({ kind, fields: ['description'], description }), expect.any(Function))
  expect(ai.enrichVocabulary).not.toHaveBeenCalled()
  expect(ai.enrichChunk).not.toHaveBeenCalled()
  expect(ai.enrichPattern).not.toHaveBeenCalled()
})
it('applies the shared quality rules to both batch and single fallback prompt builders', () => {
  const { service } = fixture()
  const item = { id: 'id', text: 'test out', meaning: '试用', missing: { meaning: false, description: true, examples: true } }
  for (const prompt of [service['buildBatchPrompt']([item], 'chunk'), service['buildSinglePrompt'](item, 'chunk')]) {
    expect(prompt).toContain(DESCRIPTION_LAYOUT_RULE)
    expect(prompt).toContain(LEARNER_EXAMPLE_RULE)
  }
  expect(() => service['normalizeTextResult']({}, 'chunk', item.missing)).toThrow('四个完整小节')
})
it('does not add a third request after the full word generator already retried malformed JSON', async () => {
  const { service, generate } = fixture(['not valid JSON', { description: '过短', generatedExamples: [] }])
  await expect(service.enrichVocabulary({ word: 'test', definitions: ['examine'], examples: [] })).rejects.toThrow('原内容未修改')
  expect(generate).toHaveBeenCalledTimes(2)
})

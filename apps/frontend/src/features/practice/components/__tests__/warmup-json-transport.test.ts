import { afterEach, expect, it, vi } from 'vitest'
const backend = '../../../../../../backend/src/'
const load = (file: string) => import(/* @vite-ignore */ new URL(backend + file, import.meta.url).href)
const { EnglishPracticeAiService } = await load('modules/practice-ai/english-practice-ai.service.ts')
const { LlmChatClient } = await load('common/llm/llm-chat.client.ts')
const { LlmAdapterRegistry } = await load('common/llm/llm-adapter.registry.ts')
const raw = { score: 'strong', feedback: '表达准确。', correction: null }
const dto = { stepType: 'pattern_drill', direction: 'zh_to_en', prompt: '我昨天到公司晚了。', expectedAnswer: 'I got to work late yesterday.', userAnswer: 'I got to work late yesterday.', targetText: 'get to [place]' }
function fixture(provider = 'deepseek', content = JSON.stringify(raw), finishReason = 'stop', status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(status === 200 ? {
    choices: [{ finish_reason: finishReason, message: { content } }], usage: { total_tokens: 42 },
  } : { error: { message: 'provider unavailable' } }), { status }))
  vi.stubGlobal('fetch', fetchMock)
  const registry = new LlmAdapterRegistry()
  const sdkGenerate = vi.fn()
  const quota = { recordTokens: vi.fn() }
  const service = new EnglishPracticeAiService({} as any, quota as any,
    { create: () => ({ doGenerate: sdkGenerate }) } as any, new LlmChatClient(registry),
    { getLlmConfig: async () => ({ provider, apiKey: 'fake', baseUrl: 'https://example.test/v1', model: 'test' }) } as any, {} as any)
  return { service, fetchMock, quota, sdkGenerate }
}
afterEach(() => vi.unstubAllGlobals())
it.each(['deepseek', 'bailian'])('uses existing JSON transport for %s and validates the result locally', async provider => {
  const { service, fetchMock, quota, sdkGenerate } = fixture(provider)
  expect(await service.judgeWarmupTurn(dto, 'user')).toMatchObject({ passed: true, score: 'strong', feedback: '表达准确。' })
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  const body = JSON.parse(init.body as string)
  expect(url).toBe('https://example.test/v1/chat/completions')
  expect(body.response_format).toEqual({ type: 'json_object' })
  expect(body.response_format).not.toHaveProperty('json_schema')
  if (provider === 'deepseek') expect(body.thinking).toEqual({ type: 'disabled' })
  else expect(body.enable_thinking).toBe(false)
  expect(JSON.parse(body.messages[1].content)).toMatchObject(dto)
  expect(body.messages[0].content).toContain('score (strong|ok|weak|miss)')
  expect(quota.recordTokens).toHaveBeenCalledWith('user', 42)
  expect(sdkGenerate).not.toHaveBeenCalled()
})
it.each([
  ['not JSON', 'stop'],
  [JSON.stringify({ passed: true }), 'stop'],
  [JSON.stringify({ ...raw, score: true }), 'stop'],
  [JSON.stringify(raw), 'length'],
  ['', 'stop'],
])('does not accept invalid or truncated native output: %s / %s', async (content, reason) => {
  const { service } = fixture('deepseek', content, reason)
  await expect(service.judgeWarmupTurn(dto)).rejects.toThrow('本次不计成绩')
})
it('preserves a valid negative assessment instead of accepting reference equality', async () => {
  const { service } = fixture('deepseek', JSON.stringify({ ...raw, score: 'miss', feedback: '意思相反。', correction: 'A correction.' }))
  expect(await service.judgeWarmupTurn(dto)).toMatchObject({ passed: false, score: 'miss', feedback: '意思相反。' })
})
it('does not turn an HTTP failure into a target exercise pass', async () => {
  const { service, quota } = fixture('deepseek', '', 'stop', 503)
  await expect(service.judgeWarmupTurn(dto, 'user')).rejects.toThrow('本次不计成绩')
  expect(quota.recordTokens).not.toHaveBeenCalled()
})

it('accepts an omitted unused correction without weakening assessment validation', async () => {
  const { correction: _unused, ...withoutCorrection } = raw
  const { service } = fixture('deepseek', JSON.stringify(withoutCorrection))
  expect(await service.judgeWarmupTurn(dto)).toMatchObject({ passed: true, correction: null })
})

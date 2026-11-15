import { afterEach, expect, it, vi } from 'vitest'
const { post, exact, local, preference } = vi.hoisted(() => ({ post: vi.fn(), exact: vi.fn(), local: vi.fn(), preference: { enabled: true } }))
vi.mock('@/stores/preferences.store', () => ({ usePreferencesStore: { getState: () => ({ localAiWarmupJudgeEnabled: preference.enabled }) } }))
vi.mock('@/lib/request', () => ({ post, get: vi.fn(), patch: vi.fn(), del: vi.fn() }))
vi.mock('@/lib/local-ai/warmup-local-judge', () => ({ judgeExactWarmupAnswer: exact, judgeWarmupTurnLocally: local }))
vi.mock('@/providers/auth-session', () => ({ getCurrentSessionSnapshot: () => null }))
import { practiceAiApi } from '../../api/english-practice-api'
const input = { stepType: 'vocab_drill' as const, prompt: '我喜欢咖啡', userAnswer: 'I enjoy coffee.' }
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); preference.enabled = true })
it.each([true, false])('grades offline with the selected local model even when preference=%s', async enabled => {
  preference.enabled = enabled
  vi.stubGlobal('navigator', { onLine: false })
  exact.mockReturnValue(null)
  const result = { passed: true, score: 'ok', feedback: '意思到位，可以。' }
  local.mockResolvedValue(result)
  expect(await practiceAiApi.judgeWarmupTurn(input)).toEqual(result)
  expect(local).toHaveBeenCalledWith(input)
  expect(post).not.toHaveBeenCalled()
})
it('retains negative offline grades without contacting the cloud', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  exact.mockReturnValue(null)
  const result = { passed: false, score: 'weak', feedback: '目标表达没有用对。' }
  local.mockResolvedValue(result)
  expect(await practiceAiApi.judgeWarmupTurn(input)).toEqual(result)
  expect(post).not.toHaveBeenCalled()
})
it('reports missing model errors offline without a remote fallback', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  exact.mockReturnValue(null)
  local.mockRejectedValue(new Error('local model is not downloaded'))
  await expect(practiceAiApi.judgeWarmupTurn(input)).rejects.toThrow('not downloaded')
  expect(post).not.toHaveBeenCalled()
})
it('keeps cloud judging as the online default when local judging is off', async () => {
  preference.enabled = false
  vi.stubGlobal('navigator', { onLine: true })
  post.mockResolvedValue({ passed: false, score: 'weak' })
  expect(await practiceAiApi.judgeWarmupTurn(input)).toEqual({ passed: false, score: 'weak' })
  expect(local).not.toHaveBeenCalled()
})
it('can recover from a broken local model through the cloud online', async () => {
  vi.stubGlobal('navigator', { onLine: true })
  exact.mockReturnValue(null)
  local.mockRejectedValue(new Error('worker failed'))
  post.mockResolvedValue({ passed: true, score: 'ok' })
  expect(await practiceAiApi.judgeWarmupTurn(input)).toEqual({ passed: true, score: 'ok' })
})
it('accepts a safe offline exact match without loading embeddings', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  const result = { passed: true, score: 'strong', fallback: false }
  exact.mockReturnValue(result)
  expect(await practiceAiApi.judgeWarmupTurn(input)).toEqual(result)
  expect(local).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
})
it.each(['offline', 'network', 'timeout'])('uses the downloaded model when navigator says online but the request fails: %s', async kind => {
  preference.enabled = false
  vi.stubGlobal('navigator', { onLine: true })
  post.mockRejectedValue(Object.assign(new Error('disconnected'), { kind }))
  local.mockResolvedValue({ passed: true, score: 'ok' })
  expect(await practiceAiApi.judgeWarmupTurn(input)).toEqual({ passed: true, score: 'ok' })
  expect(local).toHaveBeenCalledOnce()
})
it('does not turn authorization failures into local fallbacks', async () => {
  preference.enabled = false
  vi.stubGlobal('navigator', { onLine: true })
  post.mockRejectedValue(Object.assign(new Error('sign in again'), { kind: 'unauthorized' }))
  await expect(practiceAiApi.judgeWarmupTurn(input)).rejects.toThrow('sign in again')
  expect(local).not.toHaveBeenCalled()
})

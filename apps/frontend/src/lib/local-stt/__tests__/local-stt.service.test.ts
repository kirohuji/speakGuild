import { beforeEach, describe, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({
  online: true,
  localSttEnabled: true,
  localSttFallbackToCloud: false,
  cloud: vi.fn(),
  getStatus: vi.fn(),
  getLoadConfig: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))
vi.mock('@/stores/preferences.store', () => ({
  usePreferencesStore: {
    getState: () => ({
      localSttEnabled: deps.localSttEnabled,
      localSttFallbackToCloud: deps.localSttFallbackToCloud,
      localSttModelVariant: 'tiny.en',
    }),
  },
}))
vi.mock('@/lib/practice-ai-api', () => ({
  transcribeRecording: (...args: unknown[]) => deps.cloud(...args),
}))
vi.mock('../local-stt-model-manager', () => ({
  localSttModelManager: {
    getStatus: (...args: unknown[]) => deps.getStatus(...args),
    getLoadConfig: (...args: unknown[]) => deps.getLoadConfig(...args),
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  deps.online = true
  deps.localSttEnabled = true
  deps.localSttFallbackToCloud = false
  deps.cloud.mockResolvedValue({ text: 'cloud' })
  deps.getStatus.mockResolvedValue({ installing: false })
  deps.getLoadConfig.mockResolvedValue(null)
  vi.stubGlobal('navigator', { onLine: deps.online })
})

describe('transcribeVoiceInput early exits', () => {
  it('fails fast for Chinese when local STT is enabled', async () => {
    const { transcribeVoiceInput } = await import('../local-stt.service')
    await expect(transcribeVoiceInput(new Blob(['x']), 'a.webm', 'zh-CN')).rejects.toThrow(/中文/)
    expect(deps.cloud).not.toHaveBeenCalled()
    expect(deps.getLoadConfig).not.toHaveBeenCalled()
  })

  it('never calls cloud while offline without a ready local model', async () => {
    deps.online = false
    vi.stubGlobal('navigator', { onLine: false })
    const { transcribeVoiceInput } = await import('../local-stt.service')
    await expect(transcribeVoiceInput(new Blob(['x']), 'a.webm', 'en')).rejects.toThrow(/模型/)
    expect(deps.cloud).not.toHaveBeenCalled()
  })

  it('uses cloud only when online fallback is enabled and local model is missing', async () => {
    deps.localSttFallbackToCloud = true
    deps.cloud.mockResolvedValue({
      audioBase64: '',
      mimeType: 'audio/webm',
      text: 'hello',
      audioUrl: null,
      wordTimestamps: null,
    })
    const { transcribeVoiceInput } = await import('../local-stt.service')
    const result = await transcribeVoiceInput(new Blob(['x']), 'a.webm', 'en')
    expect(result.text).toBe('hello')
    expect(deps.cloud).toHaveBeenCalledOnce()
  })
})

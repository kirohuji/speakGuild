import { synthesizeAsset } from '@/lib/tts-api'
import { listAiProviders, type AiProviderItem } from '@/features/admin/api-ai-models'

type TtsAccent = 'us' | 'uk' | 'neutral'

/**
 * 获取当前激活的 TTS Provider 配置
 * 供管理后台各模块复用
 */
export async function getActiveTtsProvider(): Promise<AiProviderItem> {
  const providers = await listAiProviders()
  const ttsProviders = providers.tts ?? []
  const active = ttsProviders.find((item) => item.isActive) ?? ttsProviders[0]
  if (!active) throw new Error('请先在大模型管理中配置 TTS')
  if (!['minimax', 'cartesia'].includes(active.provider)) {
    throw new Error(`当前 TTS Provider (${active.provider}) 暂不支持内容语料库生成`)
  }
  return active
}

/**
 * 根据口音获取对应 voiceId
 */
export function getTtsVoiceId(item: AiProviderItem, accent: TtsAccent): string | undefined {
  const config = item.config ?? {}
  const accentKeys = accent === 'us'
    ? ['usVoiceId', 'americanVoiceId', 'voiceIdUs', 'voiceUs']
    : accent === 'uk'
      ? ['ukVoiceId', 'britishVoiceId', 'voiceIdUk', 'voiceUk']
      : []
  for (const key of accentKeys) {
    const value = config[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const fallback = typeof config.voiceId === 'string'
    ? config.voiceId
    : typeof config.voiceName === 'string'
      ? config.voiceName
      : ''
  return fallback.trim() || undefined
}

/**
 * 获取 TTS 合成参数
 */
export function getTtsParams(item: AiProviderItem): Record<string, string | number | boolean> {
  const config = item.config ?? {}
  const params = typeof config.params === 'object' && config.params
    ? { ...(config.params as Record<string, string | number | boolean>) }
    : {}
  if (typeof config.voiceProvider === 'string') params.voice_provider = config.voiceProvider
  if (typeof config.voiceKind === 'string') params.voice_kind = config.voiceKind
  return params
}

/**
 * 管理后台通用 TTS 合成：生成文本音频并上传 COS，返回可播放 URL
 */
export async function synthesizeAdminAudio(
  text: string,
  bizType: string,
  bizId: string,
  accent: TtsAccent = 'neutral',
): Promise<string> {
  const active = await getActiveTtsProvider()
  const result = await synthesizeAsset({
    text,
    provider: active.provider as any,
    model: active.model,
    voiceId: getTtsVoiceId(active, accent),
    params: getTtsParams(active),
    bizType,
    bizId,
  } as any)
  return result.url
}

/** 简单播放音频 URL */
export function playAudioUrl(url?: string | null): void {
  if (!url) return
  const audio = new Audio(url)
  audio.play().catch(() => {
    // 静默失败，避免未捕获的 Promise rejection
  })
}

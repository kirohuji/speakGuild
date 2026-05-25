import instance, { get, post } from './request'

// ---------- 类型定义 ----------

export type TtsProviderKey = 'minimax' | 'cartesia'

export type TtsParamSchemaField = {
  key: string
  label: string
  type: 'number' | 'string' | 'select' | 'boolean'
  required?: boolean
  min?: number
  max?: number
  step?: number
  defaultValue?: string | number | boolean
  options?: Array<{ label: string; value: string }>
}

export type TtsProviderModelSchema = {
  model: string
  label: string
  requiresVoiceId: boolean
  fields: TtsParamSchemaField[]
}

export type TtsSchema = {
  provider: TtsProviderKey
  models: TtsProviderModelSchema[]
}

export type TtsWordTimestamp = {
  text: string
  start_time: number  // 纳秒
  end_time?: number   // 纳秒
}

export type SynthesizeQuestionPayload = {
  questionId: string
  provider: TtsProviderKey
  model: string
  voiceId?: string
  params?: Record<string, string | number | boolean>
  /** 合成哪部分：question = 题干，answer = 答案（默认） */
  textType?: 'question' | 'answer'
}

export type SynthesizeQuestionResult = {
  id: string
  mimeType: string
  wordTimestamps: TtsWordTimestamp[] | null
  cached: boolean
}

export type SynthesizeTextPayload = {
  text: string
  provider: TtsProviderKey
  model: string
  voiceId?: string
  params?: Record<string, string | number | boolean>
}

export type SynthesizeTextResult = {
  mimeType: string
  audioBase64: string
  wordTimestamps: TtsWordTimestamp[] | null
}

// ---------- API ----------

/** 获取所有支持的 Provider/Model/参数 Schema */
export const getTtsParamsSchema = (): Promise<TtsSchema[]> =>
  get('/tts/params-schema')

/**
 * 按题目 ID + 配置生成/获取持久化音频
 * 返回音频 ID（用于拼 audioUrl）和词时间戳
 */
export const synthesizeQuestion = (payload: SynthesizeQuestionPayload): Promise<SynthesizeQuestionResult> =>
  post('/tts/synthesize-question', payload)

/** 短文本即时合成，用于设置页试听预览 */
export const synthesizeText = (payload: SynthesizeTextPayload): Promise<SynthesizeTextResult> =>
  post('/tts/synthesize-text', payload)

/** 获取音频文件的流式 URL（直接作为 <audio> src 使用） */
export const getAudioUrl = (id: string): string => {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1/guide-exam'
  return `${base}/tts/audio/${id}`
}

/** 获取音频 Blob（用于 WaveSurfer 解码） */
export const getAudioBlob = (id: string): Promise<Blob> =>
  instance.get(`/tts/audio/${id}`, { responseType: 'blob' }) as any

/** 清除某题目的音频缓存 */
export const clearQuestionAudioCache = (questionId: string): Promise<{ deleted: number }> =>
  instance.delete(`/tts/question/${questionId}/cache`) as any

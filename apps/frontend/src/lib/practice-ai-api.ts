import instance, { post } from './request'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? '/api/v1/guide-exam'

export type TranscribeRecordingResult = {
  audioBase64: string
  mimeType: string
  text: string | null
  wordTimestamps: Array<{ text: string; start_time: number; end_time?: number }> | null
}

export interface WordExampleItem {
  en: string
  zh: string
  level: 'basic' | 'intermediate' | 'advanced'
  note?: string
}

export interface WordEnrichmentResult {
  chineseTranslation: string
  meanings: Array<{ partOfSpeech: string; chineseGloss: string }>
  examples: WordExampleItem[]
  memoryTip: string
}

/** 上传录音 → Whisper 转写 */
export const transcribeRecording = (audioBlob: Blob, filename = 'recording.webm'): Promise<TranscribeRecordingResult> => {
  const form = new FormData()
  form.append('audio', audioBlob, filename)
  return instance.post('/tts/transcribe-recording', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  }) as any
}

/** 单词增强：中文释义 + 分级例句（带内存缓存） */
const _wordCache = new Map<string, WordEnrichmentResult>()
export async function enrichWord(
  word: string,
  englishDefinitions?: string
): Promise<WordEnrichmentResult> {
  const key = word.toLowerCase()
  if (_wordCache.has(key)) return _wordCache.get(key)!
  const data = await post<WordEnrichmentResult>('/practice-ai/word-enrichment', {
    word: key,
    englishDefinitions,
  })
  _wordCache.set(key, data)
  return data
}

/** 流式 AI 评分反馈 */
export async function streamFeedback(
  payload: { questionId: string; userAnswer: string; isVoice?: boolean },
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(`${API_BASE}/practice-ai/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new Error(`AI 评分失败 ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}

/** 流式 AI 教学指导 */
export async function streamTeaching(
  payload: { questionId: string; userDraft?: string },
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(`${API_BASE}/practice-ai/teach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new Error(`教学指导失败 ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}

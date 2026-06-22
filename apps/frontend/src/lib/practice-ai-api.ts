import instance, { post } from './request'
import { learningContentRepository } from '@/lib/offline'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? '/api/v1/manyu'

export type TranscribeRecordingResult = {
  audioBase64: string
  mimeType: string
  text: string | null
  audioUrl: string | null
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
  phonetic?: string
  audioUrl?: string
  meanings: Array<{ partOfSpeech: string; chineseGloss: string }>
  examples: WordExampleItem[]
  memoryTip: string
}

/** 上传录音 → Whisper 转写 */
export const transcribeRecording = (
  audioBlob: Blob,
  filename = 'recording.webm',
  language?: string,
): Promise<TranscribeRecordingResult> => {
  const form = new FormData()
  form.append('audio', audioBlob, filename)
  if (language) form.append('language', language)
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
  const cached = await learningContentRepository.getDictionaryEntry(key) as { data?: WordEnrichmentResult } | null
  if (cached?.data) {
    _wordCache.set(key, cached.data)
    return cached.data
  }

  try {
    const data = await post<WordEnrichmentResult>('/practice-ai/word-enrichment', {
      word: key,
      englishDefinitions,
    }, {
      dedupe: true,
      failureCooldownMs: 60_000,
    })
    _wordCache.set(key, data)
    await learningContentRepository.saveDictionaryEntry(key, data)
    return data
  } catch (error) {
    if (cached?.data) return cached.data
    throw error
  }
}

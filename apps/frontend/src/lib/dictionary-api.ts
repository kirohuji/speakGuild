/**
 * Free Dictionary API — https://dictionaryapi.dev/
 * 无需 API Key，免费，覆盖英语词汇
 */

export interface Phonetic {
  text?: string
  audio?: string
  sourceUrl?: string
  license?: { name: string; url: string }
}

export interface Definition {
  definition: string
  synonyms: string[]
  antonyms: string[]
  example?: string
}

export interface Meaning {
  partOfSpeech: string
  definitions: Definition[]
  synonyms: string[]
  antonyms: string[]
}

export interface DictEntry {
  word: string
  phonetic?: string
  phonetics: Phonetic[]
  meanings: Meaning[]
  origin?: string
  sourceUrls?: string[]
}

const CACHE = new Map<string, DictEntry[] | null>()

export async function lookupWord(word: string): Promise<DictEntry[] | null> {
  const key = word.toLowerCase().trim()
  if (CACHE.has(key)) return CACHE.get(key)!

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`
    )
    if (!res.ok) {
      CACHE.set(key, null)
      return null
    }
    const data: DictEntry[] = await res.json()
    CACHE.set(key, data)
    return data
  } catch {
    CACHE.set(key, null)
    return null
  }
}

/** 获取第一个有效的音频 URL */
export function getFirstAudio(phonetics: Phonetic[]): string | null {
  return phonetics.find((p) => p.audio)?.audio ?? null
}

/** 获取最佳音标文本 */
export function getBestPhonetic(entry: DictEntry): string | null {
  if (entry.phonetic) return entry.phonetic
  return entry.phonetics.find((p) => p.text)?.text ?? null
}

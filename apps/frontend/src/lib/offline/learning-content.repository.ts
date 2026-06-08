import { localDb } from './local-db'

function includesText(value: unknown, query: string) {
  return typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export type WordEntry = {
  id: string
  word: string
  meaning?: string
  partOfSpeech?: string | null
  phoneticUs?: string | null
  phoneticUk?: string | null
  audioUsUrl?: string | null
  audioUkUrl?: string | null
  definitionEn?: string | null
  synonyms?: string[]
  examples?: unknown
  description?: string | null
  difficulty?: string
  sceneName?: string
  source?: string
  masteryStatus?: 'learning' | 'reviewing' | 'mastered'
  reviewCount?: number
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  updatedAt: string
}

export type ChunkEntry = {
  id: string
  text: string
  meaning?: string
  description?: string | null
  category?: string | null
  difficulty?: string
  examples?: unknown
  sceneName?: string
  source?: string
  masteryStatus?: 'learning' | 'reviewing' | 'mastered'
  reviewCount?: number
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  updatedAt: string
}

export type PatternEntry = {
  id: string
  pattern: string
  meaning?: string
  slots?: string[]
  example?: string
  examples?: unknown
  difficulty?: string
  sceneName?: string
  source?: string
  masteryStatus?: 'learning' | 'reviewing' | 'mastered'
  reviewCount?: number
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  updatedAt: string
}

export const learningContentRepository = {
  /** 从已下载的学习包中提取词汇数据 */
  async _getAllVocabularies(): Promise<any[]> {
    const details = await localDb.list<any>('downloaded_unit_details')
    // 只取完整单元数据（排除 topic:xxx 子条目）
    return details
      .filter((d) => d.vocabularies && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.vocabularies ?? []).map((item: any) => ({ ...item, unitId: d.id })))
  },

  async getVocabulary(wordOrId: string): Promise<any | null> {
    const cached = await localDb.get<WordEntry>('word_entry', wordOrId.toLowerCase())
    if (cached) return cached
    const all = await this._getAllVocabularies()
    return all.find((item) => item.id === wordOrId || item.word?.toLowerCase() === wordOrId.toLowerCase()) ?? null
  },

  async searchVocabulary(query: string): Promise<any[]> {
    const cached = await localDb.list<WordEntry>('word_entry')
    const all = await this._getAllVocabularies()
    return uniqueById([...cached, ...all]).filter((item) =>
      includesText(item.word, query) ||
      includesText(item.meaning, query) ||
      includesText(item.definitionEn, query),
    )
  },

  async saveWordEntry(item: Omit<WordEntry, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string }): Promise<void> {
    const word = item.word.trim().toLowerCase()
    if (!word) return
    await localDb.put('word_entry', {
      ...item,
      id: word,
      word,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    })
  },

  async listWordEntries(): Promise<WordEntry[]> {
    return localDb.list<WordEntry>('word_entry')
  },

  async deleteWordEntry(word: string): Promise<void> {
    await localDb.delete('word_entry', word.trim().toLowerCase())
  },

  async updateWordEntryStatus(word: string, status: NonNullable<WordEntry['masteryStatus']>): Promise<void> {
    const id = word.trim().toLowerCase()
    const entry = await localDb.get<WordEntry>('word_entry', id)
    if (!entry) return
    await localDb.put('word_entry', {
      ...entry,
      masteryStatus: status,
      reviewCount: status === 'reviewing' ? (entry.reviewCount ?? 0) + 1 : entry.reviewCount ?? 0,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  },

  async getDictionaryEntry(word: string): Promise<any | null> {
    return localDb.get('dictionary_entries', word.toLowerCase())
  },

  async saveDictionaryEntry(word: string, entry: any): Promise<void> {
    await localDb.put('dictionary_entries', {
      id: word.toLowerCase(),
      word: word.toLowerCase(),
      type: 'managed-dictionary',
      data: entry,
      updatedAt: new Date().toISOString(),
    })
  },

  async getChunk(chunkId: string): Promise<any | null> {
    const cached = await localDb.get<ChunkEntry>('chunk_entry', chunkId)
    if (cached) return cached
    const details = await localDb.list<any>('downloaded_unit_details')
    for (const d of details) {
      if (d.chunks) {
        const found = d.chunks.find((item: any) => item.id === chunkId)
        if (found) return { ...found, unitId: d.id }
      }
    }
    return null
  },

  async searchChunks(query: string): Promise<any[]> {
    const cached = await localDb.list<ChunkEntry>('chunk_entry')
    const details = await localDb.list<any>('downloaded_unit_details')
    const all = details
      .filter((d) => d.chunks && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.chunks ?? []).map((item: any) => ({ ...item, unitId: d.id })))
    return uniqueById([...cached, ...all]).filter((item) =>
      includesText(item.text, query) ||
      includesText(item.meaning, query) ||
      includesText(item.description, query),
    )
  },

  async saveChunkEntry(item: Omit<ChunkEntry, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string }): Promise<void> {
    const text = item.text.trim()
    if (!text) return
    await localDb.put('chunk_entry', {
      ...item,
      id: text,
      text,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    })
  },

  async listChunkEntries(): Promise<ChunkEntry[]> {
    return localDb.list<ChunkEntry>('chunk_entry')
  },

  async deleteChunkEntry(text: string): Promise<void> {
    await localDb.delete('chunk_entry', text.trim())
  },

  async updateChunkEntryStatus(text: string, status: NonNullable<ChunkEntry['masteryStatus']>): Promise<void> {
    const id = text.trim()
    const entry = await localDb.get<ChunkEntry>('chunk_entry', id)
    if (!entry) return
    await localDb.put('chunk_entry', {
      ...entry,
      masteryStatus: status,
      reviewCount: status === 'reviewing' ? (entry.reviewCount ?? 0) + 1 : entry.reviewCount ?? 0,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  },

  async searchSentencePatterns(query: string): Promise<any[]> {
    const cached = await localDb.list<PatternEntry>('pattern_entry')
    const details = await localDb.list<any>('downloaded_unit_details')
    const all = details
      .filter((d) => d.sentencePatterns && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.sentencePatterns ?? []).map((item: any) => ({ ...item, unitId: d.id })))
    return uniqueById([...cached, ...all.map((item: any) => ({ ...item, id: item.id ?? item.pattern }))]).filter((item) =>
      includesText(item.pattern, query) ||
      includesText(item.meaning, query) ||
      includesText(item.example, query),
    )
  },

  async savePatternEntry(item: Omit<PatternEntry, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string }): Promise<void> {
    const pattern = item.pattern.trim()
    if (!pattern) return
    await localDb.put('pattern_entry', {
      ...item,
      id: pattern,
      pattern,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    })
  },

  async listPatternEntries(): Promise<PatternEntry[]> {
    return localDb.list<PatternEntry>('pattern_entry')
  },

  async deletePatternEntry(pattern: string): Promise<void> {
    await localDb.delete('pattern_entry', pattern.trim())
  },

  async updatePatternEntryStatus(pattern: string, status: NonNullable<PatternEntry['masteryStatus']>): Promise<void> {
    const id = pattern.trim()
    const entry = await localDb.get<PatternEntry>('pattern_entry', id)
    if (!entry) return
    await localDb.put('pattern_entry', {
      ...entry,
      masteryStatus: status,
      reviewCount: status === 'reviewing' ? (entry.reviewCount ?? 0) + 1 : entry.reviewCount ?? 0,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  },
}

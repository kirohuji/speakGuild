import { localDb } from './local-db'

function includesText(value: unknown, query: string) {
  return typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())
}

export const learningContentRepository = {
  async getVocabulary(wordOrId: string): Promise<any | null> {
    const direct = await localDb.get<any>('vocabularies', wordOrId)
    if (direct) return direct
    const items = await localDb.list<any>('vocabularies')
    return items.find((item) => item.word?.toLowerCase() === wordOrId.toLowerCase()) ?? null
  },

  async searchVocabulary(query: string): Promise<any[]> {
    const items = await localDb.list<any>('vocabularies')
    return items.filter((item) =>
      includesText(item.word, query) ||
      includesText(item.meaning, query) ||
      includesText(item.definitionEn, query),
    )
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
    return localDb.get('chunks', chunkId)
  },

  async searchChunks(query: string): Promise<any[]> {
    const items = await localDb.list<any>('chunks')
    return items.filter((item) =>
      includesText(item.text, query) ||
      includesText(item.meaning, query) ||
      includesText(item.description, query),
    )
  },

  async searchSentencePatterns(query: string): Promise<any[]> {
    const items = await localDb.list<any>('sentence_patterns')
    return items.filter((item) =>
      includesText(item.pattern, query) ||
      includesText(item.meaning, query) ||
      includesText(item.example, query),
    )
  },
}

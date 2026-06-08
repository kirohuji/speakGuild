import { localDb } from './local-db'

function includesText(value: unknown, query: string) {
  return typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())
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
    const all = await this._getAllVocabularies()
    return all.find((item) => item.id === wordOrId || item.word?.toLowerCase() === wordOrId.toLowerCase()) ?? null
  },

  async searchVocabulary(query: string): Promise<any[]> {
    const all = await this._getAllVocabularies()
    return all.filter((item) =>
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
    const details = await localDb.list<any>('downloaded_unit_details')
    const all = details
      .filter((d) => d.chunks && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.chunks ?? []).map((item: any) => ({ ...item, unitId: d.id })))
    return all.filter((item) =>
      includesText(item.text, query) ||
      includesText(item.meaning, query) ||
      includesText(item.description, query),
    )
  },

  async searchSentencePatterns(query: string): Promise<any[]> {
    const details = await localDb.list<any>('downloaded_unit_details')
    const all = details
      .filter((d) => d.sentencePatterns && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.sentencePatterns ?? []).map((item: any) => ({ ...item, unitId: d.id })))
    return all.filter((item) =>
      includesText(item.pattern, query) ||
      includesText(item.meaning, query) ||
      includesText(item.example, query),
    )
  },
}

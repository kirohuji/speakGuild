import { localDb } from './local-db'

function includesText(value: unknown, query: string) {
  return typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export type ExpressionEntryKind = 'word' | 'chunk' | 'pattern'
export type ExpressionEntryStatus = 'learning' | 'reviewing' | 'mastered'

export type ExpressionEntry = {
  id: string
  remoteId?: string | null
  kind: ExpressionEntryKind
  type: 'word' | 'chunk' | 'scene_phrase'
  original?: string | null
  corrected?: string | null
  chunkText?: string | null
  sceneName?: string | null
  masteryStatus: ExpressionEntryStatus
  reviewCount: number
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  sourceType?: string | null
  sourceId?: string | null
  sourceSnapshot?: unknown
  contentSnapshot?: any
  createdAt: string
  updatedAt: string
}

export type WordEntry = ExpressionEntry & { kind: 'word' }
export type ChunkEntry = ExpressionEntry & { kind: 'chunk' }
export type PatternEntry = ExpressionEntry & { kind: 'pattern' }

function normalizeKind(kind: ExpressionEntryKind) {
  return kind
}

function normalizeText(kind: ExpressionEntryKind, text: string) {
  const trimmed = text.trim()
  return kind === 'word' ? trimmed.toLowerCase() : trimmed
}

function entryId(kind: ExpressionEntryKind, text: string) {
  return `${normalizeKind(kind)}:${normalizeText(kind, text)}`
}

function expressionType(kind: ExpressionEntryKind): ExpressionEntry['type'] {
  if (kind === 'word') return 'word'
  if (kind === 'pattern') return 'scene_phrase'
  return 'chunk'
}

function expressionText(entry: Pick<ExpressionEntry, 'kind' | 'original' | 'chunkText' | 'corrected'>) {
  if (entry.kind === 'word') return entry.original ?? ''
  return entry.chunkText ?? entry.corrected ?? ''
}

function makeEntry(input: {
  kind: ExpressionEntryKind
  text: string
  meaning?: string | null
  corrected?: string | null
  sceneName?: string | null
  contentSnapshot?: any
  remoteId?: string | null
  masteryStatus?: ExpressionEntryStatus
  reviewCount?: number
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  sourceType?: string | null
  sourceId?: string | null
  sourceSnapshot?: unknown
  createdAt?: string | null
  updatedAt?: string | null
}): ExpressionEntry {
  const text = normalizeText(input.kind, input.text)
  const now = new Date().toISOString()
  const base = {
    id: entryId(input.kind, text),
    remoteId: input.remoteId ?? null,
    kind: input.kind,
    type: expressionType(input.kind),
    sceneName: input.sceneName ?? null,
    masteryStatus: input.masteryStatus ?? 'learning',
    reviewCount: input.reviewCount ?? 0,
    lastReviewedAt: input.lastReviewedAt ?? null,
    nextReviewAt: input.nextReviewAt ?? null,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    sourceSnapshot: input.sourceSnapshot,
    contentSnapshot: input.contentSnapshot,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }

  if (input.kind === 'word') {
    return {
      ...base,
      original: text,
      corrected: input.corrected ?? null,
      chunkText: input.meaning ?? null,
    }
  }

  if (input.kind === 'pattern') {
    return {
      ...base,
      original: input.meaning ?? null,
      corrected: input.corrected ?? input.contentSnapshot?.example ?? text,
      chunkText: text,
    }
  }

  return {
    ...base,
    original: input.meaning ?? null,
    corrected: input.corrected ?? text,
    chunkText: text,
  }
}

function remoteExpressionToEntry(item: any): ExpressionEntry | null {
  const kind: ExpressionEntryKind =
    item.type === 'word' || !item.type
      ? 'word'
      : item.type === 'scene_phrase'
        ? 'pattern'
        : 'chunk'
  const text = kind === 'word'
    ? String(item.original ?? item.word ?? '').trim()
    : String(item.chunkText ?? item.pattern ?? item.original ?? '').trim()
  if (!text) return null
  return makeEntry({
    kind,
    text,
    meaning: kind === 'word' ? item.chunkText : item.original,
    corrected: item.corrected,
    sceneName: item.sceneName,
    remoteId: item.id,
    masteryStatus: item.masteryStatus ?? 'learning',
    reviewCount: item.reviewCount ?? 0,
    lastReviewedAt: item.lastReviewedAt ?? null,
    nextReviewAt: item.nextReviewAt ?? null,
    sourceType: item.sourceType ?? null,
    sourceId: item.sourceId ?? null,
    sourceSnapshot: item.sourceSnapshot,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
  })
}

export const learningContentRepository = {
  /** 从已下载的学习包中提取词汇数据 */
  async _getAllVocabularies(): Promise<any[]> {
    const details = await localDb.list<any>('downloaded_unit_details')
    return details
      .filter((d) => d.vocabularies && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.vocabularies ?? []).map((item: any) => ({ ...item, unitId: d.id })))
  },

  async getVocabulary(wordOrId: string): Promise<any | null> {
    const localExpression = await this.getExpressionByText('word', wordOrId)
    if (localExpression?.contentSnapshot) return localExpression.contentSnapshot
    const all = await this._getAllVocabularies()
    return all.find((item) => item.id === wordOrId || item.word?.toLowerCase() === wordOrId.toLowerCase()) ?? null
  },

  async searchVocabulary(query: string): Promise<any[]> {
    const expressions = (await this.listExpressionEntries('word'))
      .map((entry) => entry.contentSnapshot ?? {
        id: entry.id,
        word: entry.original,
        meaning: entry.chunkText,
        description: entry.corrected,
        sceneName: entry.sceneName,
      })
    const all = await this._getAllVocabularies()
    return uniqueById([...expressions, ...all]).filter((item) =>
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
    const localExpression = await this.getExpressionByText('chunk', chunkId)
    if (localExpression?.contentSnapshot) return localExpression.contentSnapshot
    const details = await localDb.list<any>('downloaded_unit_details')
    for (const d of details) {
      if (d.chunks) {
        const found = d.chunks.find((item: any) => item.id === chunkId || item.text === chunkId)
        if (found) return { ...found, unitId: d.id }
      }
    }
    return null
  },

  async searchChunks(query: string): Promise<any[]> {
    const expressions = (await this.listExpressionEntries('chunk'))
      .map((entry) => entry.contentSnapshot ?? {
        id: entry.id,
        text: entry.chunkText,
        meaning: entry.original,
        description: entry.corrected,
        sceneName: entry.sceneName,
      })
    const details = await localDb.list<any>('downloaded_unit_details')
    const all = details
      .filter((d) => d.chunks && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.chunks ?? []).map((item: any) => ({ ...item, unitId: d.id })))
    return uniqueById([...expressions, ...all]).filter((item) =>
      includesText(item.text, query) ||
      includesText(item.meaning, query) ||
      includesText(item.description, query),
    )
  },

  async searchSentencePatterns(query: string): Promise<any[]> {
    const expressions = (await this.listExpressionEntries('pattern'))
      .map((entry) => entry.contentSnapshot ?? {
        id: entry.id,
        pattern: entry.chunkText,
        meaning: entry.original,
        example: entry.corrected,
        sceneName: entry.sceneName,
      })
    const details = await localDb.list<any>('downloaded_unit_details')
    const all = details
      .filter((d) => d.sentencePatterns && !d.id.startsWith('topic:'))
      .flatMap((d) => (d.sentencePatterns ?? []).map((item: any) => ({ ...item, id: item.id ?? item.pattern, unitId: d.id })))
    return uniqueById([...expressions, ...all]).filter((item) =>
      includesText(item.pattern, query) ||
      includesText(item.meaning, query) ||
      includesText(item.example, query),
    )
  },

  async saveExpressionEntry(input: Parameters<typeof makeEntry>[0]): Promise<ExpressionEntry> {
    const next = makeEntry(input)
    const existing = await localDb.get<ExpressionEntry>('expression_entries', next.id)
    const entry: ExpressionEntry = {
      ...existing,
      ...next,
      remoteId: next.remoteId ?? existing?.remoteId ?? null,
      contentSnapshot: next.contentSnapshot ?? existing?.contentSnapshot,
      createdAt: existing?.createdAt ?? next.createdAt,
      updatedAt: new Date().toISOString(),
    }
    await localDb.put('expression_entries', entry)
    return entry
  },

  async saveRemoteExpressionEntry(item: any): Promise<ExpressionEntry | null> {
    const next = remoteExpressionToEntry(item)
    if (!next) return null
    const existing = await localDb.get<ExpressionEntry>('expression_entries', next.id)
    const entry = {
      ...existing,
      ...next,
      contentSnapshot: existing?.contentSnapshot ?? next.contentSnapshot,
      createdAt: existing?.createdAt ?? next.createdAt,
      updatedAt: next.updatedAt,
    }
    await localDb.put('expression_entries', entry)
    return entry
  },

  async listExpressionEntries(kind?: ExpressionEntryKind): Promise<ExpressionEntry[]> {
    const entries = await localDb.list<ExpressionEntry>('expression_entries')
    return kind ? entries.filter((entry) => entry.kind === kind) : entries
  },

  async getExpressionByText(kind: ExpressionEntryKind, text: string): Promise<ExpressionEntry | null> {
    return localDb.get<ExpressionEntry>('expression_entries', entryId(kind, text))
  },

  async deleteExpressionByText(kind: ExpressionEntryKind, text: string): Promise<void> {
    await localDb.delete('expression_entries', entryId(kind, text))
  },

  async deleteExpressionByRemoteId(remoteId: string): Promise<void> {
    const entries = await localDb.list<ExpressionEntry>('expression_entries')
    const match = entries.find((entry) => entry.remoteId === remoteId)
    if (match) await localDb.delete('expression_entries', match.id)
  },

  async updateExpressionStatus(kind: ExpressionEntryKind, text: string, status: ExpressionEntryStatus): Promise<void> {
    const id = entryId(kind, text)
    const entry = await localDb.get<ExpressionEntry>('expression_entries', id)
    if (!entry) return
    await localDb.put('expression_entries', {
      ...entry,
      masteryStatus: status,
      reviewCount: status === 'reviewing' ? (entry.reviewCount ?? 0) + 1 : entry.reviewCount ?? 0,
      lastReviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  },

  expressionText,
}

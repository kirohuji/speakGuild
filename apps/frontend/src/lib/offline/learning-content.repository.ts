import { localDb } from './unified-storage'
import { expressionApi } from '@/features/practice/api/english-practice-api'
import { syncOutbox, type SyncEntityType } from './sync-outbox'

function includesText(value: unknown, query: string) {
  return typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function normalizeIndexText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function patternId(item: any) {
  return String(item?.id ?? item?.pattern ?? item?.text ?? '').trim()
}

function topicPayload(value: any) {
  return value?.detail ?? value
}

export type ExpressionEntryKind = 'word' | 'chunk' | 'pattern'

export type ExpressionEntry = {
  id: string
  remoteId?: string | null
  syncStatus?: 'pending' | 'synced' | 'failed'
  kind: ExpressionEntryKind
  type: 'word' | 'chunk' | 'scene_phrase'
  original?: string | null
  corrected?: string | null
  chunkText?: string | null
  sceneName?: string | null
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

function expressionEntityType(kind: ExpressionEntryKind): SyncEntityType {
  if (kind === 'word') return 'word_entry'
  if (kind === 'pattern') return 'pattern_entry'
  return 'chunk_entry'
}

function makeEntry(input: {
  kind: ExpressionEntryKind
  text: string
  meaning?: string | null
  corrected?: string | null
  sceneName?: string | null
  contentSnapshot?: any
  remoteId?: string | null
  sourceType?: string | null
  sourceId?: string | null
  sourceSnapshot?: unknown
  createdAt?: string | null
  updatedAt?: string | null
  syncStatus?: ExpressionEntry['syncStatus']
}): ExpressionEntry {
  const text = normalizeText(input.kind, input.text)
  const now = new Date().toISOString()
  const base = {
    id: entryId(input.kind, text),
    remoteId: input.remoteId ?? null,
    syncStatus: input.syncStatus ?? (input.remoteId ? 'synced' : 'pending'),
    kind: input.kind,
    type: expressionType(input.kind),
    sceneName: input.sceneName ?? null,
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

  // 保留远程返回的完整内容数据：word→vocabulary, chunk→contentData, pattern→contentData
  const vocabSnapshot = item.vocabulary ?? item.contentData ?? item.contentSnapshot

  const entry = makeEntry({
    kind,
    text,
    meaning: kind === 'word' ? item.chunkText : item.original,
    corrected: item.corrected,
    sceneName: item.sceneName,
    contentSnapshot: vocabSnapshot,
    remoteId: item.id,
    sourceType: item.sourceType ?? null,
    sourceId: item.sourceId ?? null,
    sourceSnapshot: item.sourceSnapshot,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    syncStatus: 'synced',
  })

  if (kind === 'word') {
    console.log(
      '[remoteExpressionToEntry]',
      `word=${text}`,
      `hasVocab=${!!item.vocabulary}`,
      `snapshotKeys=${vocabSnapshot ? Object.keys(vocabSnapshot).join(',') : 'none'}`,
      `hasDescription=${!!vocabSnapshot?.description}`,
      `hasExamples=${Array.isArray(vocabSnapshot?.examples) ? vocabSnapshot.examples.length : 0}`,
    )
  }

  return entry
}

function createPayload(entry: ExpressionEntry) {
  if (entry.kind === 'word') {
    return { word: entry.original ?? '', addedAt: new Date().toISOString() }
  }
  if (entry.kind === 'pattern') {
    return {
      pattern: entry.chunkText ?? '',
      meaning: entry.original,
      example: entry.corrected,
      sceneName: entry.sceneName,
    }
  }
  return {
    chunkText: entry.chunkText ?? '',
    original: entry.original,
    sceneName: entry.sceneName,
  }
}

function createRequest(entry: ExpressionEntry) {
  if (entry.kind === 'word') {
    return {
      type: 'word' as const,
      chunkText: entry.chunkText ?? '',
      original: entry.original ?? '',
      sceneName: entry.sceneName ?? undefined,
    }
  }
  if (entry.kind === 'pattern') {
    return {
      type: 'scene_phrase' as const,
      chunkText: entry.chunkText ?? '',
      corrected: entry.corrected ?? entry.chunkText ?? '',
      original: entry.original ?? '',
      sceneName: entry.sceneName ?? undefined,
    }
  }
  return {
    type: 'chunk' as const,
    chunkText: entry.chunkText ?? '',
    corrected: entry.corrected ?? entry.chunkText ?? '',
    original: entry.original ?? '',
    sceneName: entry.sceneName ?? undefined,
  }
}

export const learningContentRepository = {
  async savePackContentIndex(packId: string, unitId: string, unitDetail: any, topicDetails: any[]): Promise<void> {
    const vocabById = new Map<string, any>()
    const chunkById = new Map<string, any>()
    const patternById = new Map<string, any>()
    const refs: Array<{
      id: string
      kind: 'vocab' | 'chunk' | 'pattern'
      contentId: string
      packId: string
      unitId: string
      topicId: string | null
      createdAt: string
    }> = []
    const now = new Date().toISOString()

    for (const raw of topicDetails ?? []) {
      const detail = topicPayload(raw)
      const topicId = detail?.topic?.id ?? raw?.topicId ?? null

      for (const vocab of detail?.vocabularies ?? []) {
        if (!vocab?.id) continue
        vocabById.set(vocab.id, vocab)
        refs.push({ id: `vocab:${vocab.id}:${packId}:${topicId ?? 'unit'}`, kind: 'vocab', contentId: vocab.id, packId, unitId, topicId, createdAt: now })
      }

      for (const chunk of detail?.activeChunks ?? detail?.chunks ?? []) {
        if (!chunk?.id) continue
        chunkById.set(chunk.id, chunk)
        refs.push({ id: `chunk:${chunk.id}:${packId}:${topicId ?? 'unit'}`, kind: 'chunk', contentId: chunk.id, packId, unitId, topicId, createdAt: now })
      }

      for (const pattern of detail?.sentencePatterns ?? []) {
        const id = patternId(pattern)
        if (!id) continue
        patternById.set(id, { ...pattern, id })
        refs.push({ id: `pattern:${id}:${packId}:${topicId ?? 'unit'}`, kind: 'pattern', contentId: id, packId, unitId, topicId, createdAt: now })
      }
    }

    for (const vocab of unitDetail?.vocabularies ?? []) {
      if (vocab?.id) vocabById.set(vocab.id, vocab)
    }
    for (const chunk of unitDetail?.chunks ?? []) {
      if (chunk?.id) chunkById.set(chunk.id, chunk)
    }
    for (const pattern of unitDetail?.sentencePatterns ?? []) {
      const id = patternId(pattern)
      if (id) patternById.set(id, { ...pattern, id })
    }

    console.log(`[content-index] 📊 索引统计: ${vocabById.size} 词汇, ${chunkById.size} 语块, ${patternById.size} 句型, ${refs.length} 引用记录`)

    // 并行写入三个内容表，refs 量最大放在最后
    await Promise.all([
      localDb.putMany('offline_vocabularies', [...vocabById.values()].map((item: any) => ({
        id: item.id,
        word: item.word ?? item.text ?? '',
        normalizedText: normalizeIndexText(item.word ?? item.text ?? item.id),
        data: item,
        updatedAt: now,
      }))),
      localDb.putMany('offline_chunks', [...chunkById.values()].map((item: any) => ({
        id: item.id,
        text: item.text ?? '',
        normalizedText: normalizeIndexText(item.text ?? item.id),
        data: item,
        updatedAt: now,
      }))),
      localDb.putMany('offline_patterns', [...patternById.values()].map((item: any) => ({
        id: item.id,
        pattern: item.pattern ?? item.text ?? '',
        normalizedText: normalizeIndexText(item.pattern ?? item.text ?? item.id),
        data: item,
        updatedAt: now,
      }))),
    ])
    console.log(`[content-index] ✅ offline_vocabularies: ${vocabById.size} 条, offline_chunks: ${chunkById.size} 条, offline_patterns: ${patternById.size} 条`)

    await localDb.putMany('offline_content_refs', refs)
    console.log(`[content-index] ✅ offline_content_refs: ${refs.length} 条`)
  },

  async removePackContentIndex(packId: string): Promise<void> {
    const allRefs = await localDb.list<{ id: string; kind: 'vocab' | 'chunk' | 'pattern'; contentId: string; packId: string }>('offline_content_refs')
    const refs = allRefs.filter((ref) => ref.packId === packId)
    if (refs.length === 0) return

    const keyOf = (ref: { kind: string; contentId: string }) => `${ref.kind}\u0000${ref.contentId}`
    const remainingKeys = new Set(
      allRefs
        .filter((ref) => ref.packId !== packId)
        .map(keyOf),
    )
    const orphanIds = {
      vocab: new Set<string>(),
      chunk: new Set<string>(),
      pattern: new Set<string>(),
    }

    for (const ref of refs) {
      if (!remainingKeys.has(keyOf(ref))) {
        orphanIds[ref.kind].add(ref.contentId)
      }
    }

    await localDb.deleteWhere<any>('offline_content_refs', (ref) => ref.packId === packId)
    await localDb.deleteWhere<any>('offline_vocabularies', (item) => orphanIds.vocab.has(String(item.id)))
    await localDb.deleteWhere<any>('offline_chunks', (item) => orphanIds.chunk.has(String(item.id)))
    await localDb.deleteWhere<any>('offline_patterns', (item) => orphanIds.pattern.has(String(item.id)))
  },

  /** 从已下载的学习包中提取词汇数据 */
  async _getAllVocabularies(): Promise<any[]> {
    const indexed = await localDb.list<any>('offline_vocabularies')
    if (indexed.length > 0) return indexed.map((item) => ({ ...item.data, id: item.id }))

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
    const indexed = await localDb.list<any>('offline_chunks')
    const all = indexed.length > 0
      ? indexed.map((item) => ({ ...item.data, id: item.id }))
      : (await localDb.list<any>('downloaded_unit_details'))
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
    const indexed = await localDb.list<any>('offline_patterns')
    const all = indexed.length > 0
      ? indexed.map((item) => ({ ...item.data, id: item.id }))
      : (await localDb.list<any>('downloaded_unit_details'))
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
      syncStatus: next.syncStatus ?? existing?.syncStatus ?? 'pending',
      contentSnapshot: next.contentSnapshot ?? existing?.contentSnapshot,
      createdAt: existing?.createdAt ?? next.createdAt,
      updatedAt: new Date().toISOString(),
    }
    await localDb.put('expression_entries', entry)
    return entry
  },

  async saveExpressionEntryAndSync(
    input: Parameters<typeof makeEntry>[0] & { notebookIds: string[] },
  ): Promise<ExpressionEntry> {
    const entry = await this.saveExpressionEntry(input)
    const text = expressionText(entry)
    const outboxItem = await syncOutbox.enqueue({
      entityType: expressionEntityType(entry.kind),
      entityId: text,
      operation: 'create',
      payload: { ...createPayload(entry), notebookIds: input.notebookIds },
    })
    try {
      const created = await expressionApi.create({
        ...createRequest(entry),
        notebookIds: input.notebookIds,
      })
      await this.saveRemoteExpressionEntry(created)
      await syncOutbox.markSynced(outboxItem.id)
    } catch (error) {
      await syncOutbox.markFailed(outboxItem.id, error)
      await this.markExpressionSyncStatus(entry.kind, text, 'failed')
    }
    return entry
  },

  async saveRemoteExpressionEntry(item: any): Promise<ExpressionEntry | null> {
    const next = remoteExpressionToEntry(item)
    if (!next) return null
    const existing = await localDb.get<ExpressionEntry>('expression_entries', next.id)
    // 远程数据优先（尤其是 contentSnapshot），本地只作为兜底
    const entry: ExpressionEntry = {
      ...existing,
      ...next,
      contentSnapshot: next.contentSnapshot ?? existing?.contentSnapshot,
      createdAt: existing?.createdAt ?? next.createdAt,
      updatedAt: next.updatedAt,
      syncStatus: 'synced',
    }
    console.log(
      '[saveRemoteExpressionEntry]',
      `id=${entry.id}`,
      `hasContentSnapshot=${!!entry.contentSnapshot}`,
      `snapshotKeys=${entry.contentSnapshot ? Object.keys(entry.contentSnapshot).join(',') : 'none'}`,
    )
    await localDb.put('expression_entries', entry)
    return entry
  },

  async clearExpressionCacheMarkers(): Promise<void> {
    await localDb.deleteWhere<any>('kv', (item) =>
      typeof item.id === 'string' && item.id.startsWith('expression-cache:'),
    )
  },

  async listExpressionEntries(kind?: ExpressionEntryKind): Promise<ExpressionEntry[]> {
    const entries = await localDb.list<ExpressionEntry>('expression_entries')
    return kind ? entries.filter((entry) => entry.kind === kind) : entries
  },

  async listExpressionTexts(kind: ExpressionEntryKind): Promise<string[]> {
    const entries = await this.listExpressionEntries(kind)
    return entries.map(expressionText).filter(Boolean)
  },

  async getExpressionByText(kind: ExpressionEntryKind, text: string): Promise<ExpressionEntry | null> {
    return localDb.get<ExpressionEntry>('expression_entries', entryId(kind, text))
  },

  async markExpressionSyncStatus(
    kind: ExpressionEntryKind,
    text: string,
    syncStatus: NonNullable<ExpressionEntry['syncStatus']>,
  ): Promise<void> {
    const entry = await this.getExpressionByText(kind, text)
    if (!entry) return
    await localDb.put('expression_entries', {
      ...entry,
      syncStatus,
      updatedAt: new Date().toISOString(),
    })
  },

  async deleteExpressionByText(kind: ExpressionEntryKind, text: string): Promise<void> {
    await localDb.delete('expression_entries', entryId(kind, text))
  },

  async deleteExpressionByRemoteId(remoteId: string): Promise<void> {
    const matches = await localDb.findByIndex<ExpressionEntry>('expression_entries', 'remote_id', remoteId)
    const match = matches[0]
    if (match) await localDb.delete('expression_entries', match.id)
  },

  expressionText,
}

import { localDb } from './unified-storage'
import { expressionApi } from '@/features/practice/api/english-practice-api'
import { syncOutbox, type SyncEntityType } from './sync-outbox'

function includesText(value: unknown, query: string) {
  return typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())
}

function richerContent(current: any, incoming: any) {
  if (!incoming) return current ?? null
  if (!current) return incoming
  return contentScore(incoming) > contentScore(current) ? incoming : current
}

function indexPackContent(items: any[], textField: string) {
  const byId = new Map<string, any>()
  const byText = new Map<string, any>()
  for (const item of items) {
    const id = String(item?.id ?? '')
    const text = normalizeIndexText(item?.[textField])
    if (id) byId.set(id, richerContent(byId.get(id), item))
    if (text) byText.set(text, richerContent(byText.get(text), item))
  }
  return { byId, byText }
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const map = new Map<string, T>()
  for (const item of items) {
    const existing = map.get(item.id)
    map.set(item.id, existing && contentScore(existing) > contentScore(item) ? existing : item)
  }
  return [...map.values()]
}

function normalizeIndexText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasExamples(value: unknown) {
  if (hasText(value)) return true
  return Array.isArray(value) && value.length > 0
}

function bareContentId(value: unknown) {
  return String(value ?? '').trim().replace(/^(word|chunk|pattern):/, '')
}

function contentScore(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return 0
  const record = snapshot as Record<string, unknown>
  let score = 0
  if (hasText(record.meaning)) score += 2
  if (hasText(record.description)) score += 2
  if (hasText(record.definitionEn)) score += 1
  if (hasText(record.example)) score += 2
  if (hasExamples(record.examples)) score += 4 + (Array.isArray(record.examples) ? record.examples.length : 1)
  if (hasText(record.phoneticUs) || hasText(record.phoneticUk)) score += 1
  if (hasText(record.audioUsUrl) || hasText(record.audioUkUrl)) score += 1
  return score
}

const SNAPSHOT_FIELDS = [
  'word', 'text', 'pattern', 'meaning', 'description', 'definitionEn', 'partOfSpeech',
  'phoneticUs', 'phoneticUk', 'audioUsUrl', 'audioUkUrl', 'difficulty', 'example', 'slots',
] as const

/** 以更完整的一份为底，只用另一份补上仍为空的释义、例句和发音。 */
function mergeContentSnapshot(current: any, incoming: any) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return current ?? null
  if (!current || typeof current !== 'object' || Array.isArray(current)) return { ...incoming }
  const [base, extra] = contentScore(incoming) > contentScore(current) ? [incoming, current] : [current, incoming]
  const merged = { ...base }
  for (const field of SNAPSHOT_FIELDS) {
    if (!hasText(merged[field]) && hasText(extra[field])) merged[field] = extra[field]
  }
  if (!hasExamples(merged.examples) && hasExamples(extra.examples)) merged.examples = extra.examples
  if ((!Array.isArray(merged.synonyms) || merged.synonyms.length === 0) && Array.isArray(extra.synonyms) && extra.synonyms.length > 0) {
    merged.synonyms = extra.synonyms
  }
  return merged
}

function keepText(next?: string | null, previous?: string | null) {
  return hasText(next) ? next : (hasText(previous) ? previous : (next ?? previous ?? null))
}

function installedContentBody(row: any) {
  let body = row?.data && typeof row.data === 'object' ? row.data : row
  if (
    body?.data && typeof body.data === 'object'
    && !hasText(body.meaning) && !hasExamples(body.examples) && !hasText(body.text) && !hasText(body.pattern)
  ) {
    body = body.data
  }
  return body && typeof body === 'object' ? { ...body, id: row?.id ?? body.id } : null
}

const INSTALLED_CONTENT_TABLE = {
  word: 'offline_vocabularies',
  chunk: 'offline_chunks',
  pattern: 'offline_patterns',
} as const

const INSTALLED_TEXT_FIELD = { word: 'word', chunk: 'text', pattern: 'pattern' } as const

function patternId(item: any) {
  return String(item?.id ?? item?.pattern ?? item?.text ?? '').trim()
}

function topicPayload(value: any) {
  return value?.detail ?? value
}

export type ExpressionEntryKind = 'word' | 'chunk' | 'pattern'

/** 通知仍打开的内容页重新读取“已收录”状态。 */
export const LEARNING_LIBRARY_CHANGED_EVENT = 'learning-library-changed'

export function notifyLearningLibraryChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LEARNING_LIBRARY_CHANGED_EVENT))
  }
}

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
    sourceSnapshot: input.sourceSnapshot ?? input.contentSnapshot,
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

  // 词库行、内容详情和收藏时保存的 sourceSnapshot 各自可能缺字段，合并后保留更完整的一份。
  const vocabSnapshot = [item.sourceSnapshot, item.contentData, item.vocabulary]
    .reduce((snapshot, candidate) => mergeContentSnapshot(snapshot, candidate), null)

  const entry = makeEntry({
    kind,
    text,
    meaning: kind === 'word' ? keepText(item.chunkText, vocabSnapshot?.meaning) : item.original,
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
  const source = {
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    sourceSnapshot: entry.sourceSnapshot,
  }
  if (entry.kind === 'word') {
    return {
      word: entry.original ?? '',
      meaning: keepText(entry.chunkText, entry.contentSnapshot?.meaning) ?? '',
      addedAt: new Date().toISOString(),
      ...source,
    }
  }
  if (entry.kind === 'pattern') {
    return {
      pattern: entry.chunkText ?? '',
      meaning: keepText(entry.original, entry.contentSnapshot?.meaning),
      example: keepText(entry.corrected, entry.contentSnapshot?.example),
      sceneName: entry.sceneName,
      ...source,
    }
  }
  return {
    chunkText: entry.chunkText ?? '',
    original: keepText(entry.original, entry.contentSnapshot?.meaning),
    sceneName: entry.sceneName,
    ...source,
  }
}

function createRequest(entry: ExpressionEntry) {
  const source = {
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    sourceSnapshot: entry.sourceSnapshot,
  }
  if (entry.kind === 'word') {
    return {
      type: 'word' as const,
      chunkText: keepText(entry.chunkText, entry.contentSnapshot?.meaning) ?? '',
      original: entry.original ?? '',
      sceneName: entry.sceneName ?? undefined,
      ...source,
    }
  }
  if (entry.kind === 'pattern') {
    return {
      type: 'scene_phrase' as const,
      chunkText: entry.chunkText ?? '',
      corrected: keepText(entry.corrected, entry.contentSnapshot?.example) ?? entry.chunkText ?? '',
      original: keepText(entry.original, entry.contentSnapshot?.meaning) ?? '',
      sceneName: entry.sceneName ?? undefined,
      ...source,
    }
  }
  return {
    type: 'chunk' as const,
    chunkText: entry.chunkText ?? '',
    corrected: entry.corrected ?? entry.chunkText ?? '',
    original: keepText(entry.original, entry.contentSnapshot?.meaning) ?? '',
    sceneName: entry.sceneName ?? undefined,
    ...source,
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
      sortOrder: number
      createdAt: string
    }> = []
    const now = new Date().toISOString()
    let sortOrder = 0
    const pushRef = (kind: 'vocab' | 'chunk' | 'pattern', contentId: string, topicId: string | null) => {
      refs.push({
        id: `${kind}:${contentId}:${packId}:${topicId ?? 'unit'}`,
        kind,
        contentId,
        packId,
        unitId,
        topicId,
        sortOrder: sortOrder++,
        createdAt: now,
      })
    }

    for (const raw of topicDetails ?? []) {
      const detail = topicPayload(raw)
      const topicId = detail?.topic?.id ?? raw?.topicId ?? null

      for (const vocab of detail?.vocabularies ?? []) {
        if (!vocab?.id) continue
        vocabById.set(vocab.id, vocab)
        pushRef('vocab', vocab.id, topicId)
      }

      for (const chunk of detail?.activeChunks ?? detail?.chunks ?? []) {
        if (!chunk?.id) continue
        chunkById.set(chunk.id, chunk)
        pushRef('chunk', chunk.id, topicId)
      }

      for (const pattern of detail?.sentencePatterns ?? []) {
        const id = patternId(pattern)
        if (!id) continue
        patternById.set(id, { ...pattern, id })
        pushRef('pattern', id, topicId)
      }
    }

    const referenced = new Set(refs.map((ref) => `${ref.kind}:${ref.contentId}`))
    for (const vocab of unitDetail?.vocabularies ?? []) {
      if (!vocab?.id) continue
      vocabById.set(vocab.id, vocab)
      if (!referenced.has(`vocab:${vocab.id}`)) pushRef('vocab', vocab.id, null)
    }
    for (const chunk of unitDetail?.chunks ?? []) {
      if (!chunk?.id) continue
      chunkById.set(chunk.id, chunk)
      if (!referenced.has(`chunk:${chunk.id}`)) pushRef('chunk', chunk.id, null)
    }
    for (const pattern of unitDetail?.sentencePatterns ?? []) {
      const id = patternId(pattern)
      if (!id) continue
      patternById.set(id, { ...pattern, id })
      if (!referenced.has(`pattern:${id}`)) pushRef('pattern', id, null)
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

    // 收藏按稳定的内容 ID 跟随已安装学习包的新版内容。
    const sourceItems = new Map<string, any>()
    const sourceByText = new Map<string, any>()
    const remember = (kind: ExpressionEntryKind, item: any, text: unknown) => {
      const id = bareContentId(item?.id)
      if (id) sourceItems.set(`${kind}:${id}`, richerContent(sourceItems.get(`${kind}:${id}`), item))
      const normalized = normalizeIndexText(text)
      if (normalized) sourceByText.set(`${kind}:${normalized}`, richerContent(sourceByText.get(`${kind}:${normalized}`), item))
    }
    for (const item of vocabById.values()) remember('word', item, item.word ?? item.text)
    for (const item of chunkById.values()) remember('chunk', item, item.text)
    for (const item of patternById.values()) remember('pattern', item, item.pattern ?? item.text)
    const entries = await localDb.list<ExpressionEntry>('expression_entries')
    const refreshed = entries
      .map((entry) => {
        const sourceId = bareContentId(entry.sourceId) || bareContentId(entry.contentSnapshot?.id)
        const snapshot = richerContent(
          sourceId ? sourceItems.get(`${entry.kind}:${sourceId}`) : null,
          sourceByText.get(`${entry.kind}:${normalizeIndexText(expressionText(entry))}`),
        )
        if (!snapshot) return null
        const contentSnapshot = mergeContentSnapshot(entry.contentSnapshot, snapshot)
        const chunkText = entry.kind === 'word' ? keepText(entry.chunkText, contentSnapshot?.meaning) : entry.chunkText
        const original = entry.kind === 'word' ? entry.original : keepText(entry.original, contentSnapshot?.meaning)
        const improved = contentScore(contentSnapshot) > contentScore(entry.contentSnapshot)
          || chunkText !== entry.chunkText
          || original !== entry.original
        return improved
          ? {
              ...entry,
              contentSnapshot,
              sourceSnapshot: mergeContentSnapshot(entry.sourceSnapshot, snapshot),
              chunkText,
              original,
              updatedAt: now,
            }
          : null
      })
      .filter(Boolean) as ExpressionEntry[]
    if (refreshed.length > 0) {
      await localDb.putMany('expression_entries', refreshed)
      console.log(`[content-index] 🔄 已更新 ${refreshed.length} 条收藏快照`)
    }
  },

  async removePackContentIndex(packId: string): Promise<void> {
    const refs = await localDb.findByIndex<{ id: string; kind: 'vocab' | 'chunk' | 'pattern'; contentId: string; packId: string }>(
      'offline_content_refs',
      'pack_id',
      packId,
    )
    if (refs.length === 0) return

    const keyOf = (ref: { kind: string; contentId: string }) => `${ref.kind}\u0000${ref.contentId}`
    const remainingKeys = new Set<string>()
    const uniqueContentIds = [...new Set(refs.map((ref) => ref.contentId))]
    for (let index = 0; index < uniqueContentIds.length; index += 50) {
      const matches = await localDb.findByIndexIn<typeof refs[number]>(
        'offline_content_refs',
        'content_id',
        uniqueContentIds.slice(index, index + 50),
      )
      for (const ref of matches) {
        if (ref.packId !== packId) remainingKeys.add(keyOf(ref))
      }
    }
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

    await localDb.deleteByIndex('offline_content_refs', 'pack_id', packId)
    for (const id of orphanIds.vocab) await localDb.delete('offline_vocabularies', id)
    for (const id of orphanIds.chunk) await localDb.delete('offline_chunks', id)
    for (const id of orphanIds.pattern) await localDb.delete('offline_patterns', id)
  },

  /** 从已下载的学习包中提取词汇数据 */
  async _getAllVocabularies(): Promise<any[]> {
    const indexed = await localDb.list<any>('offline_vocabularies')
    return indexed.map((item) => installedContentBody(item)).filter(Boolean)
  },

  async getVocabulary(wordOrId: string): Promise<any | null> {
    const localExpression = await this.getExpressionByText('word', wordOrId)
    const pack = await this.findInstalledContent('word', localExpression?.sourceId || wordOrId, localExpression?.original || wordOrId)
    return mergeContentSnapshot(localExpression?.contentSnapshot, pack)
  },

  /**
   * 学习库只保存收藏关系。展示时从已下载学习包补齐释义、例句和发音，
   * 和播放时从学习包取出音频是同一条路，不改写收藏记录。
   */
  async hydrateExpressionSnapshots<T extends ExpressionEntry>(entries: T[]): Promise<T[]> {
    if (entries.length === 0) return entries
    const wanted = {
      word: { ids: new Set<string>(), texts: new Set<string>() },
      chunk: { ids: new Set<string>(), texts: new Set<string>() },
      pattern: { ids: new Set<string>(), texts: new Set<string>() },
    }
    for (const entry of entries) {
      const id = bareContentId(entry.sourceId) || bareContentId(entry.contentSnapshot?.id)
      const text = normalizeIndexText(expressionText(entry))
      if (id) wanted[entry.kind].ids.add(id)
      if (text) wanted[entry.kind].texts.add(text)
    }

    const loaded = await Promise.all((['word', 'chunk', 'pattern'] as const).map(async (kind) => {
      const request = wanted[kind]
      const byId = new Map<string, any>()
      const byText = new Map<string, any>()
      if (request.ids.size === 0 && request.texts.size === 0) return { byId, byText }
      const [idRows, textRows] = await Promise.all([
        request.ids.size > 0 ? localDb.findByIndexIn<any>(INSTALLED_CONTENT_TABLE[kind], 'id', [...request.ids]) : Promise.resolve([]),
        request.texts.size > 0 ? localDb.findByIndexIn<any>(INSTALLED_CONTENT_TABLE[kind], 'normalized_text', [...request.texts]) : Promise.resolve([]),
      ])
      for (const row of [...idRows, ...textRows]) {
        const body = installedContentBody(row)
        if (!body) continue
        const id = bareContentId(row?.id ?? body.id)
        const text = normalizeIndexText(body[INSTALLED_TEXT_FIELD[kind]] ?? row?.[INSTALLED_TEXT_FIELD[kind]] ?? row?.normalizedText)
        if (id) byId.set(id, richerContent(byId.get(id), body))
        if (text) byText.set(text, richerContent(byText.get(text), body))
      }
      return { byId, byText }
    }))
    const packByKind = { word: loaded[0]!, chunk: loaded[1]!, pattern: loaded[2]! }

    return entries.map((entry) => {
      const packs = packByKind[entry.kind]
      const id = bareContentId(entry.sourceId) || bareContentId(entry.contentSnapshot?.id)
      const text = normalizeIndexText(expressionText(entry))
      const pack = richerContent(id ? packs.byId.get(id) : null, text ? packs.byText.get(text) : null)
      if (!pack) return entry
      const contentSnapshot = mergeContentSnapshot(entry.contentSnapshot, pack)
      return {
        ...entry,
        contentSnapshot,
        chunkText: entry.kind === 'word' ? keepText(entry.chunkText, contentSnapshot?.meaning) : entry.chunkText,
        original: entry.kind === 'word' ? entry.original : keepText(entry.original, contentSnapshot?.meaning),
      }
    })
  },

  async findInstalledContent(kind: ExpressionEntryKind, sourceId?: string | null, text?: string | null): Promise<any | null> {
    const id = bareContentId(sourceId)
    const normalized = normalizeIndexText(text)
    const [idRows, textRows] = await Promise.all([
      id ? localDb.findByIndexIn<any>(INSTALLED_CONTENT_TABLE[kind], 'id', [id]) : Promise.resolve([]),
      normalized ? localDb.findByIndex<any>(INSTALLED_CONTENT_TABLE[kind], 'normalized_text', normalized) : Promise.resolve([]),
    ])
    return [...idRows, ...textRows]
      .map((row) => installedContentBody(row))
      .reduce((best, body) => richerContent(best, body), null)
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
    const { byId: packById, byText: packByText } = indexPackContent(all, 'word')
    const merged = expressions.map((item) => mergeContentSnapshot(
      item,
      packById.get(bareContentId(item.id)) ?? packByText.get(normalizeIndexText(item.word)),
    ))
    return uniqueById([...merged, ...all]).filter((item) =>
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
    const pack = await this.findInstalledContent('chunk', localExpression?.sourceId || chunkId, localExpression?.chunkText || chunkId)
    return mergeContentSnapshot(localExpression?.contentSnapshot, pack)
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
    const all = indexed.map((item) => installedContentBody(item)).filter(Boolean)
    const { byId: packById, byText: packByText } = indexPackContent(all, 'text')
    const merged = expressions.map((item) => mergeContentSnapshot(
      item,
      packById.get(bareContentId(item.id)) ?? packByText.get(normalizeIndexText(item.text)),
    ))
    return uniqueById([...merged, ...all]).filter((item) =>
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
    const all = indexed.map((item) => installedContentBody(item)).filter(Boolean)
    const { byId: packById, byText: packByText } = indexPackContent(all, 'pattern')
    const merged = expressions.map((item) => mergeContentSnapshot(
      item,
      packById.get(bareContentId(item.id)) ?? packByText.get(normalizeIndexText(item.pattern)),
    ))
    return uniqueById([...merged, ...all]).filter((item) =>
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
      original: keepText(next.original, existing?.original),
      corrected: keepText(next.corrected, existing?.corrected),
      chunkText: keepText(next.chunkText, existing?.chunkText),
      contentSnapshot: mergeContentSnapshot(existing?.contentSnapshot, next.contentSnapshot),
      sourceSnapshot: mergeContentSnapshot(existing?.sourceSnapshot, next.sourceSnapshot),
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
    await localDb.putMany('learning_notebook_items', input.notebookIds.map((notebookId) => ({
      id: `local:${notebookId}:${entry.id}`,
      remoteId: null,
      notebookId,
      expressionEntryId: entry.id,
      masteryStatus: 'learning',
      reviewCount: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      lapseCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      syncStatus: entry.syncStatus ?? 'pending',
    })))
    notifyLearningLibraryChanged()
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
    const contentSnapshot = mergeContentSnapshot(existing?.contentSnapshot, next.contentSnapshot)
    const entry: ExpressionEntry = {
      ...existing,
      ...next,
      original: keepText(next.original, existing?.original),
      corrected: keepText(next.corrected, existing?.corrected),
      chunkText: keepText(next.chunkText, existing?.chunkText),
      contentSnapshot,
      sourceSnapshot: mergeContentSnapshot(existing?.sourceSnapshot, next.sourceSnapshot),
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
    const [entries, notebookItems] = await Promise.all([
      this.listExpressionEntries(kind),
      localDb.list<{ expressionEntryId: string }>('learning_notebook_items'),
    ])
    const savedEntryIds = new Set(notebookItems.map((item) => item.expressionEntryId))
    return entries
      .filter((entry) => savedEntryIds.has(entry.id))
      .map(expressionText)
      .filter(Boolean)
  },

  async isExpressionSaved(kind: ExpressionEntryKind, text: string): Promise<boolean> {
    const entry = await this.getExpressionByText(kind, text)
    if (!entry) return false
    const notebookItems = await localDb.list<{ expressionEntryId: string }>('learning_notebook_items')
    return notebookItems.some((item) => item.expressionEntryId === entry.id)
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

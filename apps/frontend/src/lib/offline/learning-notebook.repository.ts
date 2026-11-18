import { type LearningNotebook } from '@/features/practice/api/english-practice-api'
import { notebookMutation, commitNotebookMutation, serializeNotebookWrite } from './notebook-mutations'
import { createId } from './utils'
import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import { createPayload } from './learning-content.repository'
import { localDb } from './unified-storage'
import { learningContentRepository, type ExpressionEntry } from './learning-content.repository'
import type { InsightListItem } from './insight-playlist'
import { insightListDiag } from './insight-list-diag'
import { expressionDisplayTitle, hasExpressionTitle } from './playlist-window'

type NotebookCounts = {
  total: number
  word: number
  chunk: number
  pattern: number
}

type NotebookListResult = {
  items: LearningNotebook[]
  allCounts: NotebookCounts
}

export type LocalExpressionListRequest = {
  notebookId: string
  type: 'word' | 'chunk' | 'scene_phrase'
  reviewState?: string
  search?: string
  sort?: 'newest' | 'oldest'
}

type CachedNotebookItem = {
  id: string
  remoteId?: string | null
  notebookId: string
  expressionEntryId: string
  masteryStatus: string
  reviewCount: number
  intervalDays: number
  easeFactor?: number | null
  lapseCount: number
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  syncStatus: 'pending' | 'synced' | 'failed'
}

export type LocalNotebookExpression = ExpressionEntry & {
  notebookItemId: string
  notebookId: string
  masteryStatus: string
  reviewCount: number
  intervalDays: number
  easeFactor?: number | null
  lapseCount: number
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  vocabulary?: unknown
  contentData?: unknown
}

export type LocalExpressionPageResult = {
  items: LocalNotebookExpression[]
  total: number
}

export type LocalExpressionLeanPageResult = {
  items: InsightListItem[]
  total: number
}

function insightIdFromEntry(entry: ExpressionEntry): string {
  const snapshot = entry.contentSnapshot
  if (entry.kind === 'word') {
    return String(snapshot?.id || entry.sourceId || `word:${entry.original ?? entry.id}`)
  }
  if (entry.kind === 'pattern') {
    return String(snapshot?.id || entry.sourceId || entry.id)
  }
  return String(snapshot?.id || entry.sourceId || entry.id)
}

function leanFromEntry(entry: ExpressionEntry): InsightListItem | null {
  const apiType = entry.type === 'scene_phrase' ? 'scene_phrase' : entry.kind === 'word' ? 'word' : 'chunk'
  if (!hasExpressionTitle(entry, apiType)) return null
  const title = expressionDisplayTitle(entry, apiType).trim()
  if (!title) return null
  const snapshot = entry.contentSnapshot
  const meaning =
    entry.kind === 'word'
      ? String(snapshot?.meaning || entry.chunkText || entry.corrected || '').trim() || undefined
      : String(snapshot?.meaning || entry.original || '').trim() || undefined
  return {
    id: insightIdFromEntry(entry),
    kind: entry.kind,
    title,
    meaning,
  }
}

type CachedNotebook = LearningNotebook & {
  remoteId?: string | null
  remoteUpdatedAt?: string | null
  deletedAt?: string | null
  lastMutationId?: string
  syncStatus: 'synced' | 'pending' | 'failed'
}

function summarize(notebooks: LearningNotebook[]): NotebookListResult {
  return {
    items: notebooks,
    allCounts: notebooks.reduce(
      (total, notebook) => ({
        total: total.total + notebook.counts.total,
        word: total.word + notebook.counts.word,
        chunk: total.chunk + notebook.counts.chunk,
        pattern: total.pattern + notebook.counts.pattern,
      }),
      { total: 0, word: 0, chunk: 0, pattern: 0 },
    ),
  }
}

function toLibraryExpression(entry: ExpressionEntry, item: CachedNotebookItem): LocalNotebookExpression {
  const snapshot = entry.contentSnapshot
  return {
    ...entry,
    id: entry.id,
    notebookItemId: item.id,
    notebookId: item.notebookId,
    masteryStatus: item.masteryStatus,
    reviewCount: item.reviewCount,
    intervalDays: item.intervalDays,
    easeFactor: item.easeFactor,
    lapseCount: item.lapseCount,
    lastReviewedAt: item.lastReviewedAt,
    nextReviewAt: item.nextReviewAt,
    vocabulary: entry.kind === 'word' ? snapshot : undefined,
    contentData: entry.kind === 'word' ? undefined : snapshot,
  }
}

export const learningNotebookRepository = {
  // Internal read used while holding the notebook write lock.
  async listStored(): Promise<NotebookListResult> {
    const [notebooks, groups] = await Promise.all([
      localDb.list<CachedNotebook>('learning_notebooks'), localDb.notebookCounts(),
    ])
    const counts = new Map<string, NotebookCounts>()
    for (const group of groups) {
      const value = counts.get(group.notebookId) ?? { total: 0, word: 0, chunk: 0, pattern: 0 }
      if (group.kind === 'word' || group.kind === 'chunk' || group.kind === 'pattern') {
        value[group.kind] += group.count
        value.total += group.count
      }
      counts.set(group.notebookId, value)
    }
    return summarize(notebooks.filter(n => !n.deletedAt).map(n => ({
      ...n, counts: counts.get(n.id) ?? { total: 0, word: 0, chunk: 0, pattern: 0 },
    })).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)))
  },

  async listCached(): Promise<NotebookListResult> {
    const cached = await this.listStored()
    if (cached.items.some(n => n.kind === 'uncategorized') || !getCurrentSessionSnapshot()?.user?.id) return cached
    await serializeNotebookWrite(async () => {
      // Recheck inside the lock: parallel views must create only one system notebook.
      if (!(await this.listStored()).items.some(n => n.kind === 'uncategorized')) {
        await this.createLocal('未分类', 'uncategorized')
      }
    })
    return this.listStored()
  },

  // Compatibility for existing callers: refreshing a view never performs network I/O.
  async refresh() { return this.listCached() },
  async list() { return this.listCached() },

  async getCached(id: string): Promise<LearningNotebook | null> {
    return localDb.get<CachedNotebook>('learning_notebooks', id)
  },

  /**
   * The notebook detail view is local-first: all collected expression snapshots
   * and their notebook state live in SQLite. The UI can safely virtualise this
   * result without keeping thousands of DOM nodes alive.
   */
  async listCachedExpressionItems(request: LocalExpressionListRequest): Promise<LocalNotebookExpression[]> {
    // Export and playback use exactly the same dataset as visible pagination.
    const rows: LocalNotebookExpression[] = []
    while (true) {
      const page = await this.listCachedExpressionPage({ ...request, limit: 500, offset: rows.length })
      rows.push(...page.items)
      if (rows.length >= page.total || page.items.length === 0) break
    }
    return rows
  },

  async listCachedExpressionPage(
    request: LocalExpressionListRequest & { limit: number; offset?: number },
  ): Promise<LocalExpressionPageResult> {
    const page = await localDb.listNotebookExpressionPage({
      notebookId: request.notebookId,
      kind: request.type === 'scene_phrase' ? 'pattern' : request.type,
      reviewState: request.reviewState,
      search: request.search,
      sort: request.sort ?? 'newest',
      limit: request.limit,
      offset: request.offset,
    })
    const hydrated = await learningContentRepository.hydrateExpressionSnapshots(
      page.items.map(({ entry }) => entry as ExpressionEntry),
    )
    void import('./favorite-audio-pin.service')
      .then((mod) => mod.favoriteAudioPinService?.pinMany(hydrated))
      .catch(() => undefined)
    return {
      total: page.total,
      items: page.items.map(({ item }, index) => toLibraryExpression(
        hydrated[index] ?? (page.items[index]!.entry as ExpressionEntry),
        item as CachedNotebookItem,
      )),
    }
  },

  /** Lean playlist rows — same filters/sort as the full page, no pack hydrate. */
  async listCachedExpressionLeanPage(
    request: LocalExpressionListRequest & { limit: number; offset?: number },
  ): Promise<LocalExpressionLeanPageResult> {
    insightListDiag('notebook.lean_page', {
      notebookId: request.notebookId,
      type: request.type,
      limit: request.limit,
      offset: request.offset ?? 0,
      hydrate: false,
    })
    const page = await localDb.listNotebookExpressionPage({
      notebookId: request.notebookId,
      kind: request.type === 'scene_phrase' ? 'pattern' : request.type,
      reviewState: request.reviewState,
      search: request.search,
      sort: request.sort ?? 'newest',
      limit: request.limit,
      offset: request.offset,
    })
    const items = page.items
      .map(({ entry }) => leanFromEntry(entry as ExpressionEntry))
      .filter((item): item is InsightListItem => Boolean(item))
    insightListDiag('notebook.lean_page_ok', {
      offset: request.offset ?? 0,
      limit: request.limit,
      rowCount: items.length,
      total: page.total,
      hydrate: false,
    })
    return { total: page.total, items }
  },

  /** Hydrate one notebook expression into a library-shaped row for insight detail. */
  async getCachedExpressionDetail(insightId: string): Promise<LocalNotebookExpression | null> {
    insightListDiag('notebook.detail', { insightId, hydrate: true })
    const found = await localDb.findExpressionEntryByInsightId(insightId)
    if (!found) {
      insightListDiag('notebook.detail_miss', { insightId })
      return null
    }
    const entry = found as ExpressionEntry

    const [hydrated] = await learningContentRepository.hydrateExpressionSnapshots([entry])
    const resolved = hydrated ?? entry
    const items = await localDb.activeNotebookItems()
    const notebookItem = items.find((row) => row.expressionEntryId === resolved.id)
    insightListDiag('notebook.detail_ok', {
      insightId,
      entryId: resolved.id,
      kind: resolved.kind,
      hydrate: true,
    })
    if (!notebookItem) {
      return {
        ...resolved,
        notebookItemId: '',
        notebookId: '',
        masteryStatus: 'learning',
        reviewCount: 0,
        intervalDays: 0,
        lapseCount: 0,
        vocabulary: resolved.kind === 'word' ? resolved.contentSnapshot : undefined,
        contentData: resolved.kind === 'word' ? undefined : resolved.contentSnapshot,
      }
    }
    return toLibraryExpression(resolved, notebookItem as CachedNotebookItem)
  },

  async updateCachedNotebookItemStatus(id: string, masteryStatus: string): Promise<void> {
    if (!['learning', 'reviewing', 'mastered'].includes(masteryStatus)) throw new Error('无效的学习状态')
    await serializeNotebookWrite(async () => {
      const item = await localDb.get<any>('learning_notebook_items', id)
      if (!item || item.deletedAt) return
      await this.writeItem({ ...item, masteryStatus })
    })
  },

  async writeItem(item: any, extraWrites: Array<{ table: 'expression_entries'; value: ExpressionEntry }> = []) {
    const entry = extraWrites.find(w => w.value.id === item.expressionEntryId)?.value
      ?? await localDb.get<ExpressionEntry>('expression_entries', item.expressionEntryId)
    if (!entry) throw new Error('学习内容尚未恢复，请同步后重试')
    const mutation = notebookMutation('notebook_item', item, {
      notebookId: item.notebookId, intent: item.deletedAt ? 'remove' : 'status', deleted: Boolean(item.deletedAt), masteryStatus: item.masteryStatus,
      entry: { kind: entry.kind, type: entry.type, text: entry.kind === 'word' ? entry.original : entry.chunkText, ...createPayload(entry) },
    })
    await commitNotebookMutation([
      ...extraWrites,
      { table: 'learning_notebook_items', value: { ...item, updatedAt: new Date().toISOString(), syncStatus: 'pending', lastMutationId: mutation.id } },
      { table: 'outbox', value: mutation },
    ])
  },

  async removeCachedNotebookItem(id: string): Promise<void> {
    let expressionEntryId: string | null = null
    await serializeNotebookWrite(async () => {
      const item = await localDb.get<any>('learning_notebook_items', id)
      if (!item || item.deletedAt) return
      expressionEntryId = item.expressionEntryId ?? null
      await this.writeItem({ ...item, deletedAt: new Date().toISOString() })
    })
    if (!expressionEntryId) return
    const stillActive = (await localDb.activeNotebookItems())
      .some((row) => row.expressionEntryId === expressionEntryId)
    if (!stillActive) {
      void import('./favorite-audio-pin.service')
        .then((mod) => mod.favoriteAudioPinService?.unpinExpressionAudio(expressionEntryId))
        .catch(() => undefined)
    }
  },

  async addEntry(entry: ExpressionEntry, notebookIds: string[]) {
    await serializeNotebookWrite(async () => {
      if (!notebookIds.length) {
        const notebooks = await this.listStored()
        let uncategorized = notebooks.items.find(n => n.kind === 'uncategorized')
        if (!uncategorized) uncategorized = await this.createLocal('未分类', 'uncategorized')
        notebookIds = [uncategorized.id]
      }
      const writes: import('./unified-storage').LocalWrite[] = [{ table: 'expression_entries', value: entry }]
      for (const notebookId of [...new Set(notebookIds)]) {
        const notebook = await localDb.get<any>('learning_notebooks', notebookId)
        if (!notebook || notebook.deletedAt) throw new Error('学习本已删除')
        const existing = (await localDb.findByIndex<any>('learning_notebook_items', 'notebook_id', notebookId))
          .filter(i => i.expressionEntryId === entry.id)
          .sort((a, b) => Number(b.syncStatus === 'pending') - Number(a.syncStatus === 'pending') || String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]
        if (existing && !existing.deletedAt) continue
        const item = { ...existing, id: existing?.id ?? `local:${notebookId}:${entry.id}`, remoteId: existing?.remoteId ?? null,
          notebookId, expressionEntryId: entry.id, deletedAt: null, masteryStatus: 'learning',
          reviewCount: 0, intervalDays: 0, easeFactor: 2.5, lapseCount: 0,
          lastReviewedAt: null, nextReviewAt: null, createdAt: existing?.createdAt ?? new Date().toISOString() }
        const mutation = notebookMutation('notebook_item', item, { notebookId, intent: 'join', deleted: false, masteryStatus: 'learning',
          entry: { kind: entry.kind, type: entry.type, text: entry.kind === 'word' ? entry.original : entry.chunkText, ...createPayload(entry) } })
        writes.push({ table: 'learning_notebook_items', value: { ...item, updatedAt: new Date().toISOString(), syncStatus: 'pending', lastMutationId: mutation.id } },
          { table: 'outbox', value: mutation })
      }
      await commitNotebookMutation(writes)
    })
    void import('./favorite-audio-pin.service')
      .then((mod) => mod.favoriteAudioPinService?.pinExpressionAudio(entry))
      .catch(() => undefined)
  },

  async addItemsToNotebook(ids: string[], notebookId: string) {
    for (const id of ids) {
      const item = await localDb.get<any>('learning_notebook_items', id)
      if (!item || item.deletedAt) continue
      const entry = await localDb.get<ExpressionEntry>('expression_entries', item.expressionEntryId)
      if (entry) await this.addEntry(entry, [notebookId])
    }
  },

  async createLocal(rawName: string, kind: 'custom' | 'uncategorized' = 'custom'): Promise<CachedNotebook> {
    const name = rawName.trim()
    if (!name || name.length > 30) throw new Error('学习本名称需为 1–30 个字符')
    const notebooks = await this.listStored()
    if (notebooks.items.some(n => n.name.toLocaleLowerCase() === name.toLocaleLowerCase() && n.kind === kind)) throw new Error('已经有同名学习本')
    const now = new Date().toISOString()
    const notebook: CachedNotebook = { id: createId('notebook'), name, kind, color: kind === 'uncategorized' ? 'slate' : 'ocean', sortOrder: kind === 'uncategorized' ? -1 : notebooks.items.length,
      createdAt: now, updatedAt: now, remoteId: null, syncStatus: 'pending', counts: { total: 0, word: 0, chunk: 0, pattern: 0 } }
    const mutation = notebookMutation('notebook', notebook, { name, kind, deleted: false, ownerId: getCurrentSessionSnapshot()?.user?.id })
    await commitNotebookMutation([{ table: 'learning_notebooks', value: { ...notebook, lastMutationId: mutation.id } }, { table: 'outbox', value: mutation }])
    return notebook
  },
  async create(name: string): Promise<CachedNotebook> { return serializeNotebookWrite<CachedNotebook>(() => this.createLocal(name)) },
  async rename(id: string, rawName: string): Promise<CachedNotebook> {
    return serializeNotebookWrite(async () => {
      const name = rawName.trim()
      if (!name || name.length > 30) throw new Error('学习本名称需为 1–30 个字符')
      if ((await this.listStored()).items.some(n => n.id !== id && n.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('已经有同名学习本')
      return this.writeNotebook(id, { name })
    })
  },
  async writeNotebook(id: string, patch: { name?: string; deletedAt?: string }): Promise<CachedNotebook> {
    const notebook = await localDb.get<CachedNotebook>('learning_notebooks', id)
    if (!notebook || notebook.deletedAt) throw new Error('学习本已删除')
    if (notebook.kind !== 'custom') throw new Error('系统学习本不能修改或删除')
    const next = { ...notebook, ...patch, updatedAt: new Date().toISOString() }
    const mutation = notebookMutation('notebook', notebook, { name: next.name, kind: next.kind, deleted: Boolean(next.deletedAt) })
    await commitNotebookMutation([{ table: 'learning_notebooks', value: { ...next, syncStatus: 'pending', lastMutationId: mutation.id } }, { table: 'outbox', value: mutation }])
    return next
  },
  async remove(id: string): Promise<CachedNotebook> { return serializeNotebookWrite<CachedNotebook>(() => this.writeNotebook(id, { deletedAt: new Date().toISOString() })) },
}

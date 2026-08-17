import {
  expressionApi,
  learningNotebookApi,
  type LearningNotebook,
} from '@/features/practice/api/english-practice-api'
import { localDb } from './unified-storage'
import { learningContentRepository, type ExpressionEntry } from './learning-content.repository'

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

type LocalExpressionListRequest = {
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

type CachedNotebook = LearningNotebook & {
  remoteId: string
  syncStatus: 'synced'
}

function toCached(notebook: LearningNotebook): CachedNotebook {
  return {
    ...notebook,
    remoteId: notebook.id,
    syncStatus: 'synced',
  }
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

function matchesLocalExpression(entry: ExpressionEntry, request: LocalExpressionListRequest) {
  const type = request.type === 'scene_phrase' ? 'scene_phrase' : request.type
  if (entry.type !== type) return false
  const query = request.search?.trim().toLocaleLowerCase()
  if (!query) return true
  return [entry.original, entry.corrected, entry.chunkText, entry.sceneName]
    .some((value) => value?.toLocaleLowerCase().includes(query))
}

export const learningNotebookRepository = {
  /** Rebuild one notebook's local replica from the server without touching other notebooks. */
  async syncNotebookReplica(
    notebookId: string,
    onProgress?: (progress: { completed: number; total: number }) => void,
  ) {
    const notebooks = await learningNotebookApi.list()
    await localDb.putMany('learning_notebooks', notebooks.items.map(toCached))
    const notebook = notebooks.items.find((item) => item.id === notebookId)
    if (!notebook) throw new Error('学习本不存在或已被删除')

    const total = notebook.counts?.total ?? 0
    let completed = 0
    let restored = 0
    for (const type of ['word', 'chunk', 'scene_phrase'] as const) {
      let page = 1
      let totalPages = 1
      while (page <= totalPages) {
        const result = await expressionApi.list({ notebookId, type, page, pageSize: 100 }) as { items: any[]; totalPages?: number }
        totalPages = Math.max(1, Number(result.totalPages ?? 1))
        for (const item of result.items ?? []) {
          const entry = await learningContentRepository.saveRemoteExpressionEntry(item)
          if (!entry || !item.notebookItemId) continue
          await localDb.put('learning_notebook_items', {
            id: String(item.notebookItemId),
            remoteId: String(item.notebookItemId),
            notebookId,
            expressionEntryId: entry.id,
            masteryStatus: item.masteryStatus ?? 'learning',
            reviewCount: item.reviewCount ?? 0,
            intervalDays: item.intervalDays ?? 0,
            easeFactor: item.easeFactor ?? 2.5,
            lapseCount: item.lapseCount ?? 0,
            lastReviewedAt: item.lastReviewedAt ?? null,
            nextReviewAt: item.nextReviewAt ?? null,
            createdAt: item.createdAt ?? null,
            updatedAt: item.updatedAt ?? null,
            syncStatus: 'synced',
          })
          restored += 1
        }
        completed += (result.items ?? []).length
        onProgress?.({ completed, total })
        page += 1
      }
    }
    return { restored, total }
  },

  async listCached(): Promise<NotebookListResult> {
    return summarize(await localDb.list<CachedNotebook>('learning_notebooks'))
  },

  async refresh(): Promise<NotebookListResult> {
    const result = await learningNotebookApi.list()
    await localDb.putMany('learning_notebooks', result.items.map(toCached))
    return result
  },

  async list() {
    const cached = await this.listCached()
    if (cached.items.length > 0) return cached
    return this.refresh()
  },

  async getCached(id: string): Promise<LearningNotebook | null> {
    return localDb.get<CachedNotebook>('learning_notebooks', id)
  },

  /**
   * The notebook detail view is local-first: all collected expression snapshots
   * and their notebook state live in SQLite. The UI can safely virtualise this
   * result without keeping thousands of DOM nodes alive.
   */
  async listCachedExpressionItems(request: LocalExpressionListRequest): Promise<LocalNotebookExpression[]> {
    const [entries, notebookItems] = await Promise.all([
      localDb.list<ExpressionEntry>('expression_entries'),
      localDb.list<CachedNotebookItem>('learning_notebook_items'),
    ])
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
    const status = request.reviewState
    const rows = notebookItems
      .filter((item) => item.notebookId === request.notebookId)
      .filter((item) => {
        if (!status) return true
        return status === 'learning'
          ? item.masteryStatus === 'learning' || item.masteryStatus === 'activated'
          : item.masteryStatus === status
      })
      .map((item) => {
        const entry = entriesById.get(item.expressionEntryId)
        if (!entry || !matchesLocalExpression(entry, request)) return null
        const snapshot = entry.contentSnapshot
        return {
          ...entry,
          id: entry.remoteId ?? entry.id,
          notebookItemId: item.remoteId ?? item.id,
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
        } satisfies LocalNotebookExpression
      })
      .filter(Boolean) as LocalNotebookExpression[]

    return rows.sort((a, b) => {
      const result = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return request.sort === 'oldest' ? -result : result
    })
  },

  async updateCachedNotebookItemStatus(notebookItemId: string, masteryStatus: string): Promise<void> {
    const item = await localDb.get<CachedNotebookItem>('learning_notebook_items', notebookItemId)
    if (!item) return
    await localDb.put('learning_notebook_items', {
      ...item,
      masteryStatus,
      updatedAt: new Date().toISOString(),
      syncStatus: item.remoteId ? 'synced' : item.syncStatus,
    })
  },

  async removeCachedNotebookItem(notebookItemId: string): Promise<void> {
    await localDb.delete('learning_notebook_items', notebookItemId)
  },

  async create(name: string) {
    const notebook = await learningNotebookApi.create(name)
    const cached = toCached({
      ...notebook,
      counts: notebook.counts ?? { total: 0, word: 0, chunk: 0, pattern: 0 },
    })
    await localDb.put('learning_notebooks', cached)
    return cached
  },

  async rename(id: string, name: string) {
    const notebook = await learningNotebookApi.rename(id, name)
    const existing = await localDb.get<CachedNotebook>('learning_notebooks', id)
    const cached = toCached({
      ...notebook,
      counts: notebook.counts ?? existing?.counts ?? { total: 0, word: 0, chunk: 0, pattern: 0 },
    })
    await localDb.put('learning_notebooks', cached)
    return cached
  },

  async remove(id: string) {
    await learningNotebookApi.remove(id)
    await localDb.delete('learning_notebooks', id)
  },
}

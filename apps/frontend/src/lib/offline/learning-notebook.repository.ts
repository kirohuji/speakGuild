import {
  expressionApi,
  learningNotebookApi,
  type LearningNotebook,
} from '@/features/practice/api/english-practice-api'
import { localDb } from './unified-storage'

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

type ExpressionListRequest = {
  notebookId: string
  type: 'word' | 'chunk' | 'scene_phrase'
  reviewState?: string
  page: number
  pageSize: number
}

type ExpressionListCache = {
  id: string
  value: unknown
  updatedAt: string
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

function expressionCacheKey(request: ExpressionListRequest) {
  return `expression-cache:${request.notebookId}:${request.type}:${request.reviewState ?? 'all'}:${request.page}:${request.pageSize}`
}

export const learningNotebookRepository = {
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

  async getCachedExpressionList(request: ExpressionListRequest): Promise<unknown | null> {
    const cached = await localDb.get<ExpressionListCache>('kv', expressionCacheKey(request))
    return cached?.value ?? null
  },

  async refreshExpressionList(request: ExpressionListRequest): Promise<unknown> {
    const value = await expressionApi.list(request)
    // 缓存是加速层，不能因为 SQLite 写入失败而把已经拿到的列表结果丢掉。
    void localDb.put<ExpressionListCache>('kv', {
      id: expressionCacheKey(request),
      value,
      updatedAt: new Date().toISOString(),
    }).catch((error) => {
      console.warn('[learning-notebook] expression list cache write failed:', error)
    })
    return value
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

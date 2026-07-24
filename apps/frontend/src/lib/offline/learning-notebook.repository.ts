import {
  learningNotebookApi,
  type LearningNotebook,
} from '@/features/practice/api/english-practice-api'
import { localDb } from './unified-storage'

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

export const learningNotebookRepository = {
  async list() {
    try {
      const result = await learningNotebookApi.list()
      await localDb.putMany('learning_notebooks', result.items.map(toCached))
      return result
    } catch (error) {
      const cached = await localDb.list<CachedNotebook>('learning_notebooks')
      if (cached.length === 0) throw error
      return {
        items: cached,
        allCounts: cached.reduce(
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

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { localDb, syncOutbox } from '@/lib/offline'

// ---------- 带日期的生词条目 ----------
export interface WordEntry {
  word: string
  addedAt: string // ISO date string
}

interface WordsStore {
  entries: WordEntry[]
  /** 兼容旧版字段（只读，从 entries 派生） */
  words: string[]
  addWord: (word: string) => void
  removeWord: (word: string) => void
  hasWord: (word: string) => boolean
}

export const useWordsStore = create<WordsStore>()(
  persist(
    (set, get) => ({
      entries: [],
      get words() {
        return get().entries.map((e) => e.word)
      },

      addWord: (word) => {
        const existed = get().entries.some((e) => e.word === word)
        set((state) => {
          if (state.entries.some((e) => e.word === word)) return state
          return {
            entries: [
              ...state.entries,
              { word, addedAt: new Date().toISOString() },
            ],
          }
        })
        if (!existed) {
          void localDb.put('wordbook', {
            id: word.toLowerCase(),
            word,
            addedAt: new Date().toISOString(),
            deletedAt: null,
          })
          void syncOutbox.enqueue({
            entityType: 'word_entry',
            entityId: word.toLowerCase(),
            operation: 'create',
            payload: { word, addedAt: new Date().toISOString() },
          })
        }
      },

      removeWord: (word) => {
        const existed = get().entries.some((e) => e.word === word)
        set((state) => ({
          entries: state.entries.filter((e) => e.word !== word),
        }))
        if (existed) {
          void localDb.put('wordbook', {
            id: word.toLowerCase(),
            word,
            deletedAt: new Date().toISOString(),
          })
          void syncOutbox.enqueue({
            entityType: 'word_entry',
            entityId: word.toLowerCase(),
            operation: 'delete',
            payload: { word, deletedAt: new Date().toISOString() },
          })
        }
      },

      hasWord: (word) => get().entries.some((e) => e.word === word),
    }),
    {
      name: 'manyu-words',
      // 从旧版 { words: string[] } 迁移到新格式
      migrate: (persisted: any) => {
        if (Array.isArray(persisted?.words) && !persisted.entries) {
          return {
            entries: (persisted.words as string[]).map((word) => ({
              word,
              addedAt: new Date().toISOString(),
            })),
          }
        }
        return persisted
      },
      version: 1,
    }
  )
)

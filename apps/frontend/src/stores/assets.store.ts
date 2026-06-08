import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

      addWord: (word) =>
        set((state) => {
          if (state.entries.some((e) => e.word === word)) return state
          return {
            entries: [
              ...state.entries,
              { word, addedAt: new Date().toISOString() },
            ],
          }
        }),

      removeWord: (word) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.word !== word),
        })),

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

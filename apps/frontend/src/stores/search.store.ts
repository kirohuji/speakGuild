import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_HISTORY = 10

interface SearchStore {
  history: string[]
  addHistory: (keyword: string) => void
  removeHistory: (keyword: string) => void
  clearHistory: () => void
}

export const useSearchStore = create<SearchStore>()(
  persist(
    (set) => ({
      history: [],
      addHistory: (keyword) =>
        set((state) => {
          const trimmed = keyword.trim()
          if (!trimmed) return state
          const filtered = state.history.filter((h) => h !== trimmed)
          return { history: [trimmed, ...filtered].slice(0, MAX_HISTORY) }
        }),
      removeHistory: (keyword) =>
        set((state) => ({
          history: state.history.filter((h) => h !== keyword),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'guide-exam-search-history' }
  )
)

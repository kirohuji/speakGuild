import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PracticeActivityScope = 'daily' | 'dialogue'

export type PracticeActivityRecord = {
  date: string
  sourceId: string
  scope: PracticeActivityScope
  activeSeconds: number
  updatedAt: string
}

type PracticeActivityState = {
  records: Record<string, PracticeActivityRecord>
  addActiveSeconds: (input: { date: string; sourceId: string; scope: PracticeActivityScope; seconds: number }) => void
  getRecord: (date: string, sourceId: string) => PracticeActivityRecord | null
}

const MAX_ACTIVE_SECONDS_PER_SOURCE = 30 * 60

function recordKey(date: string, sourceId: string) {
  return `${date}:${sourceId}`
}

export const usePracticeActivityStore = create<PracticeActivityState>()(
  persist(
    (set, get) => ({
      records: {},
      addActiveSeconds({ date, sourceId, scope, seconds }) {
        const safeSeconds = Math.max(0, Math.min(60, Math.floor(seconds)))
        if (safeSeconds === 0) return
        const key = recordKey(date, sourceId)
        set((state) => {
          const existing = state.records[key]
          const activeSeconds = Math.min(MAX_ACTIVE_SECONDS_PER_SOURCE, (existing?.activeSeconds ?? 0) + safeSeconds)
          return {
            records: {
              ...state.records,
              [key]: { date, sourceId, scope, activeSeconds, updatedAt: new Date().toISOString() },
            },
          }
        })
      },
      getRecord(date, sourceId) {
        return get().records[recordKey(date, sourceId)] ?? null
      },
    }),
    {
      name: 'manyu-practice-activity',
      partialize: (state) => ({ records: state.records }),
    },
  ),
)

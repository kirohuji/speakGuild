import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dailyPracticeApi } from '@/features/practice/api/english-practice-api'

export type PracticeActivityScope = 'daily' | 'dialogue' | 'learning'

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
  reset: () => void
}

const MAX_ACTIVE_SECONDS_PER_SOURCE = 4 * 60 * 60

function recordKey(date: string, sourceId: string) {
  return `${date}:${sourceId}`
}

const activityCommitters = new Set<() => void>()

/** Let an open timer fold its not-yet-ticked seconds into the store before upload. */
export function registerPracticeActivityCommitter(commit: () => void) {
  activityCommitters.add(commit)
  return () => { activityCommitters.delete(commit) }
}

/** Upload every locally accumulated source. The server keeps the max per source. */
export async function flushPracticeActivityRecords(): Promise<void> {
  for (const commit of activityCommitters) commit()
  const records = Object.values(usePracticeActivityStore.getState().records).filter((record) => record.activeSeconds > 0)
  await Promise.all(records.map((record) => dailyPracticeApi.recordActivity({
    date: record.date,
    sourceId: record.sourceId,
    scope: record.scope,
    activeSeconds: record.activeSeconds,
    questionCount: 0,
  })))
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
      reset() {
        set({ records: {} })
      },
    }),
    {
      name: 'manyu-practice-activity',
      partialize: (state) => ({ records: state.records }),
    },
  ),
)

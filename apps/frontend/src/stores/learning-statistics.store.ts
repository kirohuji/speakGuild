import { create } from 'zustand'
import { useEffect } from 'react'
import { learningStatisticsRepository } from '@/lib/offline/learning-statistics.repository'
import type { LearningStatistics } from '@/lib/offline/statistics-types'
import { subscribeStatisticsChanged } from '@/lib/offline/storage-events'

const ranges = new Map<string, { start: string; end: string; count: number }>()
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
const versions = new Map<string, number>()
const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
const keyFor = (start: string, end: string) => `${start}:${end}`
export const useLearningStatisticsStore = create<{
  data: LearningStatistics | null
  cache: Record<string, LearningStatistics>
  error: string | null
  loading: boolean
  refresh: (start?: string, end?: string) => Promise<void>
  reset: () => void
}>((set, get) => ({
  data: null, cache: {}, error: null, loading: false,
  async refresh(start = `${new Date().getFullYear()}-01-01`, end = `${new Date().getFullYear()}-12-31`) {
    const epoch = generation
    const key = keyFor(start, end)
    const version = (versions.get(key) ?? 0) + 1
    versions.set(key, version)
    set({ loading: true })
    try {
      const data = await learningStatisticsRepository.read(start, end)
      if (generation !== epoch || versions.get(key) !== version) return
      const cache = { ...get().cache, [key]: data }
      for (const oldKey of Object.keys(cache)) {
        if (Object.keys(cache).length <= 6) break
        if (oldKey !== key && !ranges.has(oldKey)) delete cache[oldKey]
      }
      set({ data, cache, loading: false, error: null })
    } catch (error) {
      if (generation === epoch && versions.get(key) === version) set({ loading: false, error: String(error) })
    }
  },
  reset() {
    generation++
    versions.clear()
    clearTimeout(timer)
    set({ data: null, cache: {}, loading: false, error: null })
  },
}))
function refreshObservedRanges() {
  if (!visible()) return
  for (const range of ranges.values()) void useLearningStatisticsStore.getState().refresh(range.start, range.end)
}
subscribeStatisticsChanged(() => {
  clearTimeout(timer)
  if (ranges.size && visible()) timer = setTimeout(refreshObservedRanges, 100)
})
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refreshObservedRanges)
export function useLearningStatistics(start: string, end: string, enabled = true) {
  const data = useLearningStatisticsStore(s => s.cache[keyFor(start, end)] ?? null)
  const error = useLearningStatisticsStore(s => s.error)
  useEffect(() => {
    if (!enabled) return
    const key = keyFor(start, end)
    const range = ranges.get(key) ?? { start, end, count: 0 }
    range.count++
    ranges.set(key, range)
    void useLearningStatisticsStore.getState().refresh(start, end)
    return () => { if (--range.count === 0) ranges.delete(key) }
  }, [start, end, enabled])
  return { data, error }
}

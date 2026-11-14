import { localDb } from './unified-storage'
import { localDateKey } from '@/lib/date/calendar-date'
export const learningStatisticsRepository = {
  async read(start = `${new Date().getFullYear()}-01-01`, end = `${new Date().getFullYear()}-12-31`) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('Invalid statistics date range')
    const [statistics, marker] = await Promise.all([
      localDb.readLearningStatistics(start, end, localDateKey()),
      localDb.get<{ value?: boolean }>('kv', 'sync:user:statistics-complete'),
    ])
    return { ...statistics, historyComplete: Boolean(marker?.value) }
  },
  async saveRemoteRuns(runs: any[]) { await localDb.applyStatisticsRuns(runs) },
}

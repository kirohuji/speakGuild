import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ read: vi.fn(), get: vi.fn(async () => null), apply: vi.fn(async () => {}) }))
vi.mock('../unified-storage', () => ({ localDb: { readLearningStatistics: db.read, get: db.get, applyStatisticsRuns: db.apply } }))
import { learningStatisticsRepository } from '../learning-statistics.repository'
import { useLearningStatisticsStore } from '../../../stores/learning-statistics.store'
const empty = { dailyStats: [], activeDays: 0, uniqueQuestionsAnswered: 0, activeSeconds: 0, avgDailyQuestions: 0, currentStreakDays: 0, favoriteCount: 0, wordCount: 0 }
beforeEach(() => { db.read.mockReset().mockResolvedValue(empty); useLearningStatisticsStore.getState().reset() })
describe('bounded statistics repository and account state', () => {
  it('passes the visible month to the indexed SQLite read model', async () => {
    await learningStatisticsRepository.read('2026-11-01', '2026-11-30')
    expect(db.read).toHaveBeenCalledWith('2026-11-01', '2026-11-30', expect.any(String))
  })
  it('clears all cached ranges at the existing account-reset boundary', async () => {
    db.read.mockResolvedValue({ ...empty, uniqueQuestionsAnswered: 1 })
    await useLearningStatisticsStore.getState().refresh('2026-11-01', '2026-11-30')
    expect(useLearningStatisticsStore.getState().data?.uniqueQuestionsAnswered).toBe(1)
    useLearningStatisticsStore.getState().reset()
    expect(useLearningStatisticsStore.getState().data).toBeNull()
    expect(useLearningStatisticsStore.getState().cache).toEqual({})
  })
  it('drops an old read after the account state resets', async () => {
    let resolveRead!: (value: any) => void
    db.read.mockImplementationOnce(() => new Promise(resolve => { resolveRead = resolve }))
    const pending = useLearningStatisticsStore.getState().refresh()
    useLearningStatisticsStore.getState().reset()
    resolveRead({ ...empty, uniqueQuestionsAnswered: 123 })
    await pending
    expect(useLearningStatisticsStore.getState().data).toBeNull()
  })
})

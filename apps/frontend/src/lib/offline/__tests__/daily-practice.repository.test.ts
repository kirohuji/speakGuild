import { describe, expect, it } from 'vitest'
import { compareReviewDebt, deriveTodayScheduledPracticeIds, selectPracticeBatch, selectReviewBatch, type PracticeRunForPlanning } from '../daily-practice.planner'

function storedRun(overrides: Partial<PracticeRunForPlanning>): PracticeRunForPlanning {
  return {
    id: 'run', date: '2026-08-20', mode: 'practice', scope: 'single', packIdsKey: 'pack', scheduledItemIds: [],
    ...overrides,
  }
}

describe('daily practice V2.5.1 planning helpers', () => {
  it('excludes the union of every matching Practice run scheduled today', () => {
    const runs = [
      storedRun({ id: 'p1', scheduledItemIds: ['a'] }),
      storedRun({ id: 'p2', scheduledItemIds: ['b'] }),
      storedRun({ id: 'review', mode: 'review', scheduledItemIds: ['c'] }),
      storedRun({ id: 'old', date: '2026-08-19', scheduledItemIds: ['d'] }),
    ]
    expect([...deriveTodayScheduledPracticeIds(runs, '2026-08-20', 'single', ['pack'])].sort()).toEqual(['a', 'b'])
  })

  it('orders Review debt by due date, lapse count, then stable item id', () => {
    const candidate = (itemId: string) => ({ itemId })
    const progress = (dueDate: string, lapseCount: number) => ({ dueDate, lapseCount })
    const debt = [
      { candidate: candidate('c'), progress: progress('2026-08-18', 1) },
      { candidate: candidate('b'), progress: progress('2026-08-18', 3) },
      { candidate: candidate('a'), progress: progress('2026-08-18', 3) },
      { candidate: candidate('oldest'), progress: progress('2026-08-17', 0) },
    ].sort(compareReviewDebt)
    expect(debt.map((item) => item.candidate.itemId)).toEqual(['oldest', 'a', 'b', 'c'])
    expect(selectReviewBatch(debt, 2).map((item) => item.candidate.itemId)).toEqual(['oldest', 'a'])
    expect(selectReviewBatch(debt.slice(2), 2).map((item) => item.candidate.itemId)).toEqual(['b', 'c'])
  })

  it('excludes unresolved items from the same-day next group but carries them tomorrow', () => {
    const sameDay = selectPracticeBatch({
      carryoverUnresolved: ['a'], carryoverUnattempted: [], fresh: ['b', 'c'],
      todayScheduledIds: new Set(['a']), goal: 2, getId: (id) => id,
    })
    const nextDay = selectPracticeBatch({
      carryoverUnresolved: ['a'], carryoverUnattempted: [], fresh: ['b', 'c'],
      todayScheduledIds: new Set(), goal: 2, getId: (id) => id,
    })
    expect(sameDay).toEqual(['b', 'c'])
    expect(nextDay).toEqual(['a', 'b'])
  })
})

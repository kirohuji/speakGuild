// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
const activity = vi.hoisted(() => ({ add: vi.fn(), flush: vi.fn(async () => {}), generation: 0, owners: [] as string[] }))
vi.mock('@/stores/practice-activity.store', () => ({
  usePracticeActivityStore: { getState: () => ({ addActiveSeconds: activity.add, releaseSource: vi.fn() }) },
  flushPracticeActivityRecords: activity.flush,
  registerPracticeActivityCommitter: () => () => {},
  claimPracticeTimer: (source: string) => { activity.owners.push(source); return () => { activity.owners = activity.owners.filter(id => id !== source) } },
  ownsPracticeTimer: (source: string) => activity.owners.at(-1) === source,
  getPracticeActivityGeneration: () => activity.generation,
}))
import { useEffectivePracticeTimer } from '../use-effective-practice-timer'

beforeEach(() => {
  vi.useFakeTimers()
  activity.add.mockClear()
  activity.flush.mockClear()
  activity.generation = 0
  activity.owners = []
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
afterEach(() => { cleanup(); vi.useRealTimers() })
describe('effective timer offline boundaries', () => {
  it('splits a timer tick at local midnight', () => {
    vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 58))
    renderHook(() => useEffectivePracticeTimer({ enabled: true, sourceId: 'lesson', scope: 'learning' }))
    act(() => vi.advanceTimersByTime(5000))
    expect(activity.add.mock.calls.map(([record]) => [record.date, record.seconds])).toEqual([
      ['2026-11-13', 2], ['2026-11-14', 3],
    ])
  })
  it('stops a mounted old timer after the existing account-reset boundary', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 12))
    renderHook(() => useEffectivePracticeTimer({ enabled: true, sourceId: 'lesson', scope: 'learning' }))
    activity.generation++
    act(() => vi.advanceTimersByTime(10000))
    expect(activity.add).not.toHaveBeenCalled()
  })
  it('does not backfill an idle interval when interaction resumes', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 12))
    renderHook(() => useEffectivePracticeTimer({ enabled: true, sourceId: 'lesson', scope: 'learning' }))
    act(() => vi.advanceTimersByTime(65000))
    expect(activity.add.mock.calls.reduce((sum, [record]) => sum + record.seconds, 0)).toBe(60)
    act(() => { document.dispatchEvent(new Event('pointerdown')); vi.advanceTimersByTime(5000) })
    expect(activity.add.mock.calls.reduce((sum, [record]) => sum + record.seconds, 0)).toBe(65)
  })
  it('stops the background timer and does not count background time on resume', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 12))
    renderHook(() => useEffectivePracticeTimer({ enabled: true, sourceId: 'lesson', scope: 'learning' }))
    act(() => vi.advanceTimersByTime(5000))
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(60000)
    })
    expect(activity.add.mock.calls.reduce((sum, [record]) => sum + record.seconds, 0)).toBe(5)
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(5000)
    })
    expect(activity.add.mock.calls.reduce((sum, [record]) => sum + record.seconds, 0)).toBe(10)
  })
  it('keeps duration stable when the wall clock changes', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 12))
    renderHook(() => useEffectivePracticeTimer({ enabled: true, sourceId: 'lesson', scope: 'learning' }))
    act(() => vi.advanceTimersByTime(5000))
    vi.setSystemTime(new Date(2026, 10, 14, 18))
    act(() => vi.advanceTimersByTime(5000))
    expect(activity.add.mock.calls.reduce((sum, [record]) => sum + record.seconds, 0)).toBe(10)
  })
  it('only lets the active timer accrue time on this device', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 12))
    renderHook(() => useEffectivePracticeTimer({ enabled: true, sourceId: 'same-lesson', scope: 'learning' }))
    renderHook(() => useEffectivePracticeTimer({ enabled: true, sourceId: 'same-lesson', scope: 'learning' }))
    act(() => vi.advanceTimersByTime(5000))
    expect(new Set(activity.add.mock.calls.map(([record]) => record.sourceId)).size).toBe(1)
  })
})

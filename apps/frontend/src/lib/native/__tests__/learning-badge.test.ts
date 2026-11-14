import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  native: true,
  set: vi.fn(),
  review: vi.fn(),
  plan: vi.fn(),
  facts: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }))
vi.mock('@capawesome/capacitor-badge', () => ({ Badge: {
  isSupported: async () => ({ isSupported: true }),
  checkPermissions: async () => ({ display: 'granted' }),
  set: mocks.set,
} }))
vi.mock('@/lib/offline/unified-storage', () => ({ localDb: {} }))
vi.mock('@/stores/preferences.store', () => ({ usePreferencesStore: {} }))
vi.mock('@/lib/offline/daily-practice.repository', () => ({ dailyPracticeRepository: {
  getReviewDebtCount: mocks.review,
  buildTodayPlan: mocks.plan,
  getRunFacts: mocks.facts,
} }))

import { refreshLearningBadgeFromTodayRun } from '../learning-reminder'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.native = true
  mocks.review.mockResolvedValue(0)
  mocks.plan.mockResolvedValue({ runId: 'today', scheduledItemIds: ['a', 'b', 'c'] })
  mocks.facts.mockResolvedValue({ attemptedItemIds: ['a'] })
})

describe('learning badge', () => {
  it('shows all due reviews before learning, without needing a review run', async () => {
    mocks.review.mockResolvedValue(12)
    await refreshLearningBadgeFromTodayRun()
    expect(mocks.set).toHaveBeenCalledWith({ count: 12 })
    expect(mocks.plan).not.toHaveBeenCalled()
  })

  it('switches to remaining learning only after review reaches zero', async () => {
    mocks.review.mockResolvedValueOnce(1).mockResolvedValue(0)
    await refreshLearningBadgeFromTodayRun()
    await refreshLearningBadgeFromTodayRun()
    expect(mocks.set.mock.calls).toEqual([[{ count: 1 }], [{ count: 2 }]])
    expect(mocks.plan).toHaveBeenCalledWith(undefined, undefined, 'practice', { readOnly: true })
  })

  it('clears the badge when both queues are complete', async () => {
    mocks.facts.mockResolvedValue({ attemptedItemIds: ['a', 'b', 'c'] })
    await refreshLearningBadgeFromTodayRun()
    expect(mocks.set).toHaveBeenCalledWith({ count: 0 })
  })

  it('discards an outdated calculation when another refresh arrives', async () => {
    let release!: (count: number) => void
    mocks.review.mockImplementationOnce(() => new Promise<number>((resolve) => { release = resolve }))
    const first = refreshLearningBadgeFromTodayRun()
    await vi.waitFor(() => expect(mocks.review).toHaveBeenCalledTimes(1))
    const second = refreshLearningBadgeFromTodayRun()
    release(20)
    await Promise.all([first, second])
    expect(mocks.set.mock.calls).toEqual([[{ count: 2 }]])
  })

  it('allows later refreshes after a failed calculation', async () => {
    mocks.review.mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(refreshLearningBadgeFromTodayRun()).rejects.toThrow('storage unavailable')
    await refreshLearningBadgeFromTodayRun()
    expect(mocks.set).toHaveBeenCalledWith({ count: 2 })
  })

  it('does not access native plugins in the browser', async () => {
    mocks.native = false
    await refreshLearningBadgeFromTodayRun()
    expect(mocks.review).not.toHaveBeenCalled()
    expect(mocks.set).not.toHaveBeenCalled()
  })
})

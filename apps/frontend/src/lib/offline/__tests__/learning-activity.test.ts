import { beforeEach, describe, expect, it, vi } from 'vitest'
const save = vi.hoisted(() => vi.fn(async (_record: any) => {}))
vi.mock('../unified-storage', () => ({ localDb: { saveLearningActivity: save } }))
import { flushPracticeActivityRecords, usePracticeActivityStore, waitForActivityWrites } from '../../../stores/practice-activity.store'
beforeEach(async () => { await waitForActivityWrites().catch(() => undefined); usePracticeActivityStore.getState().reset(); save.mockReset().mockResolvedValue(undefined) })
describe('bounded runtime duration state', () => {
  it('retries an uncommitted increment without scanning historical sources', async () => {
    save.mockRejectedValueOnce(new Error('disk full'))
    usePracticeActivityStore.getState().addActiveSeconds({ date: '2026-11-13', sourceId: 'timer:one', scope: 'learning', seconds: 30 })
    await waitForActivityWrites().catch(() => undefined)
    await flushPracticeActivityRecords()
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ activeSeconds: 30, sourceId: 'timer:one' }))
    const calls = save.mock.calls.length
    await flushPracticeActivityRecords()
    expect(save.mock.calls).toHaveLength(calls)
  })
  it('releases completed timers from Zustand after saving', async () => {
    usePracticeActivityStore.getState().addActiveSeconds({ date: '2026-11-13', sourceId: 'timer:one', scope: 'learning', seconds: 30 })
    await waitForActivityWrites()
    usePracticeActivityStore.getState().releaseSource('timer:one')
    expect(usePracticeActivityStore.getState().records).toEqual({})
  })
})

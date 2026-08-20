export interface PracticeRunForPlanning {
  id: string
  date: string
  mode: 'practice' | 'review'
  scope: 'single' | 'mixed'
  packIdsKey: string
  scheduledItemIds: string[]
}

function normalizedPackKey(packIds: string[]) {
  return [...packIds].sort().join(',') || 'none'
}

export function deriveTodayScheduledPracticeIds(
  runs: PracticeRunForPlanning[],
  date: string,
  scope: 'single' | 'mixed',
  packIds: string[],
) {
  const requestedPackKey = normalizedPackKey(packIds)
  return new Set(runs
    .filter((run) => run.mode === 'practice' && run.date === date && run.scope === scope && run.packIdsKey === requestedPackKey)
    .flatMap((run) => run.scheduledItemIds ?? []))
}

export function compareReviewDebt<
  T extends { candidate: { itemId: string }; progress: { dueDate: string; lapseCount: number } },
>(left: T, right: T) {
  return left.progress.dueDate.localeCompare(right.progress.dueDate)
    || right.progress.lapseCount - left.progress.lapseCount
    || left.candidate.itemId.localeCompare(right.candidate.itemId)
}

export function selectPracticeBatch<T>(params: {
  carryoverUnresolved: T[]
  carryoverUnattempted: T[]
  fresh: T[]
  todayScheduledIds: Set<string>
  goal: number
  getId: (item: T) => string
}) {
  const seen = new Set<string>()
  return [...params.carryoverUnresolved, ...params.carryoverUnattempted, ...params.fresh]
    .filter((item) => {
      const id = params.getId(item)
      if (seen.has(id) || params.todayScheduledIds.has(id)) return false
      seen.add(id)
      return true
    })
    .slice(0, params.goal)
}

export function selectReviewBatch<T>(sortedDebt: T[], reviewBatchSize: number) {
  return sortedDebt.slice(0, Math.max(0, reviewBatchSize))
}

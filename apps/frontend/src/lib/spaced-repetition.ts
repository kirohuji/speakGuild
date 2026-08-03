export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewScheduleState {
  reviewCount: number
  intervalDays: number
  easeFactor: number
  lapseCount: number
}

export interface ReviewScheduleResult extends ReviewScheduleState {
  dueAt: Date
  status: 'learning' | 'review' | 'mastered'
}

const MIN_EASE_FACTOR = 1.3
const MAX_INTERVAL_DAYS = 36500

const QUALITY_BY_RATING: Record<ReviewRating, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
}

export function isReviewRating(value: unknown): value is ReviewRating {
  return value === 'again' || value === 'hard' || value === 'good' || value === 'easy'
}

export function warmupScoreToReviewRating(score?: string | null): ReviewRating {
  if (score === 'strong') return 'easy'
  if (score === 'ok') return 'good'
  return 'again'
}

export function scheduleReview(
  current: ReviewScheduleState,
  rating: ReviewRating,
  reviewedAt: Date = new Date(),
): ReviewScheduleResult {
  const quality = QUALITY_BY_RATING[rating]
  const previousReviewCount = Math.max(0, Math.floor(current.reviewCount || 0))
  const previousInterval = Math.max(0, Math.floor(current.intervalDays || 0))
  const previousEase = Math.max(MIN_EASE_FACTOR, Number(current.easeFactor) || 2.5)
  const previousLapses = Math.max(0, Math.floor(current.lapseCount || 0))

  const easeFactor = Math.max(
    MIN_EASE_FACTOR,
    previousEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  )

  const passed = quality >= 3
  const reviewCount = passed ? previousReviewCount + 1 : 0
  const lapseCount = passed ? previousLapses : previousLapses + 1

  let intervalDays: number
  if (!passed || reviewCount === 1) intervalDays = 1
  else if (reviewCount === 2) intervalDays = 6
  else intervalDays = Math.round(Math.max(1, previousInterval) * easeFactor)
  intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(1, intervalDays))

  const dueAt = new Date(reviewedAt)
  dueAt.setUTCDate(dueAt.getUTCDate() + intervalDays)

  const status = !passed
    ? 'learning'
    : reviewCount >= 4 && intervalDays >= 21
      ? 'mastered'
      : 'review'

  return { reviewCount, intervalDays, easeFactor, lapseCount, dueAt, status }
}

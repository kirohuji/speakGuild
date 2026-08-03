import { describe, expect, it } from 'vitest'
import {
  scheduleReview as scheduleOnClient,
  warmupScoreToReviewRating,
  type ReviewRating,
} from './spaced-repetition'
import { scheduleReview as scheduleOnServer } from '../../../backend/src/common/spaced-repetition'

const start = new Date('2026-08-03T12:00:00.000Z')

function runSequence(schedule: typeof scheduleOnClient, ratings: ReviewRating[]) {
  let state = { reviewCount: 0, intervalDays: 0, easeFactor: 2.5, lapseCount: 0 }
  return ratings.map((rating) => {
    const result = schedule(state, rating, start)
    state = result
    return result
  })
}

describe('shared spaced repetition rules', () => {
  it('uses the previous interval after the first two successful reviews', () => {
    const results = runSequence(scheduleOnClient, ['good', 'good', 'good', 'good'])
    expect(results.map((item) => item.intervalDays)).toEqual([1, 6, 15, 38])
    expect(results.at(-1)?.status).toBe('mastered')
  })

  it('resets successful repetitions and records a lapse after Again', () => {
    const results = runSequence(scheduleOnClient, ['easy', 'easy', 'again'])
    expect(results.at(-1)).toMatchObject({
      reviewCount: 0,
      intervalDays: 1,
      lapseCount: 1,
      status: 'learning',
    })
  })

  it('maps warmup scores onto the shared ratings', () => {
    expect(warmupScoreToReviewRating('strong')).toBe('easy')
    expect(warmupScoreToReviewRating('ok')).toBe('good')
    expect(warmupScoreToReviewRating('weak')).toBe('again')
    expect(warmupScoreToReviewRating('miss')).toBe('again')
  })

  it('keeps client and server schedule results identical', () => {
    const ratings: ReviewRating[] = ['easy', 'good', 'hard', 'again', 'good', 'easy']
    const client = runSequence(scheduleOnClient, ratings)
    const server = runSequence(scheduleOnServer, ratings)
    expect(server).toEqual(client)
  })
})

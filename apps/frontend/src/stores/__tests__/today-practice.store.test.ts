import { describe, expect, it } from 'vitest'
import {
  deriveTodayPractice,
  initialTodayPracticeState,
  todayPracticeReducer,
  type StoredTodayRunFacts,
} from '../today-practice.store'

function run(mode: 'practice' | 'review' = 'practice'): StoredTodayRunFacts {
  return {
    id: `run-${mode}`,
    mode,
    scheduledItemIds: ['a', 'b'],
    attemptedItemIds: [],
    unresolvedItemIds: [],
    srsAppliedItemIds: [],
    initialRecallResults: {},
    continuationResults: {},
    remediationResults: {},
    attemptHistory: [],
    submissionStatus: 'idle',
  }
}

describe('today practice V2.5.1 state machine', () => {
  it('keeps initial Review Again immutable after remediation succeeds', () => {
    let state = todayPracticeReducer(initialTodayPracticeState, { type: 'RUN_LOADED', run: run('review') })
    state = todayPracticeReducer(state, { type: 'INITIAL_RECALL_ATTEMPT', stepId: 'a', outcome: 'incorrect', assistance: 'none' })
    state = todayPracticeReducer(state, { type: 'SRS_APPLIED', stepId: 'a' })
    state = todayPracticeReducer(state, { type: 'MISTAKE_RETRY_STARTED' })
    state = todayPracticeReducer(state, { type: 'RETRY_CYCLE_ATTEMPT', stepId: 'a', outcome: 'correct', assistance: 'none' })

    expect(state.initialRecallResults.a).toMatchObject({ score: 'miss', srsRating: 'again' })
    expect(state.remediationResults.a).toMatchObject({ score: 'strong', resolved: true })
    expect(state.unresolvedIds.has('a')).toBe(false)
    expect(state.srsAppliedIds.has('a')).toBe(true)
  })

  it('caps a failed Practice exposure at weak and never applies SRS', () => {
    let state = todayPracticeReducer(initialTodayPracticeState, { type: 'RUN_LOADED', run: run() })
    state = todayPracticeReducer(state, { type: 'INITIAL_RECALL_ATTEMPT', stepId: 'a', outcome: 'incorrect', assistance: 'none' })
    state = todayPracticeReducer(state, { type: 'CONTINUATION_ATTEMPT', stepId: 'a', outcome: 'correct', assistance: 'none' })

    expect(state.initialRecallResults.a.score).toBe('miss')
    expect(state.continuationResults.a).toMatchObject({ latestScore: 'weak', attemptCount: 1 })
    expect(state.unresolvedIds.has('a')).toBe(true)
    expect(state.srsAppliedIds.has('a')).toBe(false)
  })

  it('ends a failed retry cycle, rotates the queue, and starts a clean cycle', () => {
    const loaded = { ...run(), attemptedItemIds: ['a', 'b'], unresolvedItemIds: ['a', 'b'] }
    let state = todayPracticeReducer(initialTodayPracticeState, { type: 'RUN_LOADED', run: loaded })
    state = todayPracticeReducer(state, { type: 'MISTAKE_RETRY_STARTED' })
    state = todayPracticeReducer(state, { type: 'RETRY_CYCLE_ATTEMPT', stepId: 'a', outcome: 'dontKnow', assistance: 'none' })

    expect(state.retryQueueIds).toEqual(['b', 'a'])
    expect(state.currentStepId).toBe('b')
    expect(state.retryCycles.b).toMatchObject({ cycle: 1, retrievalFailed: false, answerRevealed: false })

    state = todayPracticeReducer(state, { type: 'RETRY_CYCLE_ATTEMPT', stepId: 'b', outcome: 'correct', assistance: 'hint' })
    expect(state.remediationResults.b).toMatchObject({ score: 'ok', resolved: true })
    expect(state.currentStepId).toBe('a')
    expect(state.retryCycles.a).toMatchObject({ cycle: 2, retrievalFailed: false, answerRevealed: false })
  })

  it('does not classify unattempted steps as unresolved or resolved', () => {
    let state = todayPracticeReducer(initialTodayPracticeState, { type: 'RUN_LOADED', run: run() })
    state = todayPracticeReducer(state, { type: 'INITIAL_RECALL_ATTEMPT', stepId: 'a', outcome: 'correct', assistance: 'none' })
    const derived = deriveTodayPractice(state)

    expect(derived.greenStepIds).toEqual(['a'])
    expect(derived.redStepIds).toEqual([])
    expect(derived.grayStepIds).toEqual(['b'])
    expect(derived.allAttempted).toBe(false)
    expect(derived.allResolved).toBe(false)
  })

  it('hydrates all run-local facts without using completedItemIds', () => {
    const stored: StoredTodayRunFacts = {
      ...run(),
      attemptedItemIds: ['a'],
      unresolvedItemIds: ['a'],
      srsAppliedItemIds: [],
      initialRecallResults: { a: { stepId: 'a', outcome: 'incorrect', assistance: 'none', score: 'miss' } },
      continuationResults: { a: { stepId: 'a', latestScore: 'weak', attemptCount: 2 } },
      remediationResults: {},
      submissionStatus: 'dirty',
    }
    const state = todayPracticeReducer(initialTodayPracticeState, { type: 'RUN_LOADED', run: stored })
    expect(state.initialRecallResults).toEqual(stored.initialRecallResults)
    expect(state.continuationResults).toEqual(stored.continuationResults)
    expect([...state.attemptedIds]).toEqual(['a'])
    expect([...state.unresolvedIds]).toEqual(['a'])
    expect(state.submissionStatus).toBe('dirty')
  })
})

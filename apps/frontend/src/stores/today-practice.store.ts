import { create } from 'zustand'

export type AttemptOutcome = 'correct' | 'incorrect' | 'dontKnow'
export type AssistanceLevel = 'none' | 'hint'
export type InitialRecallScore = 'strong' | 'ok' | 'miss'
export type TodayMode = 'practice' | 'review'
export type RoundKind = 'main' | 'mistakeRetry'
export type PracticePurpose = 'scheduled' | 'mistakeRetry' | 'rehearsal'
export type SubmissionStatus = 'idle' | 'dirty' | 'submitting' | 'synced' | 'failed'
export type SrsRating = 'easy' | 'good' | 'again'
export interface TodayCardAttempt {
  stepId: string
  outcome: AttemptOutcome
  assistance: AssistanceLevel
  purpose?: 'scheduled' | 'rehearsal'
}

export interface InitialRecallResult {
  stepId: string
  outcome: AttemptOutcome
  assistance: AssistanceLevel
  score: InitialRecallScore
  srsRating?: SrsRating
}

export interface ContinuationResult {
  stepId: string
  latestScore: 'weak' | 'miss'
  attemptCount: number
}

export interface RemediationResult {
  stepId: string
  score: 'strong' | 'ok'
  resolved: true
  cycle: number
}

export interface RetryCycleState {
  stepId: string
  cycle: number
  retrievalFailed: boolean
  answerRevealed: boolean
}

export interface AttemptHistoryEntry {
  id: string
  stepId: string
  purpose: PracticePurpose
  outcome: AttemptOutcome
  assistance: AssistanceLevel
  score: InitialRecallScore | 'weak'
  cycle?: number
  createdAt: string
}

export interface StoredTodayRunFacts {
  id: string
  mode: TodayMode
  scheduledItemIds: string[]
  attemptedItemIds: string[]
  unresolvedItemIds: string[]
  srsAppliedItemIds: string[]
  initialRecallResults: Record<string, InitialRecallResult>
  continuationResults: Record<string, ContinuationResult | undefined>
  remediationResults: Record<string, RemediationResult | undefined>
  attemptHistory?: AttemptHistoryEntry[]
  submissionStatus: SubmissionStatus
  roundKind?: RoundKind
  sessionStepIds?: string[]
  currentStepId?: string | null
}

export interface TodayPracticeState {
  runId: string | null
  mode: TodayMode
  roundKind: RoundKind
  roundStepIds: string[]
  attemptedIds: Set<string>
  unresolvedIds: Set<string>
  srsAppliedIds: Set<string>
  initialRecallResults: Record<string, InitialRecallResult>
  continuationResults: Record<string, ContinuationResult | undefined>
  remediationResults: Record<string, RemediationResult | undefined>
  attemptHistory: AttemptHistoryEntry[]
  sessionStepIds: string[]
  currentStepId: string | null
  retryQueueIds: string[]
  retryCycles: Record<string, RetryCycleState>
  sessionHydrated: boolean
  submissionStatus: SubmissionStatus
}

export type TodayPracticeEvent =
  | { type: 'RUN_LOADED'; run: StoredTodayRunFacts }
  | { type: 'MAIN_SESSION_OPENED'; stepIds: string[]; startStepId: string | null }
  | { type: 'INITIAL_RECALL_ATTEMPT'; stepId: string; outcome: AttemptOutcome; assistance: AssistanceLevel; now?: string }
  | { type: 'CONTINUATION_ATTEMPT'; stepId: string; outcome: AttemptOutcome; assistance: AssistanceLevel; now?: string }
  | { type: 'MISTAKE_RETRY_STARTED'; stepIds?: string[] }
  | { type: 'RETRY_CYCLE_ATTEMPT'; stepId: string; outcome: AttemptOutcome; assistance: AssistanceLevel; now?: string }
  | { type: 'REHEARSAL_ATTEMPT'; stepId: string; outcome: AttemptOutcome; assistance: AssistanceLevel; now?: string }
  | { type: 'CURRENT_STEP_SET'; stepId: string | null }
  | { type: 'SESSION_CLOSED' }
  | { type: 'SRS_APPLIED'; stepId: string }
  | { type: 'SUBMISSION_STARTED' }
  | { type: 'SUBMISSION_SYNCED' }
  | { type: 'SUBMISSION_FAILED' }

export const initialTodayPracticeState: TodayPracticeState = {
  runId: null,
  mode: 'practice',
  roundKind: 'main',
  roundStepIds: [],
  attemptedIds: new Set(),
  unresolvedIds: new Set(),
  srsAppliedIds: new Set(),
  initialRecallResults: {},
  continuationResults: {},
  remediationResults: {},
  attemptHistory: [],
  sessionStepIds: [],
  currentStepId: null,
  retryQueueIds: [],
  retryCycles: {},
  sessionHydrated: false,
  submissionStatus: 'idle',
}

export function initialRecallScore(outcome: AttemptOutcome, assistance: AssistanceLevel): InitialRecallScore {
  if (outcome !== 'correct') return 'miss'
  return assistance === 'hint' ? 'ok' : 'strong'
}

export function toInitialSrsRating(mode: TodayMode, result: InitialRecallResult): SrsRating | null {
  if (result.score === 'strong') return 'easy'
  if (result.score === 'ok') return 'good'
  return mode === 'review' ? 'again' : null
}

export function toPracticeRemediationSrsRating(result: RemediationResult): 'easy' | 'good' {
  return result.score === 'strong' ? 'easy' : 'good'
}

function appendHistory(state: TodayPracticeState, input: Omit<AttemptHistoryEntry, 'id' | 'createdAt'> & { now?: string }) {
  const createdAt = input.now ?? new Date().toISOString()
  const { now: _now, ...entry } = input
  return [...state.attemptHistory, { ...entry, id: `${state.runId}:${entry.stepId}:${state.attemptHistory.length + 1}`, createdAt }]
}

function dirty(state: TodayPracticeState): TodayPracticeState {
  return { ...state, submissionStatus: 'dirty' }
}

function nextRetryCycle(state: TodayPracticeState, stepId: string): RetryCycleState {
  const previous = state.retryCycles[stepId]?.cycle ?? 0
  return { stepId, cycle: previous + 1, retrievalFailed: false, answerRevealed: false }
}

export function todayPracticeReducer(state: TodayPracticeState, event: TodayPracticeEvent): TodayPracticeState {
  switch (event.type) {
    case 'RUN_LOADED': {
      const run = event.run
      const retryQueueIds = run.roundKind === 'mistakeRetry'
        ? run.scheduledItemIds.filter((id) => run.unresolvedItemIds.includes(id))
        : []
      const restoredSessionIds = run.roundKind === 'mistakeRetry'
        ? [...retryQueueIds]
        : (run.sessionStepIds ?? []).filter((id) => run.scheduledItemIds.includes(id))
      const restoredCurrentId = run.roundKind === 'mistakeRetry'
        ? (retryQueueIds[0] ?? null)
        : (run.currentStepId && restoredSessionIds.includes(run.currentStepId) ? run.currentStepId : (restoredSessionIds[0] ?? null))
      return {
        ...initialTodayPracticeState,
        runId: run.id,
        mode: run.mode,
        roundStepIds: [...run.scheduledItemIds],
        attemptedIds: new Set(run.attemptedItemIds.filter((id) => run.scheduledItemIds.includes(id))),
        unresolvedIds: new Set(run.unresolvedItemIds.filter((id) => run.scheduledItemIds.includes(id) && run.attemptedItemIds.includes(id))),
        srsAppliedIds: new Set(run.srsAppliedItemIds.filter((id) => run.scheduledItemIds.includes(id))),
        initialRecallResults: { ...run.initialRecallResults },
        continuationResults: { ...run.continuationResults },
        remediationResults: { ...run.remediationResults },
        attemptHistory: [...(run.attemptHistory ?? [])],
        sessionHydrated: true,
        submissionStatus: run.submissionStatus,
        roundKind: run.roundKind ?? 'main',
        retryQueueIds,
        sessionStepIds: restoredSessionIds,
        currentStepId: restoredCurrentId,
        retryCycles: run.roundKind === 'mistakeRetry' && restoredCurrentId
          ? { [restoredCurrentId]: { stepId: restoredCurrentId, cycle: 1, retrievalFailed: false, answerRevealed: false } }
          : {},
      }
    }
    case 'MAIN_SESSION_OPENED':
      return { ...state, roundKind: 'main', sessionStepIds: [...event.stepIds], currentStepId: event.startStepId, retryQueueIds: [], retryCycles: {} }
    case 'INITIAL_RECALL_ATTEMPT': {
      if (!state.roundStepIds.includes(event.stepId) || state.initialRecallResults[event.stepId]) return state
      const score = initialRecallScore(event.outcome, event.assistance)
      const baseResult: InitialRecallResult = { stepId: event.stepId, outcome: event.outcome, assistance: event.assistance, score }
      const rating = toInitialSrsRating(state.mode, baseResult)
      const result = rating ? { ...baseResult, srsRating: rating } : baseResult
      const attemptedIds = new Set(state.attemptedIds).add(event.stepId)
      const unresolvedIds = new Set(state.unresolvedIds)
      if (score === 'miss') unresolvedIds.add(event.stepId)
      else unresolvedIds.delete(event.stepId)
      return dirty({
        ...state,
        attemptedIds,
        unresolvedIds,
        initialRecallResults: { ...state.initialRecallResults, [event.stepId]: result },
        attemptHistory: appendHistory(state, { stepId: event.stepId, purpose: 'scheduled', outcome: event.outcome, assistance: event.assistance, score, now: event.now }),
      })
    }
    case 'CONTINUATION_ATTEMPT': {
      const initial = state.initialRecallResults[event.stepId]
      if (!initial || initial.score !== 'miss') return state
      const previous = state.continuationResults[event.stepId]
      const latestScore = event.outcome === 'correct' ? 'weak' : 'miss'
      return dirty({
        ...state,
        continuationResults: { ...state.continuationResults, [event.stepId]: { stepId: event.stepId, latestScore, attemptCount: (previous?.attemptCount ?? 0) + 1 } },
        attemptHistory: appendHistory(state, { stepId: event.stepId, purpose: 'scheduled', outcome: event.outcome, assistance: event.assistance, score: latestScore, now: event.now }),
      })
    }
    case 'MISTAKE_RETRY_STARTED': {
      const requested = new Set(event.stepIds ?? state.roundStepIds)
      const retryQueueIds = state.roundStepIds.filter((id) => requested.has(id) && state.unresolvedIds.has(id))
      const first = retryQueueIds[0] ?? null
      return { ...state, roundKind: 'mistakeRetry', retryQueueIds, sessionStepIds: [...retryQueueIds], currentStepId: first, retryCycles: first ? { [first]: nextRetryCycle(state, first) } : {} }
    }
    case 'RETRY_CYCLE_ATTEMPT': {
      if (state.roundKind !== 'mistakeRetry' || state.currentStepId !== event.stepId) return state
      const cycle = state.retryCycles[event.stepId] ?? nextRetryCycle(state, event.stepId)
      const score = initialRecallScore(event.outcome, event.assistance)
      const history = appendHistory(state, { stepId: event.stepId, purpose: 'mistakeRetry', outcome: event.outcome, assistance: event.assistance, score, cycle: cycle.cycle, now: event.now })
      if (score === 'strong' || score === 'ok') {
        const unresolvedIds = new Set(state.unresolvedIds)
        unresolvedIds.delete(event.stepId)
        const retryQueueIds = state.retryQueueIds.filter((id) => id !== event.stepId)
        return dirty({
          ...state,
          unresolvedIds,
          remediationResults: { ...state.remediationResults, [event.stepId]: { stepId: event.stepId, score, resolved: true, cycle: cycle.cycle } },
          attemptHistory: history,
          retryQueueIds,
          // Keep the scored card in place.  Main practice lets the learner
          // read the feedback and use the shared navigator; mistake retry
          // must follow that same interaction instead of jumping away.
          currentStepId: event.stepId,
          retryCycles: state.retryCycles,
        })
      }
      const retryQueueIds = [...state.retryQueueIds.filter((id) => id !== event.stepId), event.stepId]
      return dirty({
        ...state,
        attemptHistory: history,
        retryQueueIds,
        currentStepId: event.stepId,
        retryCycles: { ...state.retryCycles, [event.stepId]: { ...cycle, retrievalFailed: true, answerRevealed: event.outcome === 'dontKnow' } },
      })
    }
    case 'REHEARSAL_ATTEMPT': {
      const score = initialRecallScore(event.outcome, event.assistance)
      return { ...state, attemptHistory: appendHistory(state, { stepId: event.stepId, purpose: 'rehearsal', outcome: event.outcome, assistance: event.assistance, score, now: event.now }) }
    }
    case 'CURRENT_STEP_SET':
      return event.stepId === null || state.sessionStepIds.includes(event.stepId) ? { ...state, currentStepId: event.stepId } : state
    case 'SESSION_CLOSED':
      return { ...state, sessionStepIds: [], currentStepId: null, roundKind: 'main', retryQueueIds: [], retryCycles: {} }
    case 'SRS_APPLIED':
      return dirty({ ...state, srsAppliedIds: new Set(state.srsAppliedIds).add(event.stepId) })
    case 'SUBMISSION_STARTED': return { ...state, submissionStatus: 'submitting' }
    case 'SUBMISSION_SYNCED': return { ...state, submissionStatus: 'synced' }
    case 'SUBMISSION_FAILED': return { ...state, submissionStatus: 'failed' }
  }
}

export interface TodayPracticeDerived {
  greenStepIds: string[]
  redStepIds: string[]
  grayStepIds: string[]
  greenCount: number
  redCount: number
  grayCount: number
  attemptedCount: number
  unresolvedCount: number
  allAttempted: boolean
  allResolved: boolean
  retryPendingCount: number
}

export function deriveTodayPractice(state: Pick<TodayPracticeState, 'roundStepIds' | 'attemptedIds' | 'unresolvedIds' | 'retryQueueIds'>): TodayPracticeDerived {
  const grayStepIds = state.roundStepIds.filter((id) => !state.attemptedIds.has(id))
  const redStepIds = state.roundStepIds.filter((id) => state.attemptedIds.has(id) && state.unresolvedIds.has(id))
  const greenStepIds = state.roundStepIds.filter((id) => state.attemptedIds.has(id) && !state.unresolvedIds.has(id))
  const allAttempted = grayStepIds.length === 0 && state.roundStepIds.length > 0
  return {
    greenStepIds, redStepIds, grayStepIds,
    greenCount: greenStepIds.length, redCount: redStepIds.length, grayCount: grayStepIds.length,
    attemptedCount: state.roundStepIds.filter((id) => state.attemptedIds.has(id)).length,
    unresolvedCount: redStepIds.length,
    allAttempted, allResolved: allAttempted && redStepIds.length === 0,
    retryPendingCount: state.retryQueueIds.length,
  }
}

export function serializeTodayRunFacts(state: TodayPracticeState): StoredTodayRunFacts | null {
  if (!state.runId) return null
  return {
    id: state.runId,
    mode: state.mode,
    scheduledItemIds: [...state.roundStepIds],
    attemptedItemIds: [...state.attemptedIds],
    unresolvedItemIds: [...state.unresolvedIds],
    srsAppliedItemIds: [...state.srsAppliedIds],
    initialRecallResults: { ...state.initialRecallResults },
    continuationResults: { ...state.continuationResults },
    remediationResults: { ...state.remediationResults },
    attemptHistory: [...state.attemptHistory],
    submissionStatus: state.submissionStatus,
    roundKind: state.roundKind,
    sessionStepIds: [...state.sessionStepIds],
    currentStepId: state.currentStepId,
  }
}

interface TodayPracticeActions {
  dispatch: (event: TodayPracticeEvent) => void
  reset: () => void
}

export const useTodayPracticeStore = create<TodayPracticeState & TodayPracticeActions>((set) => ({
  ...initialTodayPracticeState,
  dispatch: (event) => set((state) => todayPracticeReducer(state, event)),
  reset: () => set(initialTodayPracticeState),
}))

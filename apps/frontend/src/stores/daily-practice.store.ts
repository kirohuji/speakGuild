import { create } from 'zustand'
import {
  dailyPracticeRepository,
  type DailyPracticePlan,
  type DailyPracticePlanMode,
  type ScheduledDailyPracticeItem,
} from '@/lib/offline/daily-practice.repository'
import { useWarmupSessionStore, type WarmupRecordEntry } from '@/stores/warmup-session.store'
import { refreshLearningBadgeFromTodayRun } from '@/lib/native/learning-reminder'
import {
  deriveTodayPractice,
  serializeTodayRunFacts,
  toInitialSrsRating,
  toPracticeRemediationSrsRating,
  useTodayPracticeStore,
  type AssistanceLevel,
  type AttemptOutcome,
  type StoredTodayRunFacts,
} from '@/stores/today-practice.store'

interface DailyPracticeState {
  plan: DailyPracticePlan | null
  loading: boolean
  error: string | null
  submitting: boolean
  loadToday: (targetPackId?: string | null, targetDate?: string | null, mode?: DailyPracticePlanMode, forceNew?: boolean) => Promise<void>
  recordAttempt: (step: ScheduledDailyPracticeItem, outcome: AttemptOutcome, assistance: AssistanceLevel) => Promise<void>
  recordRehearsalAttempt: (stepId: string, outcome: AttemptOutcome, assistance: AssistanceLevel) => Promise<void>
  openMainSession: (startStepId?: string | null) => void
  startMistakeRetry: () => void
  setCurrentStep: (stepId: string | null) => void
  closeSession: () => void
  submitToday: (records: WarmupRecordEntry[], localWarmupRecordId?: string | null) => Promise<void>
  reshuffle: (targetPackId?: string | null, targetDate?: string | null, mode?: DailyPracticePlanMode) => Promise<void>
  reset: () => void
}

let attemptChain: Promise<void> = Promise.resolve()

function emptyFacts(plan: DailyPracticePlan): StoredTodayRunFacts {
  return {
    id: plan.runId,
    mode: plan.mode,
    scheduledItemIds: [...plan.scheduledItemIds],
    attemptedItemIds: [],
    unresolvedItemIds: [],
    srsAppliedItemIds: [],
    initialRecallResults: {},
    continuationResults: {},
    remediationResults: {},
    attemptHistory: [],
    submissionStatus: 'idle',
    roundKind: 'main',
    sessionStepIds: [],
    currentStepId: null,
  }
}

async function persistCurrentFacts() {
  const facts = serializeTodayRunFacts(useTodayPracticeStore.getState())
  if (facts) await dailyPracticeRepository.persistRunFacts(facts)
}

export const useDailyPracticeStore = create<DailyPracticeState>((set, get) => ({
  plan: null,
  loading: false,
  error: null,
  submitting: false,

  async loadToday(targetPackId, targetDate, mode = 'practice', forceNew = false) {
    set({ loading: true, error: null })
    try {
      let plan = await dailyPracticeRepository.buildTodayPlan(targetPackId, targetDate, mode, { forceNew })
      const facts = await dailyPracticeRepository.getRunFacts(plan.runId).catch(() => null)
      useTodayPracticeStore.getState().dispatch({ type: 'RUN_LOADED', run: facts ?? emptyFacts(plan) })
      for (const step of plan.steps) {
        const machine = useTodayPracticeStore.getState()
        if (machine.srsAppliedIds.has(step.itemId)) continue
        const initial = machine.initialRecallResults[step.itemId]
        const remediation = machine.remediationResults[step.itemId]
        const rating = initial ? toInitialSrsRating(machine.mode, initial) : null
        const recoverableRating = rating ?? (machine.mode === 'practice' && remediation?.resolved ? toPracticeRemediationSrsRating(remediation) : null)
        if (!recoverableRating) continue
        const recovered = await dailyPracticeRepository.applySrsRatingOnce({ runId: plan.runId, step, rating: recoverableRating, targetDate: plan.date })
        plan = { ...plan, steps: plan.steps.map((item) => item.itemId === step.itemId ? { ...item, progress: recovered.progress } : item) }
        machine.dispatch({ type: 'SRS_APPLIED', stepId: step.itemId })
        await persistCurrentFacts()
      }
      set({ plan, loading: false })
    } catch (error: any) {
      set({ error: error?.message || '加载失败', loading: false, plan: null })
    }
  },

  async recordAttempt(step, outcome, assistance) {
    attemptChain = attemptChain.then(async () => {
      const before = useTodayPracticeStore.getState()
      if (!before.runId) return
      const dispatch = before.dispatch
      if (before.roundKind === 'mistakeRetry') {
        dispatch({ type: 'RETRY_CYCLE_ATTEMPT', stepId: step.itemId, outcome, assistance })
      } else if (before.initialRecallResults[step.itemId]) {
        dispatch({ type: 'CONTINUATION_ATTEMPT', stepId: step.itemId, outcome, assistance })
      } else {
        dispatch({ type: 'INITIAL_RECALL_ATTEMPT', stepId: step.itemId, outcome, assistance })
      }

      let after = useTodayPracticeStore.getState()
      if (before.roundKind === 'mistakeRetry' && after.currentStepId) {
        useWarmupSessionStore.getState().resetRetryCycleUi(after.currentStepId)
      }
      await persistCurrentFacts()
      void refreshLearningBadgeFromTodayRun().catch(() => undefined)

      const initial = after.initialRecallResults[step.itemId]
      const remediation = after.remediationResults[step.itemId]
      const rating = initial ? toInitialSrsRating(after.mode, initial) : null
      const recoverableRating = rating ?? (after.mode === 'practice' && remediation?.resolved ? toPracticeRemediationSrsRating(remediation) : null)

      if (recoverableRating && !after.srsAppliedIds.has(step.itemId)) {
        const result = await dailyPracticeRepository.applySrsRatingOnce({
          runId: after.runId!, step, rating: recoverableRating, targetDate: get().plan?.date,
        })
        dispatch({ type: 'SRS_APPLIED', stepId: step.itemId })
        after = useTodayPracticeStore.getState()
        await persistCurrentFacts()
        set((state) => state.plan ? ({
          plan: {
            ...state.plan,
            steps: state.plan.steps.map((item) => item.itemId === step.itemId ? { ...item, progress: result.progress } : item),
          },
        }) : state)
      }
    })
    return attemptChain
  },

  async recordRehearsalAttempt(stepId, outcome, assistance) {
    useTodayPracticeStore.getState().dispatch({ type: 'REHEARSAL_ATTEMPT', stepId, outcome, assistance })
    await persistCurrentFacts().catch(() => undefined)
  },

  openMainSession(startStepId) {
    const state = useTodayPracticeStore.getState()
    const candidates = state.roundStepIds.filter((id) => !state.attemptedIds.has(id))
    const stepIds = candidates.length > 0 ? candidates : [...state.roundStepIds]
    const first = startStepId && stepIds.includes(startStepId) ? startStepId : (stepIds[0] ?? null)
    state.dispatch({ type: 'MAIN_SESSION_OPENED', stepIds, startStepId: first })
    void persistCurrentFacts().catch(() => undefined)
  },

  startMistakeRetry() {
    const state = useTodayPracticeStore.getState()
    state.dispatch({ type: 'MISTAKE_RETRY_STARTED' })
    void persistCurrentFacts().catch(() => undefined)
  },

  setCurrentStep(stepId) {
    useTodayPracticeStore.getState().dispatch({ type: 'CURRENT_STEP_SET', stepId })
    void persistCurrentFacts().catch(() => undefined)
  },

  closeSession() {
    useTodayPracticeStore.getState().dispatch({ type: 'SESSION_CLOSED' })
    void persistCurrentFacts().catch(() => undefined)
  },

  async submitToday(records, localWarmupRecordId) {
    const plan = get().plan
    if (!plan) return
    const machine = useTodayPracticeStore.getState()
    if (!deriveTodayPractice(machine).allAttempted && machine.roundKind === 'main') return
    machine.dispatch({ type: 'SUBMISSION_STARTED' })
    set({ submitting: true })
    await persistCurrentFacts()
    try {
      await dailyPracticeRepository.completeRun(plan, records, localWarmupRecordId)
      useTodayPracticeStore.getState().dispatch({ type: 'SUBMISSION_SYNCED' })
      await persistCurrentFacts()
    } catch (error) {
      useTodayPracticeStore.getState().dispatch({ type: 'SUBMISSION_FAILED' })
      await persistCurrentFacts().catch(() => undefined)
      throw error
    } finally {
      set({ submitting: false })
    }
  },

  async reshuffle(targetPackId, targetDate, mode) {
    await get().loadToday(targetPackId, targetDate, mode, true)
  },

  reset() {
    useTodayPracticeStore.getState().reset()
    set({ plan: null, loading: false, error: null, submitting: false })
  },
}))

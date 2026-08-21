import { create } from 'zustand'
import {
  dailyPracticeRepository,
  type DailyPracticePlan,
  type DailyPracticePlanMode,
  type ScheduledDailyPracticeItem,
} from '@/lib/offline/daily-practice.repository'
import { useWarmupSessionStore, type WarmupRecordEntry } from '@/stores/warmup-session.store'
import { refreshLearningBadgeFromTodayRun } from '@/lib/native/learning-reminder'
import { offlineSyncService } from '@/lib/offline'
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
  /** 每个模式（今日复习/今日练习）已构建的计划缓存，切换时直接复用，避免重复构建 */
  plansByMode: Record<string, DailyPracticePlan>
  loading: boolean
  error: string | null
  submitting: boolean
  loadToday: (targetPackId?: string | null, targetDate?: string | null, mode?: DailyPracticePlanMode, forceNew?: boolean) => Promise<void>
  recordAttempt: (step: ScheduledDailyPracticeItem, outcome: AttemptOutcome, assistance: AssistanceLevel) => Promise<void>
  recordRehearsalAttempt: (stepId: string, outcome: AttemptOutcome, assistance: AssistanceLevel) => Promise<void>
  openMainSession: (startStepId?: string | null, options?: { stepIds?: string[]; includeAttempted?: boolean }) => void
  startMistakeRetry: () => void
  setCurrentStep: (stepId: string | null) => void
  closeSession: () => void
  syncRunSnapshot: (records?: WarmupRecordEntry[], localWarmupRecordId?: string | null) => Promise<void>
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

function planCacheKey(mode: DailyPracticePlanMode, targetDate?: string | null, targetPackId?: string | null) {
  return `${mode}:${targetDate ?? ''}:${targetPackId ?? ''}`
}

/** 把 plan + 本地 run facts 装载进今日状态机，并刷新 SRS 进度到最新。 */
async function hydratePlanIntoStore(plan: DailyPracticePlan) {
  const facts = await dailyPracticeRepository.getRunFacts(plan.runId).catch(() => null)
  useTodayPracticeStore.getState().dispatch({ type: 'RUN_LOADED', run: facts ?? emptyFacts(plan) })
  // Server recovery can restore an in-progress run from an earlier app
  // version where only the run snapshot existed. Re-enqueueing here makes
  // its derived per-question record durable as well.
  if (facts?.attemptedItemIds.length) {
    await dailyPracticeRepository.syncRunSnapshot(plan)
  }
  let hydrated = plan
  for (const step of plan.steps) {
    const machine = useTodayPracticeStore.getState()
    if (machine.srsAppliedIds.has(step.itemId)) continue
    const initial = machine.initialRecallResults[step.itemId]
    const remediation = machine.remediationResults[step.itemId]
    const rating = initial ? toInitialSrsRating(machine.mode, initial) : null
    const recoverableRating = rating ?? (machine.mode === 'practice' && remediation?.resolved ? toPracticeRemediationSrsRating(remediation) : null)
    if (!recoverableRating) continue
    const recovered = await dailyPracticeRepository.applySrsRatingOnce({ runId: plan.runId, step, rating: recoverableRating, targetDate: plan.date })
    hydrated = { ...hydrated, steps: hydrated.steps.map((item) => item.itemId === step.itemId ? { ...item, progress: recovered.progress } : item) }
    machine.dispatch({ type: 'SRS_APPLIED', stepId: step.itemId })
    await persistCurrentFacts()
  }
  return hydrated
}

export const useDailyPracticeStore = create<DailyPracticeState>((set, get) => ({
  plan: null,
  plansByMode: {},
  loading: false,
  error: null,
  submitting: false,

  async loadToday(targetPackId, targetDate, mode = 'practice', forceNew = false) {
    set({ loading: true, error: null })
    try {
      // 未显式指定学习包时，由“当前激活学习包”决定构建内容 → 把它纳入缓存
      // 维度。这样在学习计划页切换学习包后，下次 loadToday 的缓存 key 自然
      // 变化并重建，而不是复用旧学习包的计划；切 Tab（同包）仍命中缓存。
      const resolvedPackId = targetPackId
        ?? await dailyPracticeRepository.getActivePracticePackId().catch(() => null)
      const cacheKey = planCacheKey(mode, targetDate, resolvedPackId)
      const cachedPlan = get().plansByMode[cacheKey]
      // 切换「今日复习 ↔ 今日练习」时，目标模式的 plan 通常已经构建过。只要
      // 本地 run 还在，就直接复用缓存：完全跳过 buildTodayPlan（不再请求
      // 服务端、也就没有旧快照覆盖本地数据的风险），从本地 facts 恢复进度。
      if (cachedPlan && !forceNew) {
        const cachedFacts = await dailyPracticeRepository.getRunFacts(cachedPlan.runId).catch(() => null)
        if (cachedFacts) {
          const hydrated = await hydratePlanIntoStore(cachedPlan)
          set({ plan: hydrated, plansByMode: { ...get().plansByMode, [cacheKey]: hydrated }, loading: false })
          return
        }
      }
      // buildTodayPlan 会先向后端拉取“当前 run”来恢复进度。这里先提交本地
      // 待同步的改动（错题重练回答等还躺在 outbox 里），确保服务端拉回来的
      // 是最新状态，而不是旧快照反过来覆盖本地。pending 为空时 flush 是纯
      // 本地操作、无网络开销；离线失败也不阻塞，restore 守卫仍会保护本地。
      if (!forceNew) {
        await offlineSyncService.flush().catch(() => undefined)
      }
      const plan = await dailyPracticeRepository.buildTodayPlan(targetPackId, targetDate, mode, { forceNew })
      const hydrated = await hydratePlanIntoStore(plan)
      set({ plan: hydrated, plansByMode: { ...get().plansByMode, [cacheKey]: hydrated }, loading: false })
    } catch (error: any) {
      set({ error: error?.message || '加载失败', loading: false, plan: null })
    }
  },

  async recordAttempt(step, outcome, assistance) {
    // Capture and transition synchronously.  The card callback may be followed
    // immediately by a tab switch, which replaces the global Today store with
    // the other mode's run.  Queuing the transition itself made a successful
    // mistake retry look green briefly but persist to no run at all.
    const planAtAttempt = get().plan
    const before = useTodayPracticeStore.getState()
    if (!planAtAttempt || !before.runId || before.runId !== planAtAttempt.runId) return
    const dispatch = before.dispatch
    if (before.roundKind === 'mistakeRetry') {
      dispatch({ type: 'RETRY_CYCLE_ATTEMPT', stepId: step.itemId, outcome, assistance })
    } else if (before.initialRecallResults[step.itemId]) {
      dispatch({ type: 'CONTINUATION_ATTEMPT', stepId: step.itemId, outcome, assistance })
    } else {
      dispatch({ type: 'INITIAL_RECALL_ATTEMPT', stepId: step.itemId, outcome, assistance })
    }

    let after = useTodayPracticeStore.getState()
    const factsAtAttempt = serializeTodayRunFacts(after)
    const recordsAtAttempt = useWarmupSessionStore.getState().records
    if (!factsAtAttempt || factsAtAttempt.id !== planAtAttempt.runId) return
    attemptChain = attemptChain.catch(() => undefined).then(async () => {
      await dailyPracticeRepository.persistRunFacts(factsAtAttempt)
      void refreshLearningBadgeFromTodayRun().catch(() => undefined)

      const initial = after.initialRecallResults[step.itemId]
      const remediation = after.remediationResults[step.itemId]
      const rating = initial ? toInitialSrsRating(after.mode, initial) : null
      const recoverableRating = rating ?? (after.mode === 'practice' && remediation?.resolved ? toPracticeRemediationSrsRating(remediation) : null)

      if (recoverableRating && !after.srsAppliedIds.has(step.itemId)) {
        const result = await dailyPracticeRepository.applySrsRatingOnce({
          runId: planAtAttempt.runId, step, rating: recoverableRating, targetDate: planAtAttempt.date,
        })
        const persistedAfterSrs = {
          ...factsAtAttempt,
          srsAppliedItemIds: [...new Set([...factsAtAttempt.srsAppliedItemIds, step.itemId])],
        }
        await dailyPracticeRepository.persistRunFacts(persistedAfterSrs)

        // Only update the visible state when this exact run is still active.
        if (useTodayPracticeStore.getState().runId === planAtAttempt.runId) {
          dispatch({ type: 'SRS_APPLIED', stepId: step.itemId })
          after = useTodayPracticeStore.getState()
        }
        set((state) => state.plan?.runId === planAtAttempt.runId ? ({
          plan: {
            ...state.plan,
            steps: state.plan.steps.map((item) => item.itemId === step.itemId ? { ...item, progress: result.progress } : item),
          },
        }) : state)
      }
      // Keep the server copy resumable even before the final submission, using
      // the captured plan and rich record rather than whichever tab is active.
      await dailyPracticeRepository.syncRunSnapshot(
        planAtAttempt,
        recordsAtAttempt,
        `today-warmup:${planAtAttempt.runId}`,
      ).catch(() => undefined)
    })
    return attemptChain
  },

  async recordRehearsalAttempt(stepId, outcome, assistance) {
    useTodayPracticeStore.getState().dispatch({ type: 'REHEARSAL_ATTEMPT', stepId, outcome, assistance })
    await persistCurrentFacts().catch(() => undefined)
  },

  openMainSession(startStepId, options) {
    const state = useTodayPracticeStore.getState()
    const scopedIds = options?.stepIds ?? state.roundStepIds
    const candidates = scopedIds.filter((id) => !state.attemptedIds.has(id))
    const stepIds = options?.includeAttempted ? [...scopedIds] : (candidates.length > 0 ? candidates : [...scopedIds])
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

  async syncRunSnapshot(records = [], localWarmupRecordId?: string | null) {
    const plan = get().plan
    if (!plan) return
    await dailyPracticeRepository.syncRunSnapshot(plan, records, localWarmupRecordId)
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
    set({ plan: null, plansByMode: {}, loading: false, error: null, submitting: false })
  },
}))

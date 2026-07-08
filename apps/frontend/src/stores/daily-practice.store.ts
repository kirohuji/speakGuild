import { create } from 'zustand'
import {
  dailyPracticeRepository,
  type DailyPracticePlan,
  type DailyPracticePlanMode,
  type ScheduledDailyPracticeItem,
} from '@/lib/offline/daily-practice.repository'
import type { WarmupRecordEntry, WarmupScore } from '@/stores/warmup-session.store'

interface DailyPracticeState {
  plan: DailyPracticePlan | null
  loading: boolean
  error: string | null
  submitting: boolean
  loadToday: (targetPackId?: string | null, targetDate?: string | null, mode?: DailyPracticePlanMode, forceNew?: boolean) => Promise<void>
  completeStep: (step: ScheduledDailyPracticeItem, score: WarmupScore) => Promise<void>
  submitToday: (records: WarmupRecordEntry[], localWarmupRecordId?: string | null) => Promise<void>
  reshuffle: (targetPackId?: string | null, targetDate?: string | null, mode?: DailyPracticePlanMode) => Promise<void>
}

export const useDailyPracticeStore = create<DailyPracticeState>((set, get) => ({
  plan: null,
  loading: false,
  error: null,
  submitting: false,

  async loadToday(targetPackId, targetDate, mode = 'practice', forceNew = false) {
    set({ loading: true, error: null })
    try {
      const plan = await dailyPracticeRepository.buildTodayPlan(targetPackId, targetDate, mode, { forceNew })
      set({ plan, loading: false })
    } catch (error: any) {
      set({ error: error?.message || '加载失败', loading: false, plan: null })
    }
  },

  async completeStep(step, score) {
    const updated = await dailyPracticeRepository.completeItem(step, score, get().plan?.date)
    set((state) => {
      if (!state.plan) return state
      const alreadyCompleted = state.plan.completedItemIds.includes(step.itemId)
      return {
        plan: {
          ...state.plan,
          steps: state.plan.steps.map((item) =>
            item.itemId === step.itemId
              ? { ...item, progress: updated, scheduleStatus: 'done' as const }
              : item,
          ),
          completedItemIds: Array.from(new Set([...state.plan.completedItemIds, step.itemId])),
          topicStats: state.plan.topicStats.map((topic) => {
            if (topic.topicId !== step.topicId) return topic
            const doneTodayCount = alreadyCompleted ? topic.doneTodayCount : topic.doneTodayCount + 1
            const scheduledTodayCount = Math.max(topic.scheduledTodayCount, 1)
            const allDone = doneTodayCount >= scheduledTodayCount
            return {
              ...topic,
              doneTodayCount,
              topicWarmupProgress: topic.totalCount > 0
                ? Math.min(100, Math.round(((doneTodayCount + topic.masteredCount) / topic.totalCount) * 100))
                : 0,
              status: allDone ? 'done' : topic.status,
            }
          }),
        },
      }
    })
  },

  async submitToday(records, localWarmupRecordId) {
    const plan = get().plan
    if (!plan) return
    set({ submitting: true })
    try {
      await dailyPracticeRepository.completeRun(plan, records, localWarmupRecordId)
    } finally {
      set({ submitting: false })
    }
  },

  async reshuffle(targetPackId, targetDate, mode) {
    await get().loadToday(targetPackId, targetDate, mode, true)
  },
}))

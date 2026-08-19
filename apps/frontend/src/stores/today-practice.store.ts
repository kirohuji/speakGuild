import { create } from 'zustand'
import type React from 'react'
import type { DailyPracticeStatus } from '@/lib/offline/daily-practice.repository'
import type { WarmupRecordEntry } from './warmup-session.store'

// ── 类型（从 today-task-page 抽出，供 store 与页面共用）──
export type PracticeItem = {
  id: string
  type: string
  label: string
  topicTitle: string
  scheduleStatus?: DailyPracticeStatus
  /** 准确描述练习内容的标签，用于卡片和抽屉标题 */
  displayLabel: string
  /** Dialog header 大字展示的原始练习数据（单词/句型/句块） */
  headerContent: string
  render: () => React.ReactNode
}

export type PracticeGroup = {
  type: string
  meta: { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
  steps: Array<{ step: PracticeItem; index: number }>
  doneCount: number
  totalCount: number
}

export type RoundKind = 'main' | 'review'

/**
 * 今日练习数据流状态机
 *
 * 职责：集中管理「主轮 + 错题重练轮」的轮次状态、练习进度、导航位置与会话标记。
 * 派生统计（队列/进度/定位）不存副本，由 `deriveTodayPractice` 统一计算。
 */
interface TodayPracticeState {
  kind: RoundKind
  /** 主轮已练 id（含错题，用于轮次完成判定与重访定位） */
  attemptedIds: Set<string>
  /** 重练轮待重练 id 集合（kind=review 时有效） */
  reviewPendingIds: Set<string>
  /** 重练轮已通过 id 集合 */
  reviewDoneIds: Set<string>
  /** 轮次序号：决定 warmupRecordId；「下一组/重新练习/模式切换」+1 */
  roundNonce: number
  /** 错题弹窗「稍后再练」标记 */
  reviewDismissed: boolean
  /** 当前练习索引（基于 activeSteps） */
  currentIdx: number
  sessionHydrated: boolean
  hasSubmittedToday: boolean

  initMain: (attemptedIds: string[]) => void
  completeStep: (stepId: string, passed: boolean) => void
  startReview: (weakIds: string[]) => void
  finishReview: () => void
  dismissReview: () => void
  resetRound: (roundNonce: number) => void
  setCurrentIdx: (idx: number | ((prev: number) => number)) => void
  setSessionHydrated: (v: boolean) => void
  setHasSubmittedToday: (v: boolean) => void
}

export const useTodayPracticeStore = create<TodayPracticeState>((set) => ({
  kind: 'main',
  attemptedIds: new Set(),
  reviewPendingIds: new Set(),
  reviewDoneIds: new Set(),
  roundNonce: 0,
  reviewDismissed: false,
  currentIdx: 0,
  sessionHydrated: false,
  hasSubmittedToday: false,

  initMain: (attemptedIds) => set({
    kind: 'main',
    attemptedIds: new Set(attemptedIds),
    reviewPendingIds: new Set(),
    reviewDoneIds: new Set(),
    reviewDismissed: false,
  }),

  completeStep: (stepId, passed) => set((state) => {
    if (state.kind === 'review') {
      // 重练轮：答对才计入完成（答错/我不会不推进）
      if (!passed) return state
      const reviewDoneIds = new Set(state.reviewDoneIds)
      reviewDoneIds.add(stepId)
      return { reviewDoneIds }
    }
    // 主轮：答对/答错/我不会都算已练（保证轮次可完成），通过与否由 records 派生
    const attemptedIds = new Set(state.attemptedIds)
    attemptedIds.add(stepId)
    return { attemptedIds }
  }),

  startReview: (weakIds) => set({
    kind: 'review',
    reviewPendingIds: new Set(weakIds),
    reviewDoneIds: new Set(),
    reviewDismissed: false,
  }),

  finishReview: () => set({
    kind: 'main',
    reviewPendingIds: new Set(),
    reviewDoneIds: new Set(),
    reviewDismissed: true,
  }),

  dismissReview: () => set({ reviewDismissed: true }),

  resetRound: (roundNonce) => set({
    kind: 'main',
    attemptedIds: new Set(),
    reviewPendingIds: new Set(),
    reviewDoneIds: new Set(),
    roundNonce,
    reviewDismissed: false,
    currentIdx: 0,
  }),

  setCurrentIdx: (currentIdx) => set((state) => ({
    currentIdx: typeof currentIdx === 'function' ? currentIdx(state.currentIdx) : currentIdx,
  })),

  setSessionHydrated: (sessionHydrated) => set({ sessionHydrated }),
  setHasSubmittedToday: (hasSubmittedToday) => set({ hasSubmittedToday }),
}))

// ── 派生统计（集中数据流计算）──
export interface TodayPracticeDerived {
  reviewRoundActive: boolean
  attemptedIds: Set<string>
  reviewPendingIds: Set<string>
  reviewDoneIds: Set<string>
  roundNonce: number
  reviewDismissed: boolean
  currentIdx: number
  sessionHydrated: boolean
  hasSubmittedToday: boolean
  /** 通过集合（绿）由 records 派生；重练轮则为 reviewDoneIds */
  passedStepIds: Set<string>
  /** 错题池（我不会/答错）：records 中 score 为 weak/miss */
  weakStepIds: Set<string>
  /** 重练轮待重练步骤（kind=review 时非空） */
  reviewSteps: PracticeItem[] | null
  /** 主轮「继续练习」队列：排除错题（错题只通过「练习错题」重练） */
  mainQueue: PracticeItem[]
  activeSteps: PracticeItem[]
  activeDoneIds: Set<string>
  /** 续练定位：主轮用「已练」（含错题，下一个未练开始），重练轮用 reviewDoneIds */
  resumeDoneIds: Set<string>
  attemptedCount: number
  hasPracticeSteps: boolean
  allDone: boolean
  activeDoneCount: number
  activeTotal: number
  reviewAllDone: boolean
  passedCount: number
  weakCount: number
  unattemptedCount: number
  needsReviewRound: boolean
}

export function deriveTodayPractice(
  state: TodayPracticeState,
  steps: PracticeItem[],
  records: WarmupRecordEntry[],
): TodayPracticeDerived {
  const reviewRoundActive = state.kind === 'review'
  const attemptedIds = state.attemptedIds
  const reviewPendingIds = state.reviewPendingIds
  const reviewDoneIds = state.reviewDoneIds
  const roundNonce = state.roundNonce
  const reviewDismissed = state.reviewDismissed
  const currentIdx = state.currentIdx
  const sessionHydrated = state.sessionHydrated
  const hasSubmittedToday = state.hasSubmittedToday

  const passedStepIds = new Set<string>()
  const weakStepIds = new Set<string>()
  for (const record of records) {
    if (record.passed) passedStepIds.add(record.stepId)
    if (record.score === 'weak' || record.score === 'miss') weakStepIds.add(record.stepId)
  }

  const reviewSteps = reviewRoundActive && reviewPendingIds.size > 0
    ? steps.filter((step) => reviewPendingIds.has(step.id))
    : null
  const mainQueue = steps.filter((s) => !weakStepIds.has(s.id))
  const activeSteps = reviewRoundActive && reviewSteps ? reviewSteps : mainQueue
  const activeDoneIds = reviewRoundActive ? reviewDoneIds : passedStepIds
  const resumeDoneIds = reviewRoundActive ? reviewDoneIds : attemptedIds

  const attemptedCount = steps.filter((s) => attemptedIds.has(s.id)).length
  const hasPracticeSteps = steps.length > 0
  const allDone = steps.length > 0 && attemptedCount >= steps.length
  const activeDoneCount = activeSteps.filter((s) => activeDoneIds.has(s.id)).length
  const activeTotal = activeSteps.length
  const reviewAllDone = reviewRoundActive && activeTotal > 0 && activeSteps.every((s) => reviewDoneIds.has(s.id))
  const passedCount = steps.filter((s) => passedStepIds.has(s.id)).length
  const weakCount = steps.filter((s) => weakStepIds.has(s.id)).length
  const unattemptedCount = steps.length - passedCount - weakCount
  const needsReviewRound = allDone && weakStepIds.size > 0 && !reviewRoundActive && !reviewDismissed

  return {
    reviewRoundActive,
    attemptedIds,
    reviewPendingIds,
    reviewDoneIds,
    roundNonce,
    reviewDismissed,
    currentIdx,
    sessionHydrated,
    hasSubmittedToday,
    passedStepIds,
    weakStepIds,
    reviewSteps,
    mainQueue,
    activeSteps,
    activeDoneIds,
    resumeDoneIds,
    attemptedCount,
    hasPracticeSteps,
    allDone,
    activeDoneCount,
    activeTotal,
    reviewAllDone,
    passedCount,
    weakCount,
    unattemptedCount,
    needsReviewRound,
  }
}

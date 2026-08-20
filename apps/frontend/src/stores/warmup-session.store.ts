import { create } from 'zustand'
import type { ContinuationResult, InitialRecallResult, RemediationResult } from './today-practice.store'

export type WarmupScore = 'strong' | 'ok' | 'weak' | 'miss'
export type WarmupHintLevel = 'none' | 'hint' | 'answer'

export interface WarmupStepState {
  userAnswer: string
  audioUrl?: string | null
  status: 'idle' | 'passed' | 'failed'
  hintLevel: WarmupHintLevel
  feedback: string
  correction: string
  score: WarmupScore
  retryCount: number
  /** 用户点了「我不会」：输入框禁用、不可提交，重新打开本卡也要保持 */
  skipped?: boolean
  retrievalFailed: boolean
  answerRevealed: boolean
}

export interface WarmupRecordEntry {
  stepId: string
  stepType: string
  zh: string
  answer: string
  userAnswer: string
  audioUrl?: string | null
  passed: boolean
  feedback: string
  groupTitle?: string
  displayLabel?: string
  topicTitle?: string
  recordId?: string
  practiceCount?: number
  score?: WarmupScore
  usedHintLevel?: 0 | 1 | 2 | 3
  retryCount?: number
  correction?: string
  /** Whether the learner explicitly chose “我不会”. */
  skipped?: boolean
  initialRecallResult?: InitialRecallResult
  continuationResult?: ContinuationResult
  remediationResult?: RemediationResult
}

/** One canonical projection for every read-only rendering of a saved answer. */
export function toWarmupReviewData(record: Partial<Pick<WarmupRecordEntry, 'userAnswer' | 'passed' | 'feedback' | 'correction' | 'audioUrl' | 'skipped'>>) {
  return {
    userAnswer: record.userAnswer || '',
    passed: Boolean(record.passed),
    feedback: record.feedback || '',
    correction: record.correction,
    audioUrl: record.audioUrl,
    skipped: record.skipped === true || record.feedback === '我不会/跳过',
  }
}

interface WarmupSessionState {
  /** Per-step card state for restore on revisit */
  stepStates: Record<string, WarmupStepState>
  /** Accumulated records for final AI assessment */
  records: WarmupRecordEntry[]
  /** Append-only UI/assessment history. Today domain truth lives in today-practice.store. */
  attemptHistory: WarmupRecordEntry[]
  /** Mark a step's state after submit */
  recordStep: (stepId: string, data: {
    userAnswer: string
    passed: boolean
    feedback: string
    correction?: string
    hintLevel?: WarmupHintLevel
    score?: WarmupScore
    audioUrl?: string | null
    skipped?: boolean
  }) => void
  /** Record a full entry for final assessment */
  recordEntry: (entry: WarmupRecordEntry) => void
  /** Reset selected step UI states for a focused re-practice round */
  resetSteps: (stepIds: string[]) => void
  /** Clear only step UI states, keep records (used by review round) */
  resetStepStates: (stepIds: string[]) => void
  resetStepUi: (stepId: string) => void
  resetRetryCycleUi: (stepId: string) => void
  clearSessionUi: () => void
  /** Restore a previous in-progress or completed warmup session */
  hydrateSession: (records: WarmupRecordEntry[]) => void
  /** Restore previous answers as display-only step state without adding current records */
  hydrateHistoricalStepStates: (records: WarmupRecordEntry[]) => void
  /** Clear all session data */
  clearSession: () => void
  /** Get all records for assessment */
  getAssessmentRecords: () => any[]
}

export const useWarmupSessionStore = create<WarmupSessionState>((set, get) => ({
  stepStates: {},
  records: [],
  attemptHistory: [],

  recordStep: (stepId, data) => {
    set((prev) => ({
      stepStates: {
        ...prev.stepStates,
        [stepId]: {
          userAnswer: data.userAnswer,
          audioUrl: data.audioUrl ?? prev.stepStates[stepId]?.audioUrl,
          status: data.passed ? 'passed' : 'failed',
          hintLevel: data.hintLevel ?? (data.passed ? 'answer' : 'none'),
          feedback: data.feedback,
          correction: data.correction || '',
          score: data.score ?? (data.passed ? 'strong' : 'miss'),
          skipped: data.passed ? false : (data.skipped ?? prev.stepStates[stepId]?.skipped ?? false),
          retrievalFailed: !data.passed || (prev.stepStates[stepId]?.retrievalFailed ?? false),
          answerRevealed: (data.hintLevel === 'answer') && (!data.passed || Boolean(data.skipped)),
          retryCount: (prev.stepStates[stepId]?.retryCount ?? 0) + (data.passed ? 0 : 1),
        },
      },
    }))
  },

  recordEntry: (entry) => {
    set((prev) => ({
      records: [
        ...prev.records.filter((record) => record.stepId !== entry.stepId),
        {
          ...entry,
          practiceCount: (prev.records.find((record) => record.stepId === entry.stepId)?.practiceCount ?? 0) + 1,
        },
      ],
      attemptHistory: [...prev.attemptHistory, entry],
    }))
  },

  resetSteps: (stepIds) => {
    const resetIds = new Set(stepIds)
    set((prev) => ({
      stepStates: Object.fromEntries(
        Object.entries(prev.stepStates).filter(([stepId]) => !resetIds.has(stepId)),
      ),
      // Business/assessment records are append-only; this API now only resets card UI.
    }))
  },

  resetStepStates: (stepIds) => {
    const resetIds = new Set(stepIds)
    set((prev) => ({
      stepStates: Object.fromEntries(
        Object.entries(prev.stepStates).filter(([stepId]) => !resetIds.has(stepId)),
      ),
    }))
  },

  resetStepUi: (stepId) => set((prev) => {
    const { [stepId]: _removed, ...stepStates } = prev.stepStates
    return { stepStates }
  }),

  resetRetryCycleUi: (stepId) => set((prev) => {
    const { [stepId]: _removed, ...stepStates } = prev.stepStates
    return { stepStates }
  }),

  clearSessionUi: () => set({ stepStates: {} }),

  hydrateSession: (records) => {
    const stepStates: Record<string, WarmupStepState> = {}
    for (const record of records) {
      const usedHintLevel = record.usedHintLevel ?? 0
      stepStates[record.stepId] = {
        userAnswer: record.userAnswer,
        audioUrl: record.audioUrl ?? null,
        status: record.passed ? 'passed' : 'failed',
        hintLevel: usedHintLevel >= 3 ? 'answer' : usedHintLevel > 0 ? 'hint' : 'none',
        feedback: record.feedback,
        correction: record.correction || '',
        score: record.score ?? (record.passed ? 'strong' : 'miss'),
        skipped: record.skipped === true || record.feedback === '我不会/跳过',
        retrievalFailed: !record.passed,
        answerRevealed: usedHintLevel >= 3,
        retryCount: record.retryCount ?? (record.passed ? 0 : 1),
      }
    }
    set({ records, stepStates, attemptHistory: [...records] })
  },

  hydrateHistoricalStepStates: (records) => {
    set((prev) => {
      const stepStates = { ...prev.stepStates }
      for (const record of records) {
        if (prev.records.some((current) => current.stepId === record.stepId)) continue
        if (stepStates[record.stepId]) continue
        // 仅恢复已通过的记录；历史错题不恢复 failed 状态（避免误显示「已加入本轮错题」，本轮错题池只由本轮 records 派生）
        if (!record.passed) continue
        const usedHintLevel = record.usedHintLevel ?? 0
        stepStates[record.stepId] = {
          userAnswer: record.userAnswer,
          audioUrl: record.audioUrl ?? null,
          status: 'passed',
          hintLevel: usedHintLevel >= 3 ? 'answer' : usedHintLevel > 0 ? 'hint' : 'none',
          feedback: record.feedback,
          correction: record.correction || '',
          score: record.score ?? 'strong',
          skipped: false,
          retrievalFailed: false,
          answerRevealed: true,
          retryCount: record.retryCount ?? 0,
        }
      }
      return { stepStates }
    })
  },

  clearSession: () => set({ stepStates: {}, records: [], attemptHistory: [] }),

  getAssessmentRecords: () => get().records,
}))

import { create } from 'zustand'

export type WarmupScore = 'strong' | 'ok' | 'weak' | 'miss'
export type WarmupHintLevel = 'none' | 'hint' | 'answer'

export interface WarmupStepState {
  userAnswer: string
  status: 'idle' | 'passed' | 'failed'
  hintLevel: WarmupHintLevel
  feedback: string
  correction: string
  score: WarmupScore
  retryCount: number
}

export interface WarmupRecordEntry {
  stepId: string
  stepType: string
  zh: string
  answer: string
  userAnswer: string
  passed: boolean
  feedback: string
  groupTitle?: string
  score?: WarmupScore
  usedHintLevel?: 0 | 1 | 2 | 3
  retryCount?: number
  correction?: string
}

interface WarmupSessionState {
  /** Per-step card state for restore on revisit */
  stepStates: Record<string, WarmupStepState>
  /** Accumulated records for final AI assessment */
  records: WarmupRecordEntry[]
  /** Mark a step's state after submit */
  recordStep: (stepId: string, data: {
    userAnswer: string
    passed: boolean
    feedback: string
    correction?: string
    hintLevel?: WarmupHintLevel
    score?: WarmupScore
  }) => void
  /** Record a full entry for final assessment */
  recordEntry: (entry: WarmupRecordEntry) => void
  /** Reset selected step UI states for a focused re-practice round */
  resetSteps: (stepIds: string[]) => void
  /** Clear all session data */
  clearSession: () => void
  /** Get all records for assessment */
  getAssessmentRecords: () => any[]
}

export const useWarmupSessionStore = create<WarmupSessionState>((set, get) => ({
  stepStates: {},
  records: [],

  recordStep: (stepId, data) => {
    set((prev) => ({
      stepStates: {
        ...prev.stepStates,
        [stepId]: {
          userAnswer: data.userAnswer,
          status: data.passed ? 'passed' : 'failed',
          hintLevel: data.hintLevel ?? (data.passed ? 'answer' : 'none'),
          feedback: data.feedback,
          correction: data.correction || '',
          score: data.score ?? (data.passed ? 'strong' : 'miss'),
          retryCount: (prev.stepStates[stepId]?.retryCount ?? 0) + (data.passed ? 0 : 1),
        },
      },
    }))
  },

  recordEntry: (entry) => {
    set((prev) => ({
      records: [...prev.records.filter((record) => record.stepId !== entry.stepId), entry],
    }))
  },

  resetSteps: (stepIds) => {
    const resetIds = new Set(stepIds)
    set((prev) => ({
      stepStates: Object.fromEntries(
        Object.entries(prev.stepStates).filter(([stepId]) => !resetIds.has(stepId)),
      ),
      records: prev.records.filter((record) => !resetIds.has(record.stepId)),
    }))
  },

  clearSession: () => set({ stepStates: {}, records: [] }),

  getAssessmentRecords: () => get().records,
}))

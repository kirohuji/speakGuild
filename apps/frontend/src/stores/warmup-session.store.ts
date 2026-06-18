import { create } from 'zustand'

export interface WarmupStepState {
  userAnswer: string
  status: 'idle' | 'passed' | 'failed'
  hintLevel: 'none' | 'hint' | 'answer'
  feedback: string
  correction: string
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
}

interface WarmupSessionState {
  /** Per-step card state for restore on revisit */
  stepStates: Record<string, WarmupStepState>
  /** Accumulated records for final AI assessment */
  records: WarmupRecordEntry[]
  /** Mark a step's state after submit */
  recordStep: (stepId: string, data: { userAnswer: string; passed: boolean; feedback: string; correction?: string }) => void
  /** Record a full entry for final assessment */
  recordEntry: (entry: WarmupRecordEntry) => void
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
          hintLevel: data.passed ? 'answer' : 'none',
          feedback: data.feedback,
          correction: data.correction || '',
        },
      },
    }))
  },

  recordEntry: (entry) => {
    set((prev) => ({
      records: [...prev.records, entry],
    }))
  },

  clearSession: () => set({ stepStates: {}, records: [] }),

  getAssessmentRecords: () => get().records,
}))

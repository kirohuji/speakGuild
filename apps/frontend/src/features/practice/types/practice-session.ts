export type Phase = 'prepare' | 'guided' | 'practice' | 'analysis'
export const PASSED_FEEDBACK_LINGER_MS = 1500
export const PREP_PAGE_SIZE = 8

export interface TurnFeedback {
  status: 'loading' | 'success' | 'error'
  userText: string
  objective: string
  hint?: string
  targetChunks: string[]
  result?: {
    passed: boolean
    feedback: string
    chunksUsed: string[]
    targetWordsUsed?: string[]
    missingTargets?: string[]
    inkVariables: Record<string, string | number | boolean>
    correction?: string | null
    upgraded?: string | null
    retryRequired?: boolean
    retryPrompt?: string | null
    focusChunk?: string | null
    grammarIssues?: Array<{ type: string; original: string; correction: string }>
  }
  error?: string
}

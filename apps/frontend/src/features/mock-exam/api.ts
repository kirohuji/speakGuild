import { get, post } from '@/lib/request'

export interface MockPaper {
  paperId: string
  name: string
  type: 'standard' | 'intensive'
  questionCount: number
  durationMinutes: number
  description?: string
}

export interface MockScore {
  mockId: string
  paperId: string
  paperName: string
  score: number
  totalScore: number
  passScore: number
  passed: boolean
  durationSeconds: number
  completedAt: string
}

export interface StartMockResult {
  mockId: string
  paperId: string
  questions: { questionId: string; orderIndex: number }[]
  startedAt: string
}

export interface SubmitMockData {
  mockId: string
  answers: { questionId: string; answer: string; selfScore?: number }[]
}

export interface MockDashboard {
  avgScore: number
  totalMocks: number
  passRate: number
  bestScore: number
}

export const getMockPapers = (): Promise<MockPaper[]> => get('/mock/papers')

export const getRecentScores = (limit?: number): Promise<MockScore[]> =>
  get('/mock/scores', { limit: limit || 10 })

export const getMockDashboard = (): Promise<MockDashboard> => get('/mock/dashboard')

export const startMockExam = (paperId: string): Promise<StartMockResult> =>
  post('/mock/start', { paperId })

export const submitMockExam = (data: SubmitMockData): Promise<MockScore> =>
  post('/mock/submit', data)

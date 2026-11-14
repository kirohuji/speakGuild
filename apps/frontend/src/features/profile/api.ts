import { learningStatisticsRepository } from '@/lib/offline/learning-statistics.repository'
import { get, patch, post } from '@/lib/request'

export interface ProfileOverview {
  activeDays: number
  uniqueQuestionsAnswered: number
  favoriteCount: number
  wordCount: number
  currentStreakDays: number
  avgDailyQuestions: number
  historyComplete: boolean
}

export interface ActivityDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  questionCount?: number
  activeSeconds?: number
}

export interface PracticeRecord {
  recordId: string
  sessionId?: string
  topicId: string
  /** 学习包 / scene id，用于回看时拉取完整 topic（contentConfig） */
  unitId?: string
  topicName: string
  questionId: string
  questionText: string
  practiceCount: number
  lastPracticeAt: string
  status?: string
  score?: number | null
  summary?: string | null
  completedAt?: string | null
  analyzedAt?: string | null
  recordType?: 'dialogue' | 'reading' | 'writing'
}

export interface PracticeRecordsResult {
  list: PracticeRecord[]
  total: number
  page: number
  pageSize: number
}

export interface UserProfile {
  id: string
  email: string
  name: string
  username?: string | null
  image?: string | null
  phoneNumber?: string | null
  phoneNumberVerified: boolean
  emailVerified: boolean
  hasCompletedOnboarding: boolean
  learningGoals: string[]
  outputLevel: string
  outputLevelDetail?: {
    source?: string
    assessedAt?: string
    [key: string]: unknown
  } | null
}

export interface PlacementAssessmentResult {
  outputLevel: string
  learningGoals: string[]
  outputLevelDetail: Record<string, unknown>
  analysis: {
    outputLevel: string
    confidence: number
    summary: string
    strengths: string[]
    improvements: string[]
    recommendationReason: string
    nextStep: string
    recommendedUnits: Array<{
      id: string
      packageType?: 'daily' | 'exam' | 'story' | 'course' | 'foundation'
      title: string
      categoryName: string
      location: string
      description?: string | null
      requiredOutputLevel: string
      topicCount: number
      scriptCount: number
    }>
  }
}

export const getProfileOverview = (): Promise<ProfileOverview> => learningStatisticsRepository.read()

export function toActivityHeatmap(days: Array<{ date: string; questionCount: number; activeSeconds: number; active?: boolean }>, year: number): ActivityDay[] {
  const raw = days.filter(day => day.date.startsWith(`${year}-`)).map(day => ({ ...day, count: day.questionCount || (day.active || day.activeSeconds > 0 ? 1 : 0) }))
  const max = Math.max(1, ...raw.map(day => day.count))
  return raw.map(day => ({ ...day, level: Math.min(4, Math.ceil(day.count / max * 4)) as ActivityDay['level'] }))
}

export const getActivityHeatmap = async (year = new Date().getFullYear()): Promise<ActivityDay[]> => {
  const statistics = await learningStatisticsRepository.read(`${year}-01-01`, `${year}-12-31`)
  return toActivityHeatmap(statistics.dailyStats, year)
}

export const getPracticeRecords = (params: {
  page?: number
  pageSize?: number
  topicId?: string
}): Promise<PracticeRecordsResult> => get('/profile/practice-records', params)

export const getUserProfile = (): Promise<UserProfile> => get('/user/profile')

export const updateUserProfile = (payload: {
  name?: string
  username?: string
  hasCompletedOnboarding?: boolean
  learningGoals?: string[]
  outputLevel?: string
  outputLevelDetail?: Record<string, unknown>
}): Promise<UserProfile> =>
  patch('/user/profile', payload)

export const runPlacementAssessment = (payload: {
  learningGoals: string[]
  answers: Array<{ promptId: string; prompt: string; answer: string }>
}): Promise<PlacementAssessmentResult> =>
  post('/practice-ai/placement-assessment', payload, { timeout: 30_000 })

import { get, patch, post } from '@/lib/request'

export interface ProfileOverview {
  userId: string
  nickname?: string
  avatar?: string
  currentBank?: { bankId: string; bankName: string }
  totalPracticeDays: number
  totalQuestionsAnswered: number
  totalFavorites: number
  totalWords: number
  streakDays: number
  avgDailyQuestions: number
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

export const getProfileOverview = (): Promise<ProfileOverview> =>
  get<any>('/profile/overview').then((res) => ({
    userId: res.userId,
    currentBank: res.bank ? { bankId: res.bank.id, bankName: res.bank.name } : undefined,
    totalPracticeDays: res.stats?.totalPracticed ?? 0,
    totalQuestionsAnswered: res.stats?.totalPracticed ?? 0,
    totalFavorites: res.stats?.favoritesCount ?? 0,
    totalWords: res.stats?.wordsCount ?? 0,
    streakDays: res.stats?.streakDays ?? 0,
    avgDailyQuestions: res.stats?.totalPracticed ? Math.round(res.stats.totalPracticed / Math.max(1, res.stats.streakDays || 7)) : 0,
  }))

export const getActivityHeatmap = async (year?: number): Promise<ActivityDay[]> => {
  try {
    const res = await get<{ activities: { date: string; count: number; questionCount?: number; activeSeconds?: number }[] }>(
      '/profile/activity-heatmap',
      { year: year || new Date().getFullYear() },
    )
    const raw = Array.isArray(res) ? res : res?.activities ?? []
    const max = Math.max(1, ...raw.map((a) => a.count))
    return raw.map((a) => ({
      date: typeof a.date === 'string' ? a.date : new Date(a.date).toISOString().slice(0, 10),
      count: a.count,
      level: (Math.min(4, Math.ceil((a.count / max) * 4)) as ActivityDay['level']),
      questionCount: a.questionCount ?? a.count,
      activeSeconds: a.activeSeconds ?? 0,
    }))
  } catch {
    return []
  }
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

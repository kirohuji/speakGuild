import { get, patch } from '@/lib/request'

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
}

export interface PracticeRecord {
  recordId: string
  topicId: string
  topicName: string
  questionId: string
  questionText: string
  practiceCount: number
  lastPracticeAt: string
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
    const res = await get<{ activities: { date: string; count: number }[] }>(
      '/profile/activity-heatmap',
      { year: year || new Date().getFullYear() },
    )
    const raw = Array.isArray(res) ? res : res?.activities ?? []
    const max = Math.max(1, ...raw.map((a) => a.count))
    return raw.map((a) => ({
      date: typeof a.date === 'string' ? a.date : new Date(a.date).toISOString().slice(0, 10),
      count: a.count,
      level: (Math.min(4, Math.ceil((a.count / max) * 4)) as ActivityDay['level']),
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

export const updateUserProfile = (payload: { name?: string; username?: string }): Promise<UserProfile> =>
  patch('/user/profile', payload)

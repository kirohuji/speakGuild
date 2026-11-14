import type { LearningDay } from './statistics-projection'
export interface LearningStatistics {
  dailyStats: LearningDay[]
  activeDays: number
  uniqueQuestionsAnswered: number
  activeSeconds: number
  avgDailyQuestions: number
  currentStreakDays: number
  favoriteCount: number
  wordCount: number
  historyComplete?: boolean
}

import type { LearningDay } from './statistics-projection'
export interface LearningStatistics {
  hourlyStats?: Array<{hour:number;questionCount:number;activeSeconds:number}>
  hourlyComplete?: boolean
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

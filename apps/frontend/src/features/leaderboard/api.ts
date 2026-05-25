import { get } from '@/lib/request'

export interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  userImage: string | null
  score: number
}

export function getPracticeLeaderboard(limit = 50) {
  return get<LeaderboardEntry[]>('/leaderboard/practice', { limit })
}

export function getMockExamLeaderboard(limit = 50) {
  return get<LeaderboardEntry[]>('/leaderboard/mock', { limit })
}

export function getStreakLeaderboard(limit = 50) {
  return get<LeaderboardEntry[]>('/leaderboard/streak', { limit })
}

import { get, post } from '@/lib/request'

export interface CheckInStatus {
  checkedIn: boolean
  todayPoints: number
  currentStreak: number
}

export interface CheckInResult {
  points: number
  earned: number
  streak: number
  message: string
}

export interface PointsBalance {
  points: number
}

export const pointsApi = {
  getBalance: () => get<PointsBalance>('/points/balance'),
  getCheckInStatus: () => get<CheckInStatus>('/points/check-in/status'),
  checkIn: () => post<CheckInResult>('/points/check-in'),
}

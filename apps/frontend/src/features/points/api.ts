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
  getBalance: () => get<any, PointsBalance>('/points/balance'),
  getCheckInStatus: () => get<any, CheckInStatus>('/points/check-in/status'),
  checkIn: () => post<any, CheckInResult>('/points/check-in'),
}

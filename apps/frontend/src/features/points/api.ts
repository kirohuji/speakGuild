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

export interface CheckInCalendar {
  dates: string[]
  totalCheckIns: number
  currentStreak: number
}

export const pointsApi = {
  getBalance: () => get<PointsBalance>('/points/balance'),
  getCheckInStatus: () => get<CheckInStatus>('/points/check-in/status'),
  getCheckInCalendar: () => get<CheckInCalendar>('/points/check-in/calendar'),
  checkIn: () => post<CheckInResult>('/points/check-in'),
}

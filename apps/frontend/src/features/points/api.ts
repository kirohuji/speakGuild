import { get, post } from '@/lib/request'

export interface CheckInStatus {
  checkedIn: boolean
  todayPoints: number
  currentStreak: number
  today?: string
}

export interface CheckInResult {
  date?: string
  alreadyApplied?: boolean
  isMakeup?: boolean
  status?: CheckInStatus
  points: number
  earned: number
  streak: number
  message: string
}

export interface PointsBalance {
  points: number
}

export interface MakeupPolicy {
  cost: number
  pointsBalance: number
  latestDate: string
  today: string
}
export interface MakeupCheckInResult {
  date: string
  points: number
  cost: number
  alreadyApplied: boolean
  status: CheckInStatus
}
export interface CheckInCalendar {
  /** No server calendar cache exists for this range; only known local dates are available. */
  offlineOnly?: boolean
  startDate?: string
  endDate?: string
  today?: string
  makeupDates?: string[]
  makeup?: MakeupPolicy
  dates: string[]
  totalCheckIns: number
  currentStreak: number
  dailyStats: Array<{ date: string; questionCount: number; activeSeconds: number }>
}

export const pointsApi = {
  getBalance: () => get<PointsBalance>('/points/balance'),
  getCheckInStatus: () => get<CheckInStatus>('/points/check-in/status'),
  getCheckInCalendar: (startDate: string, endDate: string) =>
    get<CheckInCalendar>('/points/check-in/calendar', { startDate, endDate }),
  makeupCheckIn: (date: string) => post<MakeupCheckInResult>('/points/check-in/makeup', { date }),
  checkIn: (payload?: { ownerId: string; date: string; occurredAt: string; timeZone: string; clientMutationId: string }) => post<CheckInResult>('/points/check-in', payload),
}

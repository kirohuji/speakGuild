import type { CheckInCalendar } from './api'
export type MakeupAvailability = 'ready' | 'offline' | 'loading' | 'checked' | 'out_of_range' | 'insufficient'
export function makeupAvailability(date: string, calendar: CheckInCalendar | null, online: boolean, today: string): MakeupAvailability {
  if (calendar?.dates.includes(date)) return 'checked'
  if (!online) return 'offline'
  const policy = calendar?.makeup
  if (!policy || policy.today !== today) return 'loading'
  if (date > policy.latestDate) return 'out_of_range'
  if (policy.pointsBalance < policy.cost) return 'insufficient'
  return 'ready'
}

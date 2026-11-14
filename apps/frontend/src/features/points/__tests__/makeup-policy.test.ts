import { describe, expect, it } from 'vitest'
import { makeupAvailability } from '../makeup-policy'
import type { CheckInCalendar } from '../api'
const calendar: CheckInCalendar = { dates: [], totalCheckIns: 0, currentStreak: 0, dailyStats: [],
  makeup: { cost: 200, pointsBalance: 200, today: '2026-11-14', latestDate: '2026-11-13' } }
describe('makeup rules', () => {
  it('allows any past day with 200 points, without learning records or quota fields', () => {
    expect(makeupAvailability('2020-01-01',calendar,true,'2026-11-14')).toBe('ready')
  })
  it('requires the exact cost and online authorization', () => {
    expect(makeupAvailability('2026-11-13',{...calendar,makeup:{...calendar.makeup!,pointsBalance:199}},true,'2026-11-14')).toBe('insufficient')
    expect(makeupAvailability('2026-11-13',calendar,false,'2026-11-14')).toBe('offline')
  })
  it('does not offer another charge for a checked day or allow today/future dates', () => {
    expect(makeupAvailability('2026-11-13',{...calendar,dates:['2026-11-13']},true,'2026-11-14')).toBe('checked')
    expect(makeupAvailability('2026-11-14',calendar,true,'2026-11-14')).toBe('out_of_range')
    expect(makeupAvailability('2026-11-15',calendar,true,'2026-11-14')).toBe('out_of_range')
  })
  it('requires refreshed server policy after midnight', () => {
    expect(makeupAvailability('2026-11-13',calendar,true,'2026-11-15')).toBe('loading')
  })
})

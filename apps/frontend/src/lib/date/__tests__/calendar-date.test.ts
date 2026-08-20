import { describe, expect, it } from 'vitest'
import { isCalendarDate, normalizeCalendarDate, utcDateKey } from '../calendar-date'

describe('calendar-date', () => {
  it('preserves a PostgreSQL DATE calendar day without applying the browser timezone', () => {
    expect(utcDateKey('2026-08-20T00:00:00.000Z')).toBe('2026-08-20')
  })

  it('accepts only calendar-date keys for business date payloads', () => {
    expect(isCalendarDate('2026-08-20')).toBe(true)
    expect(isCalendarDate('2026-08-20T00:00:00.000Z')).toBe(false)
    expect(normalizeCalendarDate('not-a-date', '2026-08-20')).toBe('2026-08-20')
  })
})

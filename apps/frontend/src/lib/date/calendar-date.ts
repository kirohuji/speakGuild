/**
 * Calendar dates represent a user's local business day, never a timestamp.
 * Keep them as YYYY-MM-DD across UI state and API payloads.  UTC formatting is
 * only used for values returned from PostgreSQL DATE columns.
 */
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value)
}

export function localDateKey(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

/** Convert a PostgreSQL DATE value represented as a UTC timestamp to its key. */
export function utcDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function normalizeCalendarDate(value?: string | null, fallback = localDateKey()): string {
  return isCalendarDate(value) ? value : fallback
}

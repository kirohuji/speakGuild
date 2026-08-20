const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_CLIENT_TIME_ZONE = 'Asia/Shanghai';

export function normalizeTimeZone(value?: string | null) {
  const candidate = String(value ?? '').trim();
  if (!candidate || candidate.length > 64) return DEFAULT_CLIENT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_CLIENT_TIME_ZONE;
  }
}

export function dateKeyInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * PostgreSQL DATE has no timezone. Represent it as UTC midnight so Prisma cannot
 * shift the calendar day while converting between JavaScript Date and @db.Date.
 */
export function parseDateKey(value: string) {
  if (!DATE_KEY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (formatDateKey(date) !== value) return null;
  return date;
}

export function formatDateKey(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDateKeyDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function todayDateKey(timeZone: string, now = new Date()) {
  return dateKeyInTimeZone(now, timeZone);
}

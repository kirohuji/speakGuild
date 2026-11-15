import { pointsApi, type CheckInCalendar, type CheckInResult, type CheckInStatus } from '@/features/points/api'
import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import { localDateKey } from '@/lib/date/calendar-date'
import { localDb } from './unified-storage'
import { createId } from './utils'
import type { SyncOutboxItem } from './sync-outbox'

export interface CheckInPayload {
  ownerId: string
  date: string
  occurredAt: string
  timeZone: string
}
interface CheckInRecord {
  id: string
  ownerId: string
  date: string
  pending: boolean
  points?: number
  isMakeup?: boolean
}
const PREFIX = 'check-in:'
let writes: Promise<unknown> = Promise.resolve()
let generation = 0
let paused = false
const listeners = new Set<() => void>()
export function subscribeCheckInsChanged(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function notify() { for (const listener of listeners) listener() }
function requireOwner() {
  const ownerId = getCurrentSessionSnapshot()?.user?.id
  if (paused || !ownerId) throw new Error('签到账号已变化，请重新进入页面')
  return ownerId
}
function guard(ownerId: string, epoch: number) {
  if (epoch !== generation || requireOwner() !== ownerId) throw new Error('签到账号已变化')
}
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.then(work, work)
  writes = next.catch(() => undefined)
  return next
}
function recordKey(ownerId: string, date: string) { return `${PREFIX}${ownerId}:date:${date}` }
function statusKey(ownerId: string) { return `${PREFIX}${ownerId}:status` }
function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}
async function records(ownerId: string) {
  const all = await localDb.list<any>('kv')
  const byDate = new Map<string, CheckInRecord>(all
    .filter(row => row.id.startsWith(`${PREFIX}${ownerId}:date:`) && row.ownerId === ownerId)
    .map(row => [row.date, row]))
  // Existing calendar caches belong to the active account and are cleared on account transitions.
  // Reuse them on the first offline launch after upgrading, without migrating another table.
  for (const cached of all) {
    if (!cached.id.startsWith('user_profile:checkin:')) continue
    for (const date of cached.value?.dates ?? []) {
      if (!byDate.has(date)) byDate.set(date, { id: recordKey(ownerId, date), ownerId, date,
        pending: false, isMakeup: cached.value?.makeupDates?.includes(date) ?? false })
    }
  }
  return [...byDate.values()]
}

function projectStatus(rows: CheckInRecord[], snapshot?: CheckInStatus): CheckInStatus {
  const today = localDateKey()
  const dates = new Map(rows.map(row => [row.date, row]))
  const checkedIn = dates.has(today) || (snapshot?.today === today && snapshot.checkedIn)
  const confirmedDates = new Set(rows.map(row => row.date))
  let anchor = snapshot?.today ? (snapshot.checkedIn ? snapshot.today : previousDate(snapshot.today)) : null
  for (let i = 0; anchor && i < (snapshot?.currentStreak ?? 0); i++) {
    confirmedDates.add(anchor)
    anchor = previousDate(anchor)
  }
  let date = checkedIn ? today : previousDate(today)
  let currentStreak = 0
  while (confirmedDates.has(date)) { currentStreak++; date = previousDate(date) }
  return { today, checkedIn, currentStreak, todayPoints: dates.get(today)?.points ?? (snapshot?.today === today ? snapshot.todayPoints : 0) ?? 0 }
}

export const checkInRepository = {
  pause() { paused = true; generation++ },
  resume() { paused = false },
  async waitForWrites() { await writes },

  async readStatus(): Promise<CheckInStatus> {
    const ownerId = requireOwner(), epoch = generation
    const [rows, cached] = await Promise.all([records(ownerId), localDb.get<{ value: CheckInStatus }>('kv', statusKey(ownerId))])
    guard(ownerId, epoch)
    return projectStatus(rows, cached?.value)
  },

  async refreshStatus(): Promise<CheckInStatus> {
    const ownerId = requireOwner(), epoch = generation
    const status = await pointsApi.getCheckInStatus()
    guard(ownerId, epoch)
    await this.rememberStatus(status)
    return this.readStatus()
  },

  async rememberStatus(status: CheckInStatus): Promise<void> {
    const ownerId = requireOwner(), epoch = generation
    await serialize(async () => {
      guard(ownerId, epoch)
      const existing = status.today ? await localDb.get<CheckInRecord>('kv', recordKey(ownerId, status.today)) : null
      guard(ownerId, epoch)
      await localDb.commitLocalWrites([
        { table: 'kv', value: { id: statusKey(ownerId), value: status } },
        ...(status.checkedIn && status.today && !existing?.pending ? [{ table: 'kv' as const, value: {
          ...existing, id: recordKey(ownerId, status.today), ownerId, date: status.today, pending: false, points: status.todayPoints,
        } }] : []),
      ])
      guard(ownerId, epoch)
      notify()
    })
  },

  async checkIn(): Promise<CheckInStatus> {
    const ownerId = requireOwner(), epoch = generation
    // Capture the business date once, before asynchronous storage work.
    const now = new Date()
    const date = localDateKey(now)
    const occurredAt = now.toISOString()
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    await serialize(async () => {
      guard(ownerId, epoch)
      const status = await this.readStatus()
      const existing = await localDb.get<CheckInRecord>('kv', recordKey(ownerId, date))
      guard(ownerId, epoch)
      if (existing || (status.today === date && status.checkedIn)) return
      const payload: CheckInPayload = { ownerId, date, occurredAt, timeZone }
      const item: SyncOutboxItem<CheckInPayload> = {
        id: recordKey(ownerId, date), entityType: 'check_in', entityId: date, operation: 'create', payload,
        clientMutationId: createId(), createdAt: occurredAt, updatedAt: occurredAt,
        revision: 1, nextRetryAt: occurredAt, retryCount: 0, status: 'pending',
      }
      await localDb.commitLocalWrites([
        { table: 'kv', value: { id: recordKey(ownerId, date), ownerId, date, pending: true } },
        { table: 'outbox', value: item },
      ])
      guard(ownerId, epoch)
      notify()
    })
    return this.readStatus()
  },

  async acknowledge(payload: CheckInPayload, result: CheckInResult): Promise<void> {
    const epoch = generation
    await serialize(async () => {
      guard(payload.ownerId, epoch)
      await localDb.commitLocalWrites([
        { table: 'kv', value: { id: recordKey(payload.ownerId, payload.date), ownerId: payload.ownerId,
          date: payload.date, pending: false, points: result.earned, isMakeup: result.isMakeup } },
        ...(result.status ? [{ table: 'kv' as const, value: { id: statusKey(payload.ownerId), value: result.status } }] : []),
      ])
      guard(payload.ownerId, epoch)
      notify()
    })
  },

  async rememberCalendar(data: CheckInCalendar, authoritative = false): Promise<void> {
    const ownerId = requireOwner(), epoch = generation
    await serialize(async () => {
      guard(ownerId, epoch)
      const known = new Map((await records(ownerId)).map(row => [row.date, row]))
      guard(ownerId, epoch)
      const changes: import('./unified-storage').LocalWrite[] = data.dates.filter(date => !known.get(date)?.pending).map(date => ({
        table: 'kv' as const, value: { ...known.get(date), id: recordKey(ownerId, date), ownerId, date,
          pending: false, isMakeup: data.makeupDates?.includes(date) ?? false },
      }))
      if (authoritative && data.today && data.startDate && data.endDate && data.startDate <= data.today && data.endDate >= data.today) {
        changes.push({ table: 'kv', value: { id: statusKey(ownerId), value: {
          today: data.today, checkedIn: data.dates.includes(data.today), currentStreak: data.currentStreak,
          todayPoints: known.get(data.today)?.points ?? 0,
        } } })
      }
      await localDb.commitLocalWrites(changes)
      guard(ownerId, epoch)
      if (authoritative) notify()
    })
  },

  async overlayCalendar(startDate: string, endDate: string, cached: CheckInCalendar | null): Promise<CheckInCalendar> {
    const ownerId = requireOwner(), epoch = generation
    const [rows, snapshot] = await Promise.all([records(ownerId), localDb.get<{ value: CheckInStatus }>('kv', statusKey(ownerId))])
    guard(ownerId, epoch)
    const baseDates = new Set(cached?.dates ?? [])
    const localDates = rows.filter(row => row.date >= startDate && row.date <= endDate)
    const fallbackStatus = cached?.today && cached.startDate && cached.endDate
      && cached.startDate <= cached.today && cached.endDate >= cached.today
      ? { today: cached.today, checkedIn: cached.dates.includes(cached.today), currentStreak: cached.currentStreak, todayPoints: 0 } : undefined
    const status = projectStatus(rows, snapshot?.value ?? fallbackStatus)
    return {
      ...cached, offlineOnly: !cached || Boolean(cached.offlineOnly), startDate, endDate, today: status.today, currentStreak: status.currentStreak,
      dates: [...new Set([...baseDates, ...localDates.map(row => row.date)])].sort(),
      makeupDates: [...new Set([...(cached?.makeupDates ?? []), ...localDates.filter(row => row.isMakeup).map(row => row.date)])],
      totalCheckIns: cached ? cached.totalCheckIns + localDates.filter(row => row.pending && !baseDates.has(row.date)).length : rows.length,
      dailyStats: cached?.dailyStats ?? [],
    }
  },
}

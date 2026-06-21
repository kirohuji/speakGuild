import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Badge } from '@capawesome/capacitor-badge'
import { localDb } from '@/lib/offline/unified-storage'
import { usePreferencesStore } from '@/stores/preferences.store'

const REMINDER_WINDOW_DAYS = 7
const CANCEL_WINDOW_DAYS = 14
const REMINDER_ID_BASE = 730_000

let actionListenerRegistered = false

export interface LearningReminderTestResult {
  scheduled: boolean
  platform: string
  permissionBefore?: string
  permissionAfter?: string
  scheduledAt?: string
  pendingIds?: number[]
  error?: string
}

function isNativeRuntime() {
  return Capacitor.isNativePlatform()
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayIndex(date: Date) {
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000)
}

function reminderId(date: Date) {
  return REMINDER_ID_BASE + dayIndex(date)
}

function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return null
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

function scheduleDate(offsetDays: number, time: { hour: number; minute: number }) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  date.setHours(time.hour, time.minute, 0, 0)
  return date
}

async function hasStudyActivity(date: Date): Promise<boolean> {
  const key = dateKey(date)
  const record = await localDb.get<{ count?: number }>('daily_activity', `daily:${key}`)
  return Number(record?.count ?? 0) > 0
}

async function ensureBadgePermission(): Promise<boolean> {
  const supported = await Badge.isSupported().catch(() => ({ isSupported: false }))
  if (!supported.isSupported) return false
  const current = await Badge.checkPermissions().catch(() => ({ display: 'granted' as const }))
  if (current.display === 'granted') return true
  const requested = await Badge.requestPermissions().catch(() => current)
  return requested.display === 'granted'
}

async function ensurePermission(): Promise<boolean> {
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

async function cancelRollingReminders() {
  if (!isNativeRuntime()) return
  const now = new Date()
  const notifications = Array.from({ length: CANCEL_WINDOW_DAYS }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() + index)
    return { id: reminderId(date) }
  })
  await LocalNotifications.cancel({ notifications }).catch(() => undefined)
}

export async function rescheduleLearningReminder(): Promise<boolean> {
  if (!isNativeRuntime()) return false

  const { learningReminderEnabled, learningReminderTime } = usePreferencesStore.getState()
  await cancelRollingReminders()
  if (!learningReminderEnabled) return true

  const time = parseReminderTime(learningReminderTime)
  if (!time) return false
  if (!await ensurePermission()) return false

  const now = new Date()
  const notifications = []
  for (let offset = 0; offset < REMINDER_WINDOW_DAYS; offset++) {
    const at = scheduleDate(offset, time)
    if (at <= now) continue
    if (await hasStudyActivity(at)) continue
    notifications.push({
      id: reminderId(at),
      title: '今天还没练习英语',
      body: '来完成今日任务，保持表达手感。',
      sound: 'default',
      interruptionLevel: 'active',
      schedule: { at },
      extra: { route: '/today' },
    })
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications })
  }
  return true
}

export async function cancelTodayLearningReminder() {
  if (!isNativeRuntime()) return
  await LocalNotifications.cancel({ notifications: [{ id: reminderId(new Date()) }] }).catch(() => undefined)
}

export async function setLearningBadgeCount(count: number): Promise<boolean> {
  if (!isNativeRuntime()) return false
  if (!await ensureBadgePermission()) return false
  await Badge.set({ count: Math.max(0, Math.floor(count)) })
  return true
}

export async function refreshLearningBadgeFromTodayRun(): Promise<boolean> {
  if (!isNativeRuntime()) return false
  const today = dateKey(new Date())
  const run = await localDb.get<{ scheduledItemIds?: string[]; completedItemIds?: string[] }>('daily_practice_runs', `daily:${today}`)
  if (!run) return false
  const scheduled = new Set(run.scheduledItemIds ?? [])
  const completed = new Set(run.completedItemIds ?? [])
  return setLearningBadgeCount(Math.max(0, scheduled.size - completed.size))
}

export async function scheduleLearningReminderTestNotification(delaySeconds = 5): Promise<LearningReminderTestResult> {
  const platform = Capacitor.getPlatform()
  if (!isNativeRuntime()) return { scheduled: false, platform }

  if (!LocalNotifications?.checkPermissions || !LocalNotifications?.schedule) {
    return { scheduled: false, platform, error: 'LocalNotifications plugin is not available' }
  }
  const before = await LocalNotifications.checkPermissions()
  const after = before.display === 'granted' ? before : await LocalNotifications.requestPermissions()
  if (after.display !== 'granted') {
    return {
      scheduled: false,
      platform,
      permissionBefore: before.display,
      permissionAfter: after.display,
    }
  }

  await registerLearningReminderActions()
  const at = new Date(Date.now() + Math.max(1, delaySeconds) * 1000)
  await LocalNotifications.schedule({
    notifications: [{
      id: REMINDER_ID_BASE - 1,
      title: '学习提醒测试',
      body: '本地通知可以正常使用。',
      sound: 'default',
      interruptionLevel: 'active',
      schedule: { at },
      extra: { route: '/today' },
    }],
  })
  const pending = await LocalNotifications.getPending().catch(() => null)
  const pendingIds = pending?.notifications?.map((item) => item.id) ?? []
  return {
    scheduled: true,
    platform,
    permissionBefore: before.display,
    permissionAfter: after.display,
    scheduledAt: at.toISOString(),
    pendingIds,
  }
}

export async function registerLearningReminderActions() {
  if (!isNativeRuntime() || actionListenerRegistered) return
  actionListenerRegistered = true
  await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const route = event.notification.extra?.route
    if (typeof route === 'string' && route.startsWith('/')) {
      window.location.hash = route
    }
  })
}

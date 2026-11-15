import { create } from 'zustand'
import { localDateKey } from '@/lib/date/calendar-date'
import { get } from '@/lib/request'
import { type CheckInStatus } from '@/features/points/api'
import { getSpecialNotifications, type SpecialNotification } from '@/features/notification/api'
import { checkInRepository, subscribeCheckInsChanged } from '@/lib/offline/check-in.repository'
import { getCurrentSessionSnapshot } from '@/providers/auth-session'
import i18n from '@/lib/i18n'

let checkInEpoch = 0
let checkInStatusRequest = 0

// ---- 每日句子 ----

export interface DailySentence {
  quote: string
  translation: string
  author: string
}

const FALLBACK_SENTENCE: DailySentence = {
  quote: 'Say one real sentence today.',
  translation: '今天先说出一句真实会用的话。',
  author: 'EngJourney Daily',
}

/** 获取今天的日期字符串 YYYY-MM-DD，用于判断缓存是否过期 */
function todayKey(): string {
  return localDateKey()
}

// ---- Store ----

interface HomeStore {
  // 每日句子
  dailySentence: DailySentence
  sentenceLoading: boolean
  /** 缓存对应的日期；与 todayKey() 不同时重新拉取 */
  sentenceDate: string | null

  // 签到
  checkInStatus: CheckInStatus | null
  checkInLoading: boolean

  // 特殊通知（首页横幅/弹窗）
  specialNotifications: SpecialNotification[]
  specialNotificationsLoading: boolean
  specialNotificationPending: boolean

  // Actions
  fetchDailySentence: () => Promise<void>
  fetchCheckInStatus: () => Promise<void>
  fetchSpecialNotifications: () => Promise<void>
  resetCheckIn: () => void
  checkIn: () => Promise<string> // 返回成功消息，失败 throw
}

export const useHomeStore = create<HomeStore>()((set, getState) => ({
  dailySentence: FALLBACK_SENTENCE,
  sentenceLoading: false,
  sentenceDate: null,

  checkInStatus: null,
  checkInLoading: false,

  specialNotifications: [],
  specialNotificationsLoading: false,
  specialNotificationPending: true,

  async fetchDailySentence() {
    const { sentenceDate, sentenceLoading } = getState()
    // 同一天已加载过，跳过
    if (sentenceDate === todayKey() || sentenceLoading) return

    set({ sentenceLoading: true })
    try {
      const data = await get<DailySentence>('/daily-sentences/today')
      if (data?.quote) {
        set({ dailySentence: data, sentenceDate: todayKey() })
      } else {
        // API 返回空也用兜底，但标记日期避免重复请求
        set({ sentenceDate: todayKey() })
      }
    } catch {
      set({ sentenceDate: todayKey() })
    } finally {
      set({ sentenceLoading: false })
    }
  },

  resetCheckIn() { checkInEpoch++; set({ checkInStatus: null, checkInLoading: false }) },

  async fetchCheckInStatus() {
    const owner = getCurrentSessionSnapshot()?.user?.id
    if (!owner) return
    const epoch = checkInEpoch
    const request = ++checkInStatusRequest
    const isCurrent = () => request === checkInStatusRequest && epoch === checkInEpoch && getCurrentSessionSnapshot()?.user?.id === owner
    try {
      const cached = await checkInRepository.readStatus()
      if (isCurrent()) set({ checkInStatus: cached })
      if (!navigator.onLine) return
      const fresh = await checkInRepository.refreshStatus()
      if (isCurrent()) set({ checkInStatus: fresh })
    } catch { /* Local status remains usable when offline or during an account transition. */ }
  },

  async fetchSpecialNotifications() {
    set({ specialNotificationsLoading: true, specialNotificationPending: true })
    try {
      const data = await getSpecialNotifications()
      set({ specialNotifications: data })
    } catch {
      // 静默失败
    } finally {
      set({ specialNotificationsLoading: false })
    }
  },

  async checkIn() {
    if (getState().checkInLoading) return i18n.t('home.checkInSaved')
    const owner = getCurrentSessionSnapshot()?.user?.id
    const epoch = checkInEpoch
    checkInStatusRequest++
    set({ checkInLoading: true })
    try {
      const status = await checkInRepository.checkIn()
      if (epoch !== checkInEpoch || getCurrentSessionSnapshot()?.user?.id !== owner) throw new Error(i18n.t('home.checkInFailed'))
      set({ checkInStatus: status })
      if (navigator.onLine && owner) {
        void import('@/lib/offline/offline-sync.service').then(({ offlineSyncService }) => offlineSyncService.syncPending(owner)).catch(() => undefined)
      }
      return i18n.t('home.checkInSaved')
    } finally { if (epoch === checkInEpoch) set({ checkInLoading: false }) }
  },
}))

subscribeCheckInsChanged(() => {
  const owner = getCurrentSessionSnapshot()?.user?.id
  if (!owner) return
  const epoch = checkInEpoch
  void checkInRepository.readStatus().then(status => {
    if (epoch === checkInEpoch && getCurrentSessionSnapshot()?.user?.id === owner) useHomeStore.setState({ checkInStatus: status })
  }).catch(() => undefined)
})

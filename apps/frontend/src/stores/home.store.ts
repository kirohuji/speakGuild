import { create } from 'zustand'
import { localDateKey } from '@/lib/date/calendar-date'
import { get } from '@/lib/request'
import { pointsApi, type CheckInStatus } from '@/features/points/api'
import { getSpecialNotifications, type SpecialNotification } from '@/features/notification/api'
import { useUserStore } from '@/stores/user.store'

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

  // Actions
  fetchDailySentence: () => Promise<void>
  fetchCheckInStatus: () => Promise<void>
  fetchSpecialNotifications: () => Promise<void>
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

  async fetchCheckInStatus() {
    try {
      const status = await pointsApi.getCheckInStatus()
      set({ checkInStatus: status })
    } catch {
      // 静默失败
    }
  },

  async fetchSpecialNotifications() {
    set({ specialNotificationsLoading: true })
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
    set({ checkInLoading: true })
    try {
      const result = await pointsApi.checkIn()
      // 签到后刷新状态
      const status = await pointsApi.getCheckInStatus()
      set({ checkInStatus: status, checkInLoading: false })
      // 同步统一用户 store 的积分余额（points 为签到后的总余额）
      if (typeof result.points === 'number') {
        useUserStore.getState().setPointsBalance(result.points)
      }
      return result.message
    } catch (e) {
      set({ checkInLoading: false })
      throw e
    }
  },
}))

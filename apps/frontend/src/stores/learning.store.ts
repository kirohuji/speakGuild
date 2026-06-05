import { create } from 'zustand'
import {
  learningApi,
  type LearningUnitSummary,
  type MyUnit,
  type TagInfo,
} from '@/features/learning/api/learning-api'
import { pointsApi, type CheckInCalendar } from '@/features/points/api'

interface LearningStore {
  // 我的学习
  myUnits: MyUnit[]
  myLoading: boolean

  // 学习商店（分页扁平列表）
  shopUnits: LearningUnitSummary[]
  shopTotal: number
  shopPage: number
  shopHasMore: boolean
  shopLoading: boolean

  // 签到日历
  checkInData: CheckInCalendar | null
  checkInLoading: boolean

  // 分类标签
  tags: TagInfo[]

  // Actions
  fetchMyLearning: () => Promise<void>
  refreshMyUnits: () => Promise<void>
  fetchTags: () => Promise<void>
  fetchShop: (params?: { tag?: string; search?: string; page?: number }) => Promise<void>
  refreshShop: (params?: { tag?: string; search?: string; page?: number }) => Promise<void>
  loadMoreShop: (params?: { tag?: string; search?: string }) => Promise<void>
  fetchCheckInCalendar: (startDate: string, endDate: string) => Promise<void>
  enrollUnit: (unitId: string) => Promise<void>
  quitUnit: (unitId: string) => Promise<void>
}

export const useLearningStore = create<LearningStore>()((set, getState) => ({
  myUnits: [],
  myLoading: true,

  shopUnits: [],
  shopTotal: 0,
  shopPage: 1,
  shopHasMore: false,
  shopLoading: false,

  checkInData: null,
  checkInLoading: false,

  tags: [],

  /** 首次加载：我的学习 + 商店 */
  async fetchMyLearning() {
    set({ myLoading: true })
    try {
      const units = await learningApi.getMyUnits().catch(() => [] as MyUnit[])
      set({ myUnits: units, myLoading: false })
    } catch {
      set({ myLoading: false })
    }
  },

  async refreshMyUnits() {
    try {
      const units = await learningApi.getMyUnits()
      set({ myUnits: units })
    } catch {
      // ignore
    }
  },

  async fetchShop(params) {
    const { shopUnits } = getState()
    if (shopUnits.length > 0 && !params) return
    set({ shopLoading: true })
    try {
      const pageSize = 20
      const result = await learningApi.getUnits({ ...params, page: params?.page ?? 1, pageSize })
      set({
        shopUnits: result.list,
        shopTotal: result.total,
        shopPage: result.page,
        shopHasMore: result.list.length === pageSize,
        shopLoading: false,
      })
    } catch {
      set({ shopLoading: false })
    }
  },

  async refreshShop(params) {
    set({ shopLoading: true })
    try {
      const pageSize = 20
      const result = await learningApi.getUnits({ ...params, page: params?.page ?? 1, pageSize })
      set({
        shopUnits: result.list,
        shopTotal: result.total,
        shopPage: result.page,
        shopHasMore: result.list.length === pageSize,
        shopLoading: false,
      })
    } catch {
      set({ shopLoading: false })
    }
  },

  async loadMoreShop(params) {
    const { shopLoading, shopHasMore, shopPage } = getState()
    if (shopLoading || !shopHasMore) return
    set({ shopLoading: true })
    try {
      const pageSize = 20
      const nextPage = shopPage + 1
      const result = await learningApi.getUnits({ ...params, page: nextPage, pageSize })
      set((s) => ({
        shopUnits: [...s.shopUnits, ...result.list],
        shopTotal: result.total,
        shopPage: result.page,
        shopHasMore: result.list.length === pageSize,
        shopLoading: false,
      }))
    } catch {
      set({ shopLoading: false })
    }
  },

  async fetchTags() {
    const { tags } = getState()
    if (tags.length > 0) return
    try {
      const data = await learningApi.getTags()
      set({ tags: data })
    } catch {
      // ignore
    }
  },

  async fetchCheckInCalendar(startDate, endDate) {
    set({ checkInLoading: true })
    try {
      const data = await pointsApi.getCheckInCalendar(startDate, endDate)
      set({ checkInData: data, checkInLoading: false })
    } catch {
      set((s) => ({
        checkInData: s.checkInData ?? { dates: [], totalCheckIns: 0, currentStreak: 0 },
        checkInLoading: false,
      }))
    }
  },

  async enrollUnit(unitId) {
    try {
      await learningApi.startUnit(unitId)
      await getState().refreshMyUnits()
    } catch {
      // ignore
    }
  },

  async quitUnit(unitId) {
    try {
      await learningApi.quitUnit(unitId)
      await getState().refreshMyUnits()
    } catch {
      // ignore
    }
  },
}))

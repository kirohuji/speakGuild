import { create } from 'zustand'
import { Network } from '@capacitor/network'
import {
  learningApi,
  type LearningUnitSummary,
  type MyUnit,
  type PackUpdateInfo,
  type TagInfo,
  type UnitDetail,
} from '@/features/learning/api/learning-api'
import { pointsApi, type CheckInCalendar } from '@/features/points/api'
import { learningPackService, learningRepository, type InstalledLearningPack } from '@/lib/offline'
import { isNative } from '@/lib/native/platform'
import { usePreferencesStore } from '@/stores/preferences.store'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'

/** 下载任务状态 */
export interface DownloadTask {
  packId: string
  title: string
  progress: number        // 0-100
  status: 'queued' | 'downloading' | 'extracting' | 'done' | 'error'
  error?: string
}

/** 最大并发下载数 */
const MAX_CONCURRENT_DOWNLOADS = 2

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

  // 单元详情
  unitDetail: UnitDetail | null
  unitDetailLoading: boolean
  downloadedPacks: InstalledLearningPack[]
  packInstallingIds: string[]
  availablePackUpdates: PackUpdateInfo[]

  // 下载队列
  downloadTasks: DownloadTask[]

  // Actions
  fetchMyLearning: () => Promise<void>
  refreshMyUnits: () => Promise<void>
  fetchTags: () => Promise<void>
  fetchUnitDetail: (unitId: string) => Promise<void>
  fetchShop: (params?: { tag?: string; search?: string; page?: number }) => Promise<void>
  refreshShop: (params?: { tag?: string; search?: string; page?: number }) => Promise<void>
  loadMoreShop: (params?: { tag?: string; search?: string }) => Promise<void>
  fetchCheckInCalendar: (startDate: string, endDate: string) => Promise<void>
  enrollUnit: (unitId: string, title?: string) => Promise<void>
  quitUnit: (unitId: string) => Promise<void>
  fetchDownloadedPacks: () => Promise<void>
  checkPackUpdates: (silent?: boolean) => Promise<void>
  downloadUnitPack: (unitId: string) => Promise<void>
  uninstallUnitPack: (unitId: string) => Promise<void>
  /** 清除所有离线数据 */
  clearAllOfflineData: () => Promise<void>
}

/**
 * 检查网络环境，决定是否允许下载资产文件。
 *
 * 逻辑：
 * - Web 端：始终放行（无 WiFi/蜂窝概念）
 * - 原生端 + wifiOnlyMedia=ON：仅 WiFi 可下载，蜂窝弹 Toast 阻止
 * - 原生端 + wifiOnlyMedia=OFF：WiFi 放行，蜂窝弹确认对话框
 *
 * @returns true = 允许继续下载，false = 用户取消或阻止
 */
async function checkNetworkBeforeDownload(): Promise<boolean> {
  if (!isNative()) return true

  const wifiOnlyMedia = usePreferencesStore.getState().wifiOnlyMedia

  try {
    const status = await Network.getStatus()
    if (status.connectionType !== 'cellular') return true

    // 当前是蜂窝网络
    if (wifiOnlyMedia) {
      // 仅 WiFi 模式 → 阻止，弹提示
      toast.error(i18n.t('profile.wifiOnlyBlocked', { defaultValue: '当前为移动网络，请在 WiFi 环境下下载' }), {
        duration: 4000,
      })
      return false
    }

    // 允许移动网络 → 弹确认对话框
    return await new Promise<boolean>((resolve) => {
      toast(i18n.t('profile.cellularDownloadConfirm', { defaultValue: '当前使用蜂窝网络，下载可能消耗流量' }), {
        duration: 10000,
        position: 'top-center',
        action: {
          label: i18n.t('common.confirm', { defaultValue: '继续下载' }),
          onClick: () => resolve(true),
        },
        cancel: {
          label: i18n.t('common.cancel', { defaultValue: '取消' }),
          onClick: () => resolve(false),
        },
      })
    })
  } catch {
    // 无法获取网络状态时放行
    return true
  }
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

  unitDetail: null,
  unitDetailLoading: false,
  downloadedPacks: [],
  packInstallingIds: [],
  availablePackUpdates: [],
  downloadTasks: [],

  /** 首次加载：我的学习 + 商店 */
  async fetchMyLearning() {
    set({ myLoading: true })
    try {
      const units = await learningRepository.getMyUnits().catch(() => [] as MyUnit[])
      set({ myUnits: units, myLoading: false })
    } catch {
      set({ myLoading: false })
    }
  },

  async refreshMyUnits() {
    try {
      const units = await learningRepository.refreshMyUnits()
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

  async fetchUnitDetail(unitId) {
    set({ unitDetailLoading: true })
    try {
      const data = await learningRepository.getUnitDetail(unitId)
      set({ unitDetail: data, unitDetailLoading: false })
    } catch {
      set({ unitDetail: null, unitDetailLoading: false })
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

  async enrollUnit(unitId, title) {
    const state = getState()
    const sourceUnit = state.unitDetail?.id === unitId
      ? state.unitDetail
      : state.shopUnits.find((unit) => unit.id === unitId) ?? null
    const packTitle = title ?? sourceUnit?.title ?? unitId

    try {
      await learningRepository.enrollUnit(unitId, sourceUnit)
    } catch {
      // enroll 可能已经做过了，忽略错误继续
    }

    // 加入下载队列
    const task: DownloadTask = {
      packId: unitId,
      title: packTitle,
      progress: 0,
      status: 'queued',
    }
    set((s) => ({
      downloadTasks: [...s.downloadTasks.filter((t) => t.packId !== unitId), task],
    }))
    console.log(`[learning-store] 📥 加入下载队列: ${packTitle} (${unitId}), 队列长度: ${getState().downloadTasks.length}`)

    // 触发队列处理（异步，不 await）
    processDownloadQueue()
  },

  /** 处理下载队列：最多 2 个并发 */
  async _processDownloadQueue() {
    const state = getState()
    const running = state.downloadTasks.filter((t) => t.status === 'downloading' || t.status === 'extracting').length
    if (running >= MAX_CONCURRENT_DOWNLOADS) {
      console.log(`[learning-store] ⏸️ 下载队列已满 (${running}/${MAX_CONCURRENT_DOWNLOADS})，等待中...`)
      return
    }

    const next = state.downloadTasks.find((t) => t.status === 'queued')
    if (!next) return

    // 标记为下载中
    set((s) => ({
      downloadTasks: s.downloadTasks.map((t) =>
        t.packId === next.packId ? { ...t, status: 'downloading' as const, progress: 0 } : t,
      ),
    }))

    try {
      // 网络检查
      if (!await checkNetworkBeforeDownload()) {
        set((s) => ({
          downloadTasks: s.downloadTasks.filter((t) => t.packId !== next.packId),
        }))
        processDownloadQueue() // 处理下一个
        return
      }

      console.log(`[learning-store] ⏳ 开始下载: ${next.title} (${next.packId})`)

      // 模拟进度：zip 下载占 60%，解压索引占 40%
      const updateProgress = (progress: number, status: DownloadTask['status']) => {
        set((s) => ({
          downloadTasks: s.downloadTasks.map((t) =>
            t.packId === next.packId ? { ...t, progress: Math.min(99, progress), status } : t,
          ),
        }))
      }
      updateProgress(5, 'downloading')

      await learningPackService.installUnit(next.packId)

      updateProgress(100, 'done')
      console.log(`[learning-store] ✅ 下载完成: ${next.title}`)

      const downloadedPacks = await learningPackService.listInstalled()
      set((current) => ({
        downloadedPacks,
        availablePackUpdates: current.availablePackUpdates.filter((update) => update.packId !== next.packId),
      }))
      await getState().refreshMyUnits()

      // 3 秒后从队列移除已完成的
      setTimeout(() => {
        set((s) => ({
          downloadTasks: s.downloadTasks.filter((t) => t.packId !== next.packId || t.status !== 'done'),
        }))
      }, 3000)

    } catch (error: any) {
      console.error(`[learning-store] ❌ 下载失败: ${next.title}`, error)
      set((s) => ({
        downloadTasks: s.downloadTasks.map((t) =>
          t.packId === next.packId
            ? { ...t, status: 'error' as const, error: error?.message ?? '下载失败' }
            : t,
        ),
      }))
    } finally {
      // 继续处理队列中的下一个
      processDownloadQueue()
    }
  },

  async quitUnit(unitId) {
    try {
      await learningRepository.quitUnit(unitId)
      await learningPackService.uninstall(unitId)
      const downloadedPacks = await learningPackService.listInstalled()
      set((current) => ({
        downloadedPacks,
        availablePackUpdates: current.availablePackUpdates.filter((update) => update.packId !== unitId),
      }))
      await getState().refreshMyUnits()
    } catch {
      // ignore
    }
  },

  async fetchDownloadedPacks() {
    const downloadedPacks = await learningPackService.listInstalled()
    set({ downloadedPacks })
  },

  async checkPackUpdates(silent = true) {
    console.log('[learning-store] 🔍 检查学习包更新...', silent ? '(静默)' : '(用户触发)')
    const downloadedPacks = await learningPackService.listInstalled()
    const installed = downloadedPacks
      .filter((pack) => pack.status === 'installed')
      .map((pack) => ({ packId: pack.packId, version: pack.version }))
    console.log(`[learning-store]   已安装: ${installed.length} 个包`)
    if (installed.length === 0) {
      set({ downloadedPacks, availablePackUpdates: [] })
      return
    }

    try {
      const result = await learningApi.checkPacks(installed)
      set({ downloadedPacks, availablePackUpdates: result.updates })
      console.log(`[learning-store]   → ${result.updates.length} 个包有更新`)
      if (!silent && result.updates.length > 0) {
        toast.info(i18n.t('learning.packUpdatesAvailable', { defaultValue: '有学习包可更新' }))
      }
    } catch (error) {
      set({ downloadedPacks })
      console.warn('[learning-store]   → 检查失败', error)
      if (!silent) {
        toast.error(i18n.t('learning.packUpdateCheckFailed', { defaultValue: '学习包更新检查失败' }))
      }
    }
  },

  async downloadUnitPack(unitId) {
    const { packInstallingIds } = getState()
    if (packInstallingIds.includes(unitId)) return
    // ⭐ 网络检查：蜂窝网络需要用户确认
    if (!await checkNetworkBeforeDownload()) return
    set({ packInstallingIds: [...packInstallingIds, unitId] })
    try {
      await learningPackService.installUnit(unitId)
      const downloadedPacks = await learningPackService.listInstalled()
      set((state) => ({
        downloadedPacks,
        availablePackUpdates: state.availablePackUpdates.filter((update) => update.packId !== unitId),
      }))
    } finally {
      set((state) => ({
        packInstallingIds: state.packInstallingIds.filter((id) => id !== unitId),
      }))
    }
  },

  async uninstallUnitPack(unitId) {
    await learningPackService.uninstall(unitId)
    const downloadedPacks = await learningPackService.listInstalled()
    set((state) => ({
      downloadedPacks,
      availablePackUpdates: state.availablePackUpdates.filter((update) => update.packId !== unitId),
    }))
  },

  async clearAllOfflineData() {
    console.log('[learning-store] 🧹 清除所有离线数据...')
    const packs = await learningPackService.listInstalled()
    for (const pack of packs) {
      await learningPackService.uninstall(pack.packId)
    }
    set({
      downloadedPacks: [],
      availablePackUpdates: [],
      downloadTasks: [],
      packInstallingIds: [],
    })
    console.log('[learning-store] ✅ 离线数据已清除')
    toast.success('离线数据已清除')
  },
}))

// ─── 下载队列调度器（模块级函数，避免 store action 循环引用） ───

async function processDownloadQueue() {
  const state = useLearningStore.getState()
  const running = state.downloadTasks.filter(
    (t) => t.status === 'downloading' || t.status === 'extracting',
  ).length
  if (running >= MAX_CONCURRENT_DOWNLOADS) return

  const next = state.downloadTasks.find((t) => t.status === 'queued')
  if (!next) {
    console.log('[learning-store] 📭 下载队列已清空')
    return
  }

  useLearningStore.setState((s) => ({
    downloadTasks: s.downloadTasks.map((t) =>
      t.packId === next.packId ? { ...t, status: 'downloading' as const, progress: 0 } : t,
    ),
  }))

  try {
    if (!await checkNetworkBeforeDownload()) {
      useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.filter((t) => t.packId !== next.packId),
      }))
      processDownloadQueue()
      return
    }

    console.log(`[learning-store] ⏳ 开始下载: ${next.title}`)

    const progressTimer = setInterval(() => {
      useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.map((t) =>
          t.packId === next.packId && t.status === 'downloading'
            ? { ...t, progress: Math.min(80, t.progress + 5) }
            : t,
        ),
      }))
    }, 500)

    await learningPackService.installUnit(next.packId)
    clearInterval(progressTimer)

    useLearningStore.setState((s) => ({
      downloadTasks: s.downloadTasks.map((t) =>
        t.packId === next.packId ? { ...t, status: 'done' as const, progress: 100 } : t,
      ),
    }))
    console.log(`[learning-store] ✅ 下载完成: ${next.title}`)

    const downloadedPacks = await learningPackService.listInstalled()
    const updates = useLearningStore.getState().availablePackUpdates
    useLearningStore.setState({
      downloadedPacks,
      availablePackUpdates: updates.filter((u) => u.packId !== next.packId),
    })
    await useLearningStore.getState().refreshMyUnits()

    setTimeout(() => {
      useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.filter(
          (t) => !(t.packId === next.packId && t.status === 'done'),
        ),
      }))
    }, 3000)
  } catch (error: any) {
    console.error(`[learning-store] ❌ 下载失败: ${next.title}`, error)
    useLearningStore.setState((s) => ({
      downloadTasks: s.downloadTasks.map((t) =>
        t.packId === next.packId
          ? { ...t, status: 'error' as const, error: error?.message ?? '下载失败' }
          : t,
      ),
    }))
  } finally {
    processDownloadQueue()
  }
}

/** App 启动/恢复时调用：检查已安装包更新 + 加载本地状态 */
export async function startupPackSync() {
  console.log('[learning-store] 🚀 启动学习包同步...')
  const store = useLearningStore.getState()
  await store.fetchDownloadedPacks()
  await store.checkPackUpdates(true)
  console.log('[learning-store] ✅ 启动同步完成')
}

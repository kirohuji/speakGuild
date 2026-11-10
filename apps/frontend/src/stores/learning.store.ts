import { create } from 'zustand'
import { Network } from '@capacitor/network'
import {
  learningApi,
  isInProgressLearningUnit,
  isScriptLearningUnit,
  MAX_CONCURRENT_LEARNING_UNITS,
  type LearningUnitSummary,
  type LearningPackageType,
  type MyUnit,
  type PackUpdateInfo,
  type TagInfo,
  type UnitDetail,
} from '@/features/learning/api/learning-api'
import { pointsApi, type CheckInCalendar } from '@/features/points/api'
import {
  learningPackService,
  learningRepository,
  type InstalledLearningPack,
  type LearningPackInstallProgress,
} from '@/lib/offline'
import { localDb } from '@/lib/offline/unified-storage'
import { isNative } from '@/lib/native/platform'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useDailyPracticeStore } from '@/stores/daily-practice.store'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { ApiRequestError } from '@/lib/request'
import { confirmCellularDownload } from '@/components/common/cellular-download-confirm-dialog'
import { recordLearningPackDownloadFailure } from '@/lib/offline/learning-pack-diagnostics'

/** 下载任务状态 */
export interface DownloadTask {
  packId: string
  title: string
  kind?: 'download' | 'uninstall'
  progress: number        // 0-100
  step?: string           // 当前步骤标识（如 'downloading', 'extracting_assets'）
  stepLabel?: string
  currentItem?: string
  current?: number
  total?: number
  status: 'queued' | 'downloading' | 'extracting' | 'uninstalling' | 'paused' | 'done' | 'error'
  pausedFrom?: Exclude<DownloadTask['status'], 'paused'>
  error?: string
}

/** 最大并发下载数 */
const PACK_TASKS_STORAGE_KEY = 'manyu.learning-pack.tasks.v1'
const activePackTaskIds = new Set<string>()
const activePackTaskControllers = new Map<string, AbortController>()

function packTaskStepLabel(step: string, kind: DownloadTask['kind'] = 'download') {
  if (kind === 'uninstall') {
    if (step === 'quitting') return i18n.t('learning.packTaskStepQuitting')
    if (step === 'removing_assets') return i18n.t('learning.packTaskStepRemovingAssets')
    if (step === 'refreshing') return i18n.t('learning.packTaskStepRefreshingPlan')
    if (step === 'done') return i18n.t('learning.packTaskStepUninstallDone')
    if (step === 'paused') return i18n.t('learning.packTaskPaused')
    return i18n.t('learning.packTaskUninstalling')
  }
  if (step === 'preparing') return i18n.t('learning.packTaskStepPreparing')
  if (step === 'downloading') return i18n.t('learning.packTaskStepDownloadingPack')
  if (step === 'parsing') return i18n.t('learning.packTaskStepParsingPack')
  if (step === 'reading_manifest') return i18n.t('learning.packTaskStepReadingManifest')
  if (step === 'reading_topics') return i18n.t('learning.packTaskStepReadingTopics')
  if (step === 'persisting_content') return i18n.t('learning.packTaskStepPersistingContent')
  if (step === 'indexing') return i18n.t('learning.packTaskStepIndexing')
  if (step === 'extracting_assets') return i18n.t('learning.packTaskStepExtractingAssets')
  if (step === 'finishing') return i18n.t('learning.packTaskStepFinishing')
  if (step === 'paused') return i18n.t('learning.packTaskPaused')
  return i18n.t('learning.packTaskDownloading')
}

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
  fetchMyLearning: (silent?: boolean) => Promise<void>
  refreshMyUnits: () => Promise<void>
  fetchTags: (packageType?: LearningPackageType) => Promise<void>
  fetchUnitDetail: (unitId: string) => Promise<void>
  fetchShop: (params?: { tag?: string; packageType?: LearningPackageType; excludePackageType?: LearningPackageType; search?: string; page?: number }) => Promise<void>
  refreshShop: (params?: { tag?: string; packageType?: LearningPackageType; excludePackageType?: LearningPackageType; search?: string; page?: number }) => Promise<void>
  loadMoreShop: (params?: { tag?: string; packageType?: LearningPackageType; excludePackageType?: LearningPackageType; search?: string }) => Promise<void>
  fetchCheckInCalendar: (startDate: string, endDate: string) => Promise<void>
  enrollUnit: (
    unitId: string,
    title?: string,
    sourceUnit?: LearningUnitSummary | UnitDetail | null,
  ) => Promise<boolean>
  quitUnit: (unitId: string) => Promise<void>
  fetchDownloadedPacks: () => Promise<void>
  syncPackStateAfterLocalChange: (changedPackId?: string) => Promise<void>
  checkPackUpdates: (silent?: boolean) => Promise<void>
  downloadUnitPack: (unitId: string) => Promise<void>
  uninstallUnitPack: (unitId: string) => Promise<void>
  pauseActivePackTasks: (reason?: string) => void
  pausePackTask: (packId: string) => void
  cancelPackTask: (packId: string) => void
  resumePackTask: (packId: string) => Promise<void>
  resetUserState: () => void
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
      toast.error(i18n.t('profile.wifiOnlyBlocked'), {
        duration: 4000,
      })
      return false
    }

    // 允许移动网络 → 由应用根部的 Dialog 进行明确确认。
    return await confirmCellularDownload()
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
  downloadTasks: readPersistedPackTasks(),

  /** 首次加载：我的学习 + 商店 */
  async fetchMyLearning(silent = false) {
    // silent 模式用于页面重新进入时的后台刷新：不把 myLoading 翻回 true，
    // 避免“loading → 空状态”来回闪烁（例如每次进入剧本页都闪一下）。
    if (!silent) set({ myLoading: true })
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
      const units = await learningRepository.getMyUnits().catch(() => [] as MyUnit[])
      if (units.length > 0) set({ myUnits: units })
    }
  },

  async syncPackStateAfterLocalChange(changedPackId) {
    const downloadedPacks = await learningPackService.listInstalled()
    set({ downloadedPacks })
    const changedPack = changedPackId
      ? downloadedPacks.find((pack) => pack.packId === changedPackId)
      : null
    const changedUnit = changedPackId
      ? getState().myUnits.find((unit) => unit.id === changedPackId)
      : null
    const localPackDetail = changedPackId
      ? await localDb.get<{ packageType?: string; contentMode?: string }>('downloaded_unit_details', changedPackId).catch(() => null)
      : null
    const packageType = changedPack?.manifest?.packageType ?? changedUnit?.packageType ?? localPackDetail?.packageType
    const contentMode = changedPack?.manifest?.contentMode ?? changedUnit?.contentMode ?? localPackDetail?.contentMode
    const affectsTodayPractice = contentMode ? contentMode === 'practice' : packageType !== 'story'
    // Only practice-mode packages feed Today. Do not discard an already-built
    // daily plan when reading, writing, listening, novel or story content changes.
    if (affectsTodayPractice) useDailyPracticeStore.getState().reset()
    await getState().refreshMyUnits()
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

  async fetchTags(packageType) {
    try {
      const data = await learningApi.getTags(packageType)
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
        checkInData: { dates: [], totalCheckIns: 0, currentStreak: 0, dailyStats: [] },
        checkInLoading: false,
      }))
    }
  },

  async enrollUnit(unitId, title, providedUnit) {
    const state = getState()
    const sourceUnit = providedUnit ?? (state.unitDetail?.id === unitId
      ? state.unitDetail
      : state.shopUnits.find((unit) => unit.id === unitId) ?? null)
    const packTitle = title ?? sourceUnit?.title ?? unitId

    const alreadyEnrolled = state.myUnits.some((unit) => unit.id === unitId)
    const isScript = sourceUnit ? isScriptLearningUnit(sourceUnit) : false
    const inProgressCount = state.myUnits.filter(isInProgressLearningUnit).length
    if (!alreadyEnrolled && !isScript && inProgressCount >= MAX_CONCURRENT_LEARNING_UNITS) {
      toast.error(i18n.t('learning.concurrentUnitLimit'))
      return false
    }

    try {
      await learningRepository.enrollUnit(unitId, sourceUnit)
    } catch (error) {
      const message = error instanceof ApiRequestError && error.apiCode === 'LEARNING_UNIT_LIMIT_REACHED'
        ? i18n.t('learning.concurrentUnitLimit')
        : error instanceof Error ? error.message : i18n.t('learning.enrollFailed')
      // 清理同一包可能遗留的下载任务，避免被服务端拒绝后仍显示下载或继续安装。
      set((current) => ({
        downloadTasks: current.downloadTasks.filter((task) => task.packId !== unitId),
        packInstallingIds: current.packInstallingIds.filter((id) => id !== unitId),
      }))
      toast.error(message)
      return false
    }

    // 加入下载队列
    enqueueDownloadTask(unitId, packTitle)

    // 触发队列处理（异步，不 await）
    processDownloadQueue()
    return true
  },

  async quitUnit(unitId) {
    if (activePackTaskIds.has(unitId)) return
    const state = getState()
    const unitTitle =
      state.myUnits.find((unit) => unit.id === unitId)?.title ??
      state.downloadedPacks.find((pack) => pack.packId === unitId)?.title ??
      unitId
    activePackTaskIds.add(unitId)
    set((s) => ({
      downloadTasks: [
        ...s.downloadTasks.filter((task) => task.packId !== unitId),
        {
          packId: unitId,
          title: unitTitle,
          kind: 'uninstall' as const,
          status: 'uninstalling' as const,
          progress: 5,
          step: 'quitting',
          stepLabel: packTaskStepLabel('quitting', 'uninstall'),
        },
      ],
      packInstallingIds: s.packInstallingIds.includes(unitId)
        ? s.packInstallingIds
        : [...s.packInstallingIds, unitId],
    }))
    const updateUninstallProgress = (progress: number, step: string, stepLabel: string) => {
      set((s) => ({
        downloadTasks: s.downloadTasks.map((task) =>
          task.packId === unitId
            ? { ...task, progress, step, stepLabel, status: 'uninstalling' as const }
            : task,
        ),
      }))
    }
    try {
      // “退出学习”是放弃该学习包，而非仅移除下载的素材。先清本地 SRS
      // 与 run，避免卸载期间 Today 继续显示旧包的到期/逾期题。
      await learningRepository.clearPackPracticeProgress(unitId)
      useDailyPracticeStore.getState().invalidatePlans()
      await learningRepository.quitUnit(unitId)
      updateUninstallProgress(55, 'removing_assets', packTaskStepLabel('removing_assets', 'uninstall'))
      // Metadata removal is the UI-blocking path; file GC continues in background.
      await learningPackService.uninstallMetadata(unitId)
      void learningPackService.drainPackGcQueue()
      updateUninstallProgress(82, 'refreshing', packTaskStepLabel('refreshing', 'uninstall'))
      await getState().syncPackStateAfterLocalChange(unitId)
      set((current) => ({
        availablePackUpdates: current.availablePackUpdates.filter((update) => update.packId !== unitId),
      }))

      set((s) => ({
        downloadTasks: s.downloadTasks.map((task) =>
          task.packId === unitId
            ? { ...task, progress: 100, status: 'done' as const, step: 'done', stepLabel: packTaskStepLabel('done', 'uninstall') }
            : task,
        ),
        packInstallingIds: s.packInstallingIds.filter((id) => id !== unitId),
      }))
      toast.success(i18n.t('learning.packUninstallSuccess', {
        title: unitTitle,
      }))
      setTimeout(() => {
        useLearningStore.setState((s) => ({
          downloadTasks: s.downloadTasks.filter(
            (task) => !(task.packId === unitId && task.status === 'done'),
          ),
        }))
      }, 3000)
    } catch (error) {
      console.warn('[learning-store] uninstall failed', { unitId, error })
      set((s) => ({
        downloadTasks: s.downloadTasks.map((task) =>
          task.packId === unitId
            ? { ...task, status: 'error' as const, error: error instanceof Error ? error.message : i18n.t('learning.packTaskUninstallFailed'), stepLabel: i18n.t('learning.packTaskUninstallFailed') }
            : task,
        ),
        packInstallingIds: s.packInstallingIds.filter((id) => id !== unitId),
      }))
      toast.error(i18n.t('learning.packUninstallFailed', { title: unitTitle }))
    } finally {
      activePackTaskIds.delete(unitId)
    }
  },

  async fetchDownloadedPacks() {
    const downloadedPacks = await learningPackService.listInstalled()
    set({ downloadedPacks })
  },

  async checkPackUpdates(silent = true) {
    const downloadedPacks = await learningPackService.listInstalled()
    const installed = downloadedPacks
      .filter((pack) => pack.status === 'installed')
      .map((pack) => ({ packId: pack.packId, version: pack.version }))
    if (installed.length === 0) {
      set({ downloadedPacks, availablePackUpdates: [] })
      return
    }

    try {
      const result = await learningApi.checkPacks(installed)
      set({ downloadedPacks, availablePackUpdates: result.updates })
      if (!silent && result.updates.length > 0) {
        toast.info(i18n.t('learning.packUpdatesAvailable'))
      }
    } catch (error) {
      set({ downloadedPacks })
      console.warn('[learning-store]   → 检查失败', error)
      if (!silent) {
        toast.error(i18n.t('learning.packUpdateCheckFailed'))
      }
    }
  },

  async downloadUnitPack(unitId) {
    reclaimOrphanedDownloadTasks()
    const state = getState()
    // Live workers own the pack; orphaned downloading/extracting rows are
    // reclaimed above so a stuck 0% task can be restarted without a full reload.
    if (activePackTaskIds.has(unitId) || activePackTaskControllers.has(unitId)) return
    const existing = state.downloadTasks.find((task) => task.packId === unitId)
    if (existing && existing.status !== 'error' && existing.status !== 'paused') {
      if (existing.status === 'queued') processDownloadQueue()
      return
    }
    if (!state.myUnits.some((unit) => unit.id === unitId)) {
      toast.error(i18n.t('learning.downloadRequiresEnrollment'))
      return
    }

    const unitTitle =
      state.myUnits.find((unit) => unit.id === unitId)?.title ??
      state.shopUnits.find((unit) => unit.id === unitId)?.title ??
      state.downloadedPacks.find((pack) => pack.packId === unitId)?.title ??
      existing?.title ??
      unitId

    enqueueDownloadTask(unitId, unitTitle)
    processDownloadQueue()
  },

  async uninstallUnitPack(unitId) {
    await learningPackService.uninstallMetadata(unitId)
    void learningPackService.drainPackGcQueue()
    // 单纯卸载保留进度，以便将来重新下载；但不能继续把已卸载包作为 Today
    // 的内存计划展示。重新加载时会按仍安装的学习包重新解析。
    useDailyPracticeStore.getState().invalidatePlans()
    await getState().syncPackStateAfterLocalChange(unitId)
    set((state) => ({
      availablePackUpdates: state.availablePackUpdates.filter((update) => update.packId !== unitId),
    }))
  },

  pauseActivePackTasks(reason = i18n.t('learning.packTaskPausedInBackground')) {
    for (const controller of activePackTaskControllers.values()) controller.abort()
    set((s) => ({
      downloadTasks: s.downloadTasks.map((task) =>
        task.status === 'queued' || task.status === 'downloading' || task.status === 'extracting' || task.status === 'uninstalling'
          ? {
              ...task,
              status: 'paused' as const,
              pausedFrom: task.status,
              step: 'paused',
              stepLabel: reason,
            }
          : task,
      ),
    }))
  },

  pausePackTask(packId) {
    const task = getState().downloadTasks.find((item) => item.packId === packId)
    if (!task || task.kind === 'uninstall' || task.status === 'done' || task.status === 'error' || task.status === 'paused') return
    activePackTaskControllers.get(packId)?.abort()
    set((s) => ({
      downloadTasks: s.downloadTasks.map((item) => item.packId === packId
        ? { ...item, status: 'paused' as const, pausedFrom: item.status as DownloadTask['pausedFrom'], step: 'paused', stepLabel: i18n.t('learning.packTaskPaused') } as DownloadTask
        : item,
      ),
      packInstallingIds: s.packInstallingIds.filter((id) => id !== packId),
    }))
  },

  cancelPackTask(packId) {
    const task = getState().downloadTasks.find((item) => item.packId === packId)
    if (!task || task.kind === 'uninstall') return
    activePackTaskControllers.get(packId)?.abort()
    set((s) => ({
      downloadTasks: s.downloadTasks.filter((item) => item.packId !== packId),
      packInstallingIds: s.packInstallingIds.filter((id) => id !== packId),
    }))
    processDownloadQueue()
  },

  async resumePackTask(packId) {
    const task = getState().downloadTasks.find((item) => item.packId === packId)
    if (!task || task.status !== 'paused') return

    if (activePackTaskIds.has(packId)) {
      set((s) => ({
        downloadTasks: s.downloadTasks.map((item) =>
          item.packId === packId
            ? {
                ...item,
                status: item.pausedFrom === 'uninstalling' ? 'uninstalling' : 'downloading',
                stepLabel: item.kind === 'uninstall' ? i18n.t('learning.resumeUninstall') : i18n.t('learning.resumeDownload'),
              }
            : item,
        ),
      }))
      return
    }

    if (task.kind === 'uninstall') {
      await getState().quitUnit(packId)
      return
    }

    enqueueDownloadTask(packId, task.title)
    processDownloadQueue()
  },

  resetUserState() {
    set({
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
    })
  },

  async clearAllOfflineData() {
    const packs = await learningPackService.listInstalled()
    for (const pack of packs) {
      await learningPackService.uninstallMetadata(pack.packId)
    }
    await learningPackService.drainPackGcQueue()
    useDailyPracticeStore.getState().invalidatePlans()
    await getState().syncPackStateAfterLocalChange()
    set({
      availablePackUpdates: [],
      downloadTasks: [],
      packInstallingIds: [],
    })
    toast.success(i18n.t('profile.offlineDataCleared'))
  },
}))

// ─── 下载队列调度器（模块级函数，避免 store action 循环引用） ───

function enqueueDownloadTask(packId: string, title: string) {
  useLearningStore.setState((s) => ({
    downloadTasks: [
      ...s.downloadTasks.filter((task) => task.packId !== packId),
      { packId, title, kind: 'download' as const, progress: 0, status: 'queued' as const },
    ],
    packInstallingIds: s.packInstallingIds.includes(packId)
      ? s.packInstallingIds
      : [...s.packInstallingIds, packId],
  }))
}

let isProcessingQueue = false

/** Re-queue tasks that claim to be running but have no live worker (tab refresh / aborted hang). */
function reclaimOrphanedDownloadTasks() {
  const state = useLearningStore.getState()
  let changed = false
  const nextTasks = state.downloadTasks.map((task) => {
    if ((task.kind ?? 'download') === 'uninstall') return task
    if (task.status !== 'downloading' && task.status !== 'extracting') return task
    if (activePackTaskIds.has(task.packId) || activePackTaskControllers.has(task.packId)) return task
    changed = true
    return {
      ...task,
      status: 'queued' as const,
      progress: 0,
      step: undefined,
      stepLabel: undefined,
      currentItem: undefined,
      current: undefined,
      total: undefined,
      error: undefined,
    }
  })
  if (changed) useLearningStore.setState({ downloadTasks: nextTasks })
}

async function processDownloadQueue() {
  if (isProcessingQueue) return
  isProcessingQueue = true
  try {
    reclaimOrphanedDownloadTasks()
  } catch (error) {
    console.warn('[learning-store] failed to reclaim orphaned pack tasks', error)
  }
  const state = useLearningStore.getState()

  // Mobile package installation is intentionally a single FIFO queue. It keeps
  // ZIP memory, filesystem writes, and the shared SQLite connection bounded.
  const next = state.downloadTasks.find((t) => t.status === 'queued' && (t.kind ?? 'download') === 'download')
  if (!next) {
    isProcessingQueue = false
    return
  }

  const enrolled = (await learningRepository.getCachedMyUnits()).some((unit) => unit.id === next.packId)
  if (!enrolled) {
    console.warn('[learning-store] dropping download task for a unit that is not in the learning plan', { packId: next.packId })
    useLearningStore.setState((s) => ({
      downloadTasks: s.downloadTasks.filter((task) => task.packId !== next.packId),
      packInstallingIds: s.packInstallingIds.filter((id) => id !== next.packId),
    }))
    isProcessingQueue = false
    processDownloadQueue()
    return
  }

  useLearningStore.setState((s) => ({
    downloadTasks: s.downloadTasks.map((t) =>
      t.packId === next.packId ? { ...t, status: 'downloading' as const, progress: 0 } : t,
    ),
  }))

  try {
    activePackTaskIds.add(next.packId)
    const controller = new AbortController()
    activePackTaskControllers.set(next.packId, controller)
    if (!await checkNetworkBeforeDownload()) {
      useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.filter((t) => t.packId !== next.packId),
        packInstallingIds: s.packInstallingIds.filter((id) => id !== next.packId),
      }))
      return
    }

    // 真实进度回调：安装流程每步上报
    const onProgress = (step: string, progress: number, detail?: LearningPackInstallProgress) => {
      const status: DownloadTask['status'] = step === 'extracting_assets' ? 'extracting' : 'downloading'
      useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.map((t) =>
          t.packId === next.packId && (t.status === 'downloading' || t.status === 'extracting')
            ? {
                ...t,
                progress: Math.max(t.progress ?? 0, progress),
                step,
                status,
                stepLabel: packTaskStepLabel(step, 'download'),
                currentItem: detail?.currentItem,
                current: detail?.current,
                total: detail?.total,
              }
            : t,
        ),
      }))
    }

    const update = useLearningStore.getState().availablePackUpdates.find((u) => u.packId === next.packId)
    if (update?.updateType === 'delta' && update.deltaDownloadUrl) {
      await learningPackService.installDelta(next.packId, update.fromVersion, update.toVersion, controller.signal)
    } else {
      // Native install returns after content+deferred index (installed); asset
      // files continue in drainPackAssetMaterializeQueue inside installUnit.
      await learningPackService.installUnit(next.packId, onProgress, controller.signal)
    }
    void learningPackService.drainPackAssetMaterializeQueue(next.packId)

    // 先跳到 100% 进度，短暂停留让用户感知完成
    useLearningStore.setState((s) => ({
      downloadTasks: s.downloadTasks.map((t) =>
        t.packId === next.packId ? { ...t, progress: 100 } : t,
      ),
    }))
    await new Promise((r) => setTimeout(r, 600))

    useLearningStore.setState((s) => ({
      downloadTasks: s.downloadTasks.map((t) =>
        t.packId === next.packId ? { ...t, status: 'done' as const } : t,
      ),
      packInstallingIds: s.packInstallingIds.filter((id) => id !== next.packId),
    }))
    toast.success(i18n.t('learning.packDownloadSuccess', {
      title: next.title,
    }))

    const updates = useLearningStore.getState().availablePackUpdates
    await useLearningStore.getState().syncPackStateAfterLocalChange(next.packId)
    useLearningStore.setState({
      availablePackUpdates: updates.filter((u) => u.packId !== next.packId),
    })

    setTimeout(() => {
      useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.filter(
          (t) => !(t.packId === next.packId && t.status === 'done'),
        ),
      }))
    }, 3000)
  } catch (error: any) {
    const cancelled = activePackTaskControllers.get(next.packId)?.signal.aborted || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED'
    if (cancelled) {
      // pause* actions usually flip status first; if abort wins the race, do not
      // leave the task forever stuck in downloading/extracting at 0%.
      useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.map((t) =>
          t.packId === next.packId && (t.status === 'downloading' || t.status === 'extracting' || t.status === 'queued')
            ? {
                ...t,
                status: 'paused' as const,
                pausedFrom: t.status === 'queued' ? 'downloading' : t.status,
                step: 'paused',
                stepLabel: i18n.t('learning.packTaskPaused'),
              }
            : t,
        ),
        packInstallingIds: s.packInstallingIds.filter((id) => id !== next.packId),
      }))
      return
    }
    console.error(`[learning-store] ❌ 下载失败: ${next.title}`, error)
    const activeTask = useLearningStore.getState().downloadTasks.find((task) => task.packId === next.packId)
    const connectionType = await Network.getStatus().then((status) => status.connectionType).catch(() => 'unknown')
    recordLearningPackDownloadFailure({
      packId: next.packId,
      title: next.title,
      stage: activeTask?.step,
      connectionType,
      error,
    })
    useLearningStore.setState((s) => ({
        downloadTasks: s.downloadTasks.map((t) =>
          t.packId === next.packId
          ? { ...t, status: 'error' as const, error: error?.message ?? i18n.t('learning.packTaskDownloadFailed') }
          : t,
      ),
      packInstallingIds: s.packInstallingIds.filter((id) => id !== next.packId),
    }))
    toast.error(i18n.t('learning.packDownloadFailed'))
  } finally {
    activePackTaskIds.delete(next.packId)
    activePackTaskControllers.delete(next.packId)
    isProcessingQueue = false
    processDownloadQueue()
  }
}

function readPersistedPackTasks(): DownloadTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PACK_TASKS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((task: Partial<DownloadTask>) => task?.packId && task?.title && task.status !== 'done')
      .map((task: DownloadTask) => ({
        ...task,
        status: task.status === 'error' ? 'error' : 'paused',
        pausedFrom: task.status === 'paused' ? task.pausedFrom : task.status,
        step: task.status === 'error' ? task.step : 'paused',
        stepLabel: task.status === 'error' ? task.stepLabel : i18n.t('learning.packTaskPausedFromLastRun'),
      }))
  } catch (err) {
    console.warn('[learning-store] failed to parse persisted pack tasks, clearing', err)
    try { window.localStorage.removeItem(PACK_TASKS_STORAGE_KEY) } catch { /* ignore */ }
    return []
  }
}

function persistPackTasks(tasks: DownloadTask[]) {
  if (typeof window === 'undefined') return
  const active = tasks.filter((task) => task.status !== 'done')
  try {
    if (active.length === 0) {
      window.localStorage.removeItem(PACK_TASKS_STORAGE_KEY)
    } else {
      window.localStorage.setItem(PACK_TASKS_STORAGE_KEY, JSON.stringify(active))
    }
  } catch {
    // ignore storage quota/private mode errors
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
useLearningStore.subscribe((state) => {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => persistPackTasks(state.downloadTasks), 500)
})

/** App 启动/恢复时调用：检查已安装包更新 + 加载本地状态 */
export async function startupPackSync() {
  const store = useLearningStore.getState()
  await learningPackService.recoverInterruptedOperations()
  void learningPackService.drainPackGcQueue()
  void learningPackService.drainPackAssetMaterializeQueue()
  await store.fetchDownloadedPacks()
  await store.checkPackUpdates(true)
}

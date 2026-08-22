import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, Blocks, Braces, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, ListChecks, ListMusic, PenLine, Replace, Split, Target,
  AlertCircle, CheckCircle2, Loader2, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import { ChunkOutputDrillCard } from '@/features/practice/components/chunk-output-drill-card'
import { VocabOutputCard } from '@/features/practice/components/vocab-output-card'
import { PatternDrillCard } from '@/features/practice/components/pattern-drill-card'
import { SentenceDecompositionCard } from '@/features/practice/components/sentence-decomposition-card'
import { toWarmupReviewData, useWarmupSessionStore, type WarmupRecordEntry } from '@/stores/warmup-session.store'
import { useDailyPracticeStore } from '@/stores/daily-practice.store'
import { deriveTodayPractice, useTodayPracticeStore, type TodayCardAttempt } from '@/stores/today-practice.store'
import { dailyPracticeRepository, type DailyPracticePlanMode, type DailyPracticeStatus } from '@/lib/offline/daily-practice.repository'
import { TodayRecordsDrawer } from '../components/today-records-drawer'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { preloadWarmupLocalJudge, type WarmupReferencePreloadInput } from '@/lib/local-ai/warmup-local-judge'
import { useAuth } from '@/providers/auth-provider'
import { toast } from 'sonner'
import { offlineSyncService, practiceRepository } from '@/lib/offline'
import { syncOutbox } from '@/lib/offline/sync-outbox'
import { useEffectivePracticeTimer } from '@/hooks/use-effective-practice-timer'
import { useIsMobile } from '@/hooks/use-mobile'
import { useOfflineSyncStore } from '@/stores/offline-sync.store'
import { localDateKey } from '@/lib/date/calendar-date'

// ── 类型 ──
type SimplePromptItem = { zh?: string; en?: string; answer?: string; hint?: string; imageUrl?: string; audioUrl?: string; audioAssetId?: string }
type VocabPromptItem = {
  vocabId: string
  promptZh: string
  targetWords?: string[]
  suggestedAnswer?: string
  hint?: string
}

export type PracticeItem = {
  id: string
  type: string
  label: string
  topicId: string
  topicTitle: string
  scheduleStatus?: DailyPracticeStatus
  /** 准确描述练习内容的标签，用于卡片和抽屉标题 */
  displayLabel: string
  /** Dialog header 大字展示的原始练习数据（单词/句型/句块） */
  headerContent: string
  render: () => React.ReactNode
}

type PracticeGroup = {
  type: string
  meta: { label: string; icon: typeof PenLine; color: string }
  steps: Array<{ step: PracticeItem; index: number }>
  doneCount: number
  totalCount: number
}

const TODAY_TASK_MODE_SESSION_KEY = 'manyu-today-task-mode'
const TODAY_TEACHING_HINT_SEEN_KEY = 'manyu:today-teaching-hint-seen'
const TODAY_REVIEW_DISMISSED_SESSION_KEY_PREFIX = 'manyu:today-review-dismissed:'
const TOPIC_PAGE_SIZE = 8

function normalizePlanMode(mode: string | null): DailyPracticePlanMode {
  return mode === 'review' || mode === 'practice' ? mode : 'practice'
}

function localTodayKey() {
  return localDateKey()
}

function wasTodayReviewDismissed(runId: string) {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(`${TODAY_REVIEW_DISMISSED_SESSION_KEY_PREFIX}${runId}`) === 'true'
  } catch {
    return false
  }
}

function wasTodayPracticeRetryPromptDismissed(date: string) {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(`${TODAY_REVIEW_DISMISSED_SESSION_KEY_PREFIX}practice:${date}`) === 'true'
  } catch {
    return false
  }
}

function buildTodayReferencePreloads(steps: NonNullable<ReturnType<typeof useDailyPracticeStore.getState>['plan']>['steps']): WarmupReferencePreloadInput[] {
  const references: WarmupReferencePreloadInput[] = []
  const simpleReference = (prompt: any, direction: 'zh_to_en' | 'en_to_zh') => {
    const looksEnglish = (text?: string) => /[A-Za-z]/.test(text ?? '')
    const isLegacyEnToZhItem = direction === 'en_to_zh' && !prompt.en && looksEnglish(prompt.answer) && Boolean(prompt.zh)
    return {
      promptText: direction === 'zh_to_en'
        ? (prompt.zh ?? prompt.en ?? '')
        : (prompt.en ?? (isLegacyEnToZhItem ? prompt.answer : prompt.zh) ?? prompt.answer ?? ''),
      expectedAnswer: direction === 'zh_to_en'
        ? (prompt.answer ?? '')
        : (prompt.en ? (prompt.answer ?? prompt.zh ?? '') : (isLegacyEnToZhItem ? prompt.zh ?? '' : prompt.answer ?? prompt.zh ?? '')),
    }
  }
  for (const source of steps) {
    const item = source.item
    const prompt = source.prompt
    if (source.type === 'chunk_substitution') {
      const direction = item.direction ?? 'zh_to_en'
      const { promptText, expectedAnswer } = simpleReference(prompt, direction)
      references.push({
        stepType: 'chunk_substitution',
        direction,
        prompt: promptText,
        expectedAnswer,
      })
    } else if (source.type === 'vocab_drill') {
      const direction = item.direction ?? 'zh_to_en'
      references.push({
        stepType: 'vocab_drill',
        direction,
        prompt: direction === 'zh_to_en' ? prompt.promptZh : (prompt.suggestedAnswer ?? prompt.promptZh),
        expectedAnswer: direction === 'zh_to_en' ? prompt.suggestedAnswer : prompt.promptZh,
      })
    } else if (source.type === 'vocab_sentence_building') {
      const direction = item.direction ?? 'zh_to_en'
      const { promptText, expectedAnswer } = simpleReference(prompt, direction)
      references.push({
        stepType: 'vocab_sentence_building',
        direction,
        prompt: promptText,
        expectedAnswer,
      })
    } else if (source.type === 'pattern_drill') {
      const direction = item.direction ?? 'zh_to_en'
      const { promptText, expectedAnswer } = simpleReference(prompt, direction)
      references.push({
        stepType: 'pattern_drill',
        direction,
        prompt: promptText,
        expectedAnswer,
      })
    }
  }
  return references
}

// ── 类型显示映射（在组件内用 useMemo 获取 i18n）──
function useTypeMeta(t: (key: string) => string): Record<string, { label: string; icon: typeof PenLine; color: string }> {
  return useMemo(() => ({
    chunk_substitution: {
      label: t('todayTask.chunkSubstitution'),
      icon: Replace,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
    },
    vocab_drill: {
      label: t('todayTask.vocabDrill'),
      icon: PenLine,
      color: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    },
    vocab_sentence_building: {
      label: t('todayTask.vocabSentenceBuilding'),
      icon: Blocks,
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    },
    pattern_drill: {
      label: t('todayTask.patternDrill'),
      icon: Braces,
      color: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    },
    sentence_decomposition: {
      label: t('todayTask.sentenceDecomposition'),
      icon: Split,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    },
  }), [t])
}

// ── 组件 ──
export function TodayTaskPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const onboardingCompletedSegments = useOnboardingStore((state) => state.completedSegments)
  const isAdmin = session?.user?.role === 'admin'
  const TYPE_META = useTypeMeta(t)
  const warmupRecords = useWarmupSessionStore((s) => s.records)
  const clearWarmupSession = useWarmupSessionStore((s) => s.clearSession)
  const resetRetryCycleUi = useWarmupSessionStore((s) => s.resetRetryCycleUi)
  const [searchParams, setSearchParams] = useSearchParams()
  const targetPackId = searchParams.get('packId') || null
  const targetDate = searchParams.get('date') || null
  const plan = useDailyPracticeStore((s) => s.plan)
  const loading = useDailyPracticeStore((s) => s.loading)
  const error = useDailyPracticeStore((s) => s.error)
  const submitting = useDailyPracticeStore((s) => s.submitting)
  const loadToday = useDailyPracticeStore((s) => s.loadToday)
  const waitForPendingWrites = useDailyPracticeStore((s) => s.waitForPendingWrites)
  const recordAttempt = useDailyPracticeStore((s) => s.recordAttempt)
  const recordRehearsalAttempt = useDailyPracticeStore((s) => s.recordRehearsalAttempt)
  const openMainSession = useDailyPracticeStore((s) => s.openMainSession)
  const startMistakeRetry = useDailyPracticeStore((s) => s.startMistakeRetry)
  const setMachineCurrentStep = useDailyPracticeStore((s) => s.setCurrentStep)
  const closeSession = useDailyPracticeStore((s) => s.closeSession)
  const syncRunSnapshot = useDailyPracticeStore((s) => s.syncRunSnapshot)
  const submitToday = useDailyPracticeStore((s) => s.submitToday)
  const dailyPracticeRandomOrder = usePreferencesStore((s) => s.dailyPracticeRandomOrder)
  const dailyPracticeLastMode = usePreferencesStore((s) => s.dailyPracticeLastMode)
  const setDailyPracticeLastMode = usePreferencesStore((s) => s.setDailyPracticeLastMode)
  const localAiWarmupJudgeEnabled = usePreferencesStore((s) => s.localAiWarmupJudgeEnabled)

  // 练习状态
  const hydrateWarmupSession = useWarmupSessionStore((s) => s.hydrateSession)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  /** 错题重练弹窗：独立 state 控制，只在主轮刚完成的当次会话中弹出 */
  const [weakReviewPromptOpen, setWeakReviewPromptOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [typeGroupViewing, setTypeGroupViewing] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [teachingOpen, setTeachingOpen] = useState(false)
  const [teachingMarkdown, setTeachingMarkdown] = useState('')
  const [teachingLoading, setTeachingLoading] = useState(false)
  const [teachingAvailability, setTeachingAvailability] = useState<Record<string, boolean>>({})
  const [showAllTeachingTopics, setShowAllTeachingTopics] = useState(false)
  const [topicsExpanded, setTopicsExpanded] = useState(false)
  const [topicPage, setTopicPage] = useState(1)
  const [showTeachingHintIntro, setShowTeachingHintIntro] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(TODAY_TEACHING_HINT_SEEN_KEY) !== 'true'
  })
  const [historicalTodayRecords, setHistoricalTodayRecords] = useState<WarmupRecordEntry[]>([])
  const [autoNextEnabled, setAutoNextEnabled] = useState(false)
  const [reviewRunNonce, setReviewRunNonce] = useState(0)
  const [reviewDismissal, setReviewDismissal] = useState<{ runId: string | null; dismissed: boolean }>({ runId: null, dismissed: false })
  const [rehearsalAll, setRehearsalAll] = useState(false)
  const [manualSyncing, setManualSyncing] = useState(false)
  const [practiceTabSummary, setPracticeTabSummary] = useState<{ attemptedCount: number; totalCount: number } | null>(null)
  const [reviewDebtCount, setReviewDebtCount] = useState<number | null>(null)
  // 今日任务相关 outbox 存在未同步改动时，同步按钮显示感叹号角标。
  const [hasPendingSync, setHasPendingSync] = useState(false)
  // 同步发现今日任务有更新时，询问用户是否立即刷新。
  const [showTodayUpdateDialog, setShowTodayUpdateDialog] = useState(false)
  // 任意一次同步完成（登录 / 自动 / 手动 / 其他页面）都会更新该时间戳。
  const lastSyncedAt = useOfflineSyncStore((s) => s.lastSyncedAt)
  const todayState = useTodayPracticeStore()
  const reviewRoundActive = todayState.roundKind === 'mistakeRetry'
  const attemptedIds = todayState.attemptedIds
  const unresolvedIds = todayState.unresolvedIds
  const reviewPendingIds = unresolvedIds
  const reviewDoneIds = useMemo(() => new Set(todayState.roundStepIds.filter((id) => attemptedIds.has(id) && !unresolvedIds.has(id))), [attemptedIds, todayState.roundStepIds, unresolvedIds])
  const sessionHydrated = todayState.sessionHydrated
  const hasSubmittedToday = todayState.submissionStatus === 'synced'
  // Read the persisted value immediately as well, so a route remount cannot flash the dialog
  // before the hydration effect below has run.
  const reviewDismissed = plan?.runId
    ? ((reviewDismissal.runId === plan.runId && reviewDismissal.dismissed)
      || wasTodayReviewDismissed(plan.runId)
      || wasTodayPracticeRetryPromptDismissed(plan.date))
    : false
  const localAiPreloadKeyRef = useRef<string | null>(null)
  const warmupSessionHydratedKeyRef = useRef<string | null>(null)
  const teachingRequestIdRef = useRef(0)
  const planMode = searchParams.has('mode')
    ? normalizePlanMode(searchParams.get('mode'))
    : normalizePlanMode(typeof window === 'undefined' ? dailyPracticeLastMode : (window.sessionStorage.getItem(TODAY_TASK_MODE_SESSION_KEY) ?? dailyPracticeLastMode))
  const [planRunSeed, setPlanRunSeed] = useState(0)
  const [observedToday, setObservedToday] = useState(localTodayKey)
  useEffect(() => {
    const checkDate = () => {
      if (!drawerOpen) setObservedToday(localTodayKey())
    }
    document.addEventListener('visibilitychange', checkDate)
    const timer = window.setInterval(checkDate, 60_000)
    checkDate()
    return () => {
      document.removeEventListener('visibilitychange', checkDate)
      window.clearInterval(timer)
    }
  }, [drawerOpen])
  useEffectivePracticeTimer({
    enabled: drawerOpen && Boolean(plan?.date),
    sourceId: plan?.runId ?? null,
    scope: 'daily',
    questionCount: attemptedIds.size,
  })
  const currentPlanReusable = Boolean(
    plan &&
    planRunSeed === 0 &&
    plan.mode === planMode &&
    plan.date === (targetDate || observedToday) &&
    (!targetPackId || plan.units.some((unit) => unit.id === targetPackId)),
  )

  // The page store intentionally holds only the active mode's plan. Fetch the
  // practice summary independently so the inactive tab never renders review
  // run data as "今日练习" progress.
  useEffect(() => {
    if (!plan?.date) {
      setPracticeTabSummary(null)
      return
    }
    let cancelled = false
    void dailyPracticeRepository.getRunSummary(plan.date, 'practice').then((summary) => {
      if (!cancelled) setPracticeTabSummary(summary)
    })
    return () => { cancelled = true }
  }, [plan?.date, plan?.runId])

  // 「今日复习」卡片待办数：按复习真实范围（跨包/当前包）独立计算，
  // 不随当前激活 Tab 的 plan 变化，保证两个 Tab 下显示一致；
  // 同步完成后本地进度可能变化，一并刷新。
  useEffect(() => {
    if (!plan?.date) {
      setReviewDebtCount(null)
      return
    }
    let cancelled = false
    void dailyPracticeRepository.getReviewDebtCount(plan.date).then((count) => {
      if (!cancelled) setReviewDebtCount(count)
    })
    return () => { cancelled = true }
  }, [lastSyncedAt, plan?.availableReviewCount, plan?.date])

  useEffect(() => {
    if (currentPlanReusable) return
    clearWarmupSession()
    setReviewRunNonce(0)
    let cancelled = false
    loadToday(targetPackId, targetDate, planMode, planRunSeed > 0)
      .then(() => { if (cancelled) return })
    return () => { cancelled = true }
  }, [clearWarmupSession, currentPlanReusable, loadToday, targetPackId, targetDate, planMode, planRunSeed])

  // 「稍后再练」只应在当前练习 run 内隐藏提示；路由切换后也要保持这一选择。
  useEffect(() => {
    const runId = plan?.runId ?? null
    setReviewDismissal({
      runId,
      dismissed: Boolean(runId && (wasTodayReviewDismissed(runId)
        || wasTodayPracticeRetryPromptDismissed(plan?.date ?? ''))),
    })
  }, [plan?.date, plan?.runId])

  const dismissReviewRound = useCallback(() => {
    const runId = plan?.runId ?? null
    setReviewDismissal({ runId, dismissed: true })
    if (!runId || typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(`${TODAY_REVIEW_DISMISSED_SESSION_KEY_PREFIX}${runId}`, 'true')
      // A tab switch can temporarily replace the active plan and, in recovery
      // cases, restore the same daily practice under a new client run id.
      // The user's "later" choice belongs to this calendar day's practice,
      // not to that incidental identifier.
      if (plan?.mode === 'practice' && plan.date) {
        window.sessionStorage.setItem(`${TODAY_REVIEW_DISMISSED_SESSION_KEY_PREFIX}practice:${plan.date}`, 'true')
      }
    } catch {
      // Private browsing or an unavailable WebView storage must not block closing the dialog.
    }
  }, [plan?.date, plan?.mode, plan?.runId])

  // 今日计划就绪时触发「每日练习」引导（条件式分段，仅首次）
  useEffect(() => {
    if (plan && plan.steps.length > 0) {
      useOnboardingStore.getState().tryStartSegment('today-practice')
    }
  }, [plan, onboardingCompletedSegments])

  useEffect(() => {
    if (!localAiWarmupJudgeEnabled) return
    if (!drawerOpen) return
    const references = buildTodayReferencePreloads(plan?.steps ?? [])
    const preloadKey = references
      .map((item) => `${item.stepType}:${item.direction ?? ''}:${item.prompt}:${item.expectedAnswer ?? ''}`)
      .join('|')
    if (localAiPreloadKeyRef.current === preloadKey) return
    localAiPreloadKeyRef.current = preloadKey
    void preloadWarmupLocalJudge(references, {
      source: 'today',
      packId: targetPackId ?? plan?.units?.[0]?.id ?? null,
    })
      .then((result) => {
        if (isAdmin && (result?.computedCount ?? 0) > 0) {
          toast.success(t('todayTask.localAiPreloadSuccess', { count: result?.computedCount ?? references.length }))
        }
      })
      .catch((error) => {
        console.warn('[warmup-local-judge] preload failed:', error)
        if (isAdmin) {
          toast.warning(t('todayTask.localAiPreloadFailed', { error: error instanceof Error ? error.message : String(error) }))
        }
      })
  }, [drawerOpen, isAdmin, localAiWarmupJudgeEnabled, plan?.steps, plan?.units, t, targetPackId])

  // 今日任务相关（daily_practice）outbox 是否需要同步按钮显示感叹号角标。
  // 只在「真正需要用户关注」时亮：同步失败，或存在超过 1 小时仍未上传的
  // pending（在线时会被检查点同步自动冲掉，基本不会触发；离线时才是提醒）。
  // 普通 pending（刚答完题、等待下次同步）不亮灯，避免离线优先设计下常态噪音。
  const refreshPendingSyncBadge = useCallback(async () => {
    try {
      const pending = await syncOutbox.listPending()
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      setHasPendingSync(pending.some((item) => {
        if (item.entityType !== 'daily_practice') return false
        if (item.status === 'failed') return true
        return item.status === 'pending' && new Date(item.createdAt).getTime() <= oneHourAgo
      }))
    } catch {
      setHasPendingSync(false)
    }
  }, [])

  // 挂载时 + 任意同步完成后刷新角标（自动同步上传了本地改动后感叹号应消失）。
  useEffect(() => {
    void refreshPendingSyncBadge()
  }, [lastSyncedAt, refreshPendingSyncBadge])

  // 页面停留期间周期性刷新角标，让「长期未上传」（>1h）阈值在离线场景下也能按时生效。
  useEffect(() => {
    const timer = window.setInterval(() => { void refreshPendingSyncBadge() }, 60_000)
    return () => window.clearInterval(timer)
  }, [refreshPendingSyncBadge])

  // 同步完成后：本地 run 若被服务端改写（与页面当前状态不一致）→ 弹窗询问。
  useEffect(() => {
    if (!lastSyncedAt) return
    let cancelled = false
    void useDailyPracticeStore.getState().checkRunChangedLocally().then((changed) => {
      if (!cancelled && changed) setShowTodayUpdateDialog(true)
    })
    return () => { cancelled = true }
  }, [lastSyncedAt])

  const applyTodayUpdate = useCallback(async () => {
    setShowTodayUpdateDialog(false)
    useDailyPracticeStore.getState().invalidatePlans()
    await loadToday(targetPackId, targetDate, planMode)
  }, [loadToday, planMode, targetDate, targetPackId])

  const handleAttempt = useCallback(async (attempt: TodayCardAttempt) => {
    try {
      // A retry card may expose its generic “try again” affordance.  That
      // component marks the next answer as rehearsal for normal practice, but
      // inside the dedicated mistake round it is a formal remediation attempt
      // and must resolve (or retain) the daily-task mistake on the server.
      if (!reviewRoundActive && (attempt.purpose === 'rehearsal' || rehearsalAll)) {
        await recordRehearsalAttempt(attempt.stepId, attempt.outcome, attempt.assistance)
        return
      }
      const source = plan?.steps.find((step) => step.itemId === attempt.stepId)
      if (source) await recordAttempt(source, attempt.outcome, attempt.assistance)
    } catch (error) {
      console.error('[today-task] failed to persist attempt:', error)
      toast.error(error instanceof Error ? error.message : t('common.error'))
    } finally {
      // 作答会写入 outbox（待同步快照），同步后刷新角标。
      void refreshPendingSyncBadge()
    }
  }, [plan?.steps, recordAttempt, recordRehearsalAttempt, refreshPendingSyncBadge, rehearsalAll, reviewRoundActive, t])

  const switchPlanMode = useCallback((nextMode: DailyPracticePlanMode) => {
    if (nextMode === plan?.mode) return
    window.sessionStorage.setItem(TODAY_TASK_MODE_SESSION_KEY, nextMode)
    setDailyPracticeLastMode(nextMode)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('mode', nextMode)
      return next
    })
    setRehearsalAll(false)
    setPlanRunSeed(0)
    setCurrentIdx(0)
    setDrawerOpen(false)
    setWeakReviewPromptOpen(false)
    setPlaylistOpen(false)
    setRecordsOpen(false)
    setReviewRunNonce(0)
    clearWarmupSession()
  }, [clearWarmupSession, plan?.mode, setDailyPracticeLastMode, setSearchParams])

  const syncTodayTask = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId || manualSyncing) return
    setManualSyncing(true)
    try {
      // 答题写入（facts、SRS、outbox）必须先完成，随后只做一次网络同步。
      await waitForPendingWrites()
      // 只同步今日任务相关数据（daily_practice run/记录/进度），不拉其他页面类型；
      // quiet 让按钮只报一条端到端结果，不叠加内部多次 toast。
      const result = await offlineSyncService.sync(userId, { quiet: true, scope: 'today' })
      if (result.push.failed > 0) throw new Error(`${result.push.failed} 条数据未同步`)
      // pull 完成后仅以本地已更新的数据重建页面；loadToday 不产生 outbox。
      await loadToday(targetPackId, targetDate, planMode)
      toast.success('今日任务已同步')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '今日任务同步失败')
    } finally {
      setManualSyncing(false)
      void refreshPendingSyncBadge()
    }
  }, [loadToday, manualSyncing, planMode, refreshPendingSyncBadge, session?.user?.id, targetDate, targetPackId, waitForPendingWrites])

  const startNewPracticeSet = useCallback(() => {
    closeSession()
    setRehearsalAll(false)
    setPlanRunSeed(Date.now())
    setCurrentIdx(0)
    setDrawerOpen(false)
    setWeakReviewPromptOpen(false)
    setPlaylistOpen(false)
    setRecordsOpen(false)
    setReviewRunNonce(0)
    clearWarmupSession()
  }, [clearWarmupSession, closeSession])

  const startRePractice = useCallback(() => {
    closeSession()
    setRehearsalAll(true)
    setCurrentIdx(0)
    setDrawerOpen(false)
    setWeakReviewPromptOpen(false)
    setPlaylistOpen(false)
    setRecordsOpen(false)
    setReviewRunNonce(0)
    clearWarmupSession()
    openMainSession()
    setDrawerOpen(true)
  }, [clearWarmupSession, closeSession, openMainSession])

  // ── 构建练习列表 ──
  const steps = useMemo<PracticeItem[]>(() => {
    return (plan?.steps ?? []).map((source) => {
      const item = source.item
      const prompt = source.prompt
      const sid = source.itemId
      const common = {
        id: sid,
        type: source.type,
        label: source.label,
        displayLabel: source.displayLabel,
        headerContent: source.headerContent,
        topicId: source.topicId,
        topicTitle: source.topicTitle,
        scheduleStatus: source.scheduleStatus,
      }
      // Type cards include answered questions for inspection. They are
      // read-only there; the dedicated mistake-retry flow is the only way to
      // answer an incorrect item again.
      const initialResult = todayState.initialRecallResults[sid]
      const savedRecord = warmupRecords.find((record) => record.stepId === sid)
      const historicalReview = typeGroupViewing && !reviewRoundActive && initialResult
        ? toWarmupReviewData(savedRecord ?? {
            userAnswer: '',
            passed: !unresolvedIds.has(sid),
            feedback: '',
          })
        : null

      if (source.type === 'chunk_substitution') {
          const isWord = (item.kind ?? 'chunk') === 'word'
          return {
            ...common,
            displayLabel: isWord ? t('todayTask.wordSubstitution') : t('todayTask.chunkSubstitution'),
            render: () => (
              <ChunkOutputDrillCard
                chunk={{ text: item.chunk, meaning: item.chunkMeaning || '', description: null }}
                items={[prompt as SimplePromptItem]}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                kind={item.kind ?? 'chunk'}
                groupTitle={item.title}
                onAttempt={(attempt) => { void handleAttempt(attempt) }}
                reviewData={historicalReview}
              />
            ),
          }
        }

        if (source.type === 'vocab_drill') {
          return {
            ...common,
            render: () => (
              <VocabOutputCard
                title={item.title || t('todayTask.vocabDrill')}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                vocabs={[prompt as VocabPromptItem]}
                onAttempt={(attempt) => { void handleAttempt(attempt) }}
                hideHeader
                reviewData={historicalReview}
              />
            ),
          }
        }

        if (source.type === 'vocab_sentence_building') {
          const pattern = prompt.pattern ?? {}
          const vocabWord = item.vocabWord || ''
          const patternChunk = pattern.chunk || vocabWord
          const targetWord = vocabWord || patternChunk
          return {
            ...common,
            headerContent: targetWord,
            render: () => (
              <ChunkOutputDrillCard
                chunk={{ text: targetWord, meaning: item.vocabMeaning || '', description: null }}
                items={[prompt as SimplePromptItem]}
                stepId={sid}
                stepType="vocab_sentence_building"
                direction={item.direction ?? 'zh_to_en'}
                kind="word"
                groupTitle={`${vocabWord || t('todayTask.vocabSentenceBuilding')} · ${patternChunk}`}
                onAttempt={(attempt) => { void handleAttempt(attempt) }}
                reviewData={historicalReview}
              />
            ),
          }
        }

        if (source.type === 'pattern_drill') {
          return {
            ...common,
            render: () => (
              <PatternDrillCard
                pattern={item.pattern}
                patternMeaning={item.patternMeaning}
                items={[prompt as SimplePromptItem]}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                groupTitle={item.title}
                onAttempt={(attempt) => { void handleAttempt(attempt) }}
                hideHeader
                reviewData={historicalReview}
              />
            ),
          }
        }

        return {
          ...common,
            render: () => (
              <SentenceDecompositionCard
                title={item.title || t('todayTask.longSentenceDecomposition')}
                levels={item.levels}
                stepId={sid}
                onAttempt={(attempt) => { void handleAttempt(attempt) }}
                hideHeader
                reviewData={historicalReview ? { levelAudios: null } : null}
              />
            ),
        }
      })
  }, [handleAttempt, plan?.steps, reviewRoundActive, t, todayState.initialRecallResults, typeGroupViewing, unresolvedIds, warmupRecords])

  // 重练轮由待重练 id 集合派生（保证 render 闭包基于最新 reviewRoundActive）
  const reviewSteps = useMemo<PracticeItem[] | null>(() => {
    if (!reviewRoundActive || todayState.sessionStepIds.length === 0) return null
    const snapshot = new Set(todayState.sessionStepIds)
    return steps.filter((step) => snapshot.has(step.id))
  }, [reviewRoundActive, steps, todayState.sessionStepIds])
  // Every progress view derives from this one canonical result. A "don't
  // know" answer is attempted + unresolved (red), never completed.
  const derivedToday = deriveTodayPractice(todayState)
  const passedStepIds = new Set(derivedToday.greenStepIds)
  const weakStepIds = unresolvedIds
  const weakRecords = useMemo(() => warmupRecords.filter((record) => weakStepIds.has(record.stepId)), [warmupRecords, weakStepIds])
  // Session is a stable snapshot. Incorrect answers never remove a card from it.
  const mainQueue = steps
  const mainSessionSteps = todayState.sessionStepIds.length > 0 && !reviewRoundActive
    ? steps.filter((step) => todayState.sessionStepIds.includes(step.id))
    : mainQueue
  const activeSteps = reviewRoundActive && reviewSteps ? reviewSteps : mainSessionSteps
  const activeDoneIds = reviewRoundActive ? reviewDoneIds : passedStepIds

  const warmupRecordId = useMemo(() => {
    if (!plan || plan.scheduledItemIds.length === 0) return null
    return `today-warmup:${plan.runId}`
  }, [plan])

  useEffect(() => {
    if (!warmupRecordId || steps.length === 0) return
    if (warmupSessionHydratedKeyRef.current === warmupRecordId) return
    warmupSessionHydratedKeyRef.current = warmupRecordId
    let cancelled = false
    void practiceRepository.getLocalWarmupRecord(warmupRecordId).then((record) => {
      if (cancelled) return
      const rawRecords = record?.items ?? []
      const stepIds = new Set(steps.map((step) => step.id))
      const currentRecords = Array.isArray(rawRecords) ? (rawRecords as WarmupRecordEntry[])
        .filter((record) => stepIds.has(record.stepId))
        : []
      if (currentRecords.length > 0 && !reviewRoundActive) hydrateWarmupSession(currentRecords)
      // Historical answers are intentionally not hydrated into an active retrieval.
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [hydrateWarmupSession, reviewRoundActive, steps, warmupRecordId])

  const enrichedWarmupRecords = useMemo(() => {
    // 用 plan.steps（ScheduledDailyPracticeItem）补全学习包归属，保证练习记录
    // 能溯源到 packId/packTitle。
    const stepById = new Map((plan?.steps ?? []).map((step) => [step.itemId, step]))
    return warmupRecords.map((record) => {
      const step = stepById.get(record.stepId)
      return {
        ...record,
        packId: record.packId ?? step?.packId,
        packTitle: record.packTitle ?? step?.packTitle,
        displayLabel: record.displayLabel ?? step?.displayLabel,
        topicTitle: record.topicTitle ?? step?.topicTitle,
        initialRecallResult: todayState.initialRecallResults[record.stepId],
        continuationResult: todayState.continuationResults[record.stepId],
        remediationResult: todayState.remediationResults[record.stepId],
      }
    })
  }, [plan?.steps, todayState.continuationResults, todayState.initialRecallResults, todayState.remediationResults, warmupRecords])

  useEffect(() => {
    if (!warmupRecordId || !plan || enrichedWarmupRecords.length === 0) return
    // 已提交且不在重练中 → 不再把 synced 改回 pending
    if (hasSubmittedToday && !reviewRoundActive) return
    const firstTopic = plan.topicStats.find((topic) => topic.scheduledTodayCount > 0) ?? plan.topicStats[0]
    if (!firstTopic) return
    void (async () => {
      // Persist the display record first, then attach that exact record to the
      // in-progress run snapshot. This makes logout/relogin recovery complete.
      await practiceRepository.upsertLocalWarmupRecord({
        id: warmupRecordId,
        topicId: firstTopic.topicId,
        topicTitle: firstTopic.topicTitle,
        items: enrichedWarmupRecords,
        practicedDate: plan.date,
        syncStatus: 'pending',
      })
      await syncRunSnapshot(enrichedWarmupRecords, warmupRecordId)
    })().catch(() => undefined)
  }, [enrichedWarmupRecords, hasSubmittedToday, plan, reviewRoundActive, syncRunSnapshot, warmupRecordId])

  // The record drawer is a view of durable, date-scoped data — not of the
  // currently active tab's warmup store. A mode switch resets that transient
  // store, so loading only while the drawer was open made records disappear
  // until this page remounted.
  useEffect(() => {
    if (!plan?.date) {
      setHistoricalTodayRecords([])
      return
    }
    let cancelled = false
    void practiceRepository.getWarmupEntriesByDate(plan.date).then((records) => {
      if (!cancelled) setHistoricalTodayRecords(records)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [plan?.date, warmupRecordId])

  // ── 进度统计 ──
  const attemptedCount = derivedToday.attemptedCount
  const practiceTabAttemptedCount = plan?.mode === 'practice'
    ? attemptedCount
    : (practiceTabSummary?.attemptedCount ?? 0)
  const practiceTabTotalCount = plan?.mode === 'practice'
    ? (plan?.scheduledItemIds.length ?? 0)
    : (practiceTabSummary?.totalCount ?? plan?.dailyGoal ?? 0)
  const hasPracticeSteps = steps.length > 0
  const isReviewMode = plan?.mode === 'review'
  const mainActionLabel = isReviewMode
    ? (attemptedCount > 0 ? t('todayTask.continueReview') : t('todayTask.startReview'))
    : t('todayTask.continuePractice')
  const allDone = derivedToday.allAttempted
  const allResolved = derivedToday.allResolved
  const activeDoneCount = activeSteps.filter((s) => activeDoneIds.has(s.id)).length
  const activeTotal = activeSteps.length
  const reviewAllDone = reviewRoundActive && activeTotal > 0 && todayState.retryQueueIds.length === 0
  const passedCount = passedStepIds.size
  const weakCount = derivedToday.redCount
  const unattemptedCount = derivedToday.grayCount
  const needsReviewRound = allDone && weakStepIds.size > 0 && !reviewRoundActive && !reviewDismissed

  // ── 错题重练弹窗：由「一轮练习刚结束」的边沿事件驱动，不再依赖历史状态派生 ──
  // 触发时机与主轮一致，覆盖两种情况：
  //   1) 主轮全部答完（allDone 由 false → true）
  //   2) 退出错题重练轮（roundKind 由 mistakeRetry → main，即关闭练习 dialog）
  // 两者只要还有未掌握的错题就弹出同一个错题重练提示。
  // 重启 / 刷新 / 切换 Tab / 切换模式后不会自动弹出；错题仍可通过页面「练习错题」按钮进入重练。
  const prevAllDoneRef = useRef(allDone)
  const prevRoundKindRef = useRef(todayState.roundKind)
  const lastSeenRunIdRef = useRef<string | null>(null)
  useEffect(() => {
    const runId = plan?.runId ?? null
    const runChanged = runId !== lastSeenRunIdRef.current
    lastSeenRunIdRef.current = runId
    if (runChanged) {
      // 进入新的 run（首次加载 / 重启 / 切模式）：关闭弹窗并重置基线，
      // 绝不把「恢复的历史完成状态」当作本轮刚完成。
      setWeakReviewPromptOpen(false)
      prevAllDoneRef.current = allDone
      prevRoundKindRef.current = todayState.roundKind
      return
    }
    // 主轮刚完成：本 run 内 allDone 由 false → true
    const mainJustFinished = allDone && !prevAllDoneRef.current
    prevAllDoneRef.current = allDone
    // 退出错题重练轮：关闭练习 dialog 会使 roundKind 由 mistakeRetry → main。
    // 此时若仍有未掌握的错题，同样弹出提示，与主轮完成的交互保持一致。
    const retryRoundClosed = prevRoundKindRef.current === 'mistakeRetry' && todayState.roundKind === 'main'
    prevRoundKindRef.current = todayState.roundKind

    if (weakStepIds.size === 0) return
    // 用户已明确「稍后再练」：本轮不再自动弹错题提示（仍可手动从页面进入重练）
    if (reviewDismissed) return
    if (mainJustFinished || retryRoundClosed) {
      setWeakReviewPromptOpen(true)
    }
  }, [allDone, plan?.runId, reviewDismissed, todayState.roundKind, weakStepIds.size])

  const practiceTeachingTopicCandidates = useMemo(() => {
    if (!plan || plan.mode !== 'practice') return []
    const topics = new Map<string, { id: string; title: string }>()
    for (const step of plan.steps) {
      if (topics.has(step.topicId)) continue
      topics.set(step.topicId, { id: step.topicId, title: step.topicTitle })
    }
    return [...topics.values()]
  }, [plan])

  useEffect(() => {
    const missingTopicIds = practiceTeachingTopicCandidates
      .map((topic) => topic.id)
      .filter((topicId) => teachingAvailability[topicId] === undefined)
    if (missingTopicIds.length === 0) return
    let cancelled = false
    void Promise.all(missingTopicIds.map(async (topicId) => {
      const detail = await practiceRepository.getTopicDetail(topicId).catch(() => null)
      return [topicId, Boolean(detail?.topic?.teachingMarkdown?.trim())] as const
    })).then((results) => {
      if (cancelled) return
      setTeachingAvailability((current) => {
        const next = { ...current }
        for (const [topicId, hasTeaching] of results) next[topicId] = hasTeaching
        return next
      })
    })
    return () => { cancelled = true }
  }, [practiceTeachingTopicCandidates, teachingAvailability])

  const practiceTeachingTopics = useMemo(
    () => practiceTeachingTopicCandidates.filter((topic) => teachingAvailability[topic.id]),
    [practiceTeachingTopicCandidates, teachingAvailability],
  )

  const visibleTeachingTopics = showAllTeachingTopics
    ? practiceTeachingTopics
    : practiceTeachingTopics.slice(0, 3)

  const filteredTopics = useMemo(() => {
    if (!plan) return []
    return plan.mode === 'review'
      // 完成后仍保留本轮涉及的话题，让学习者能看到“已完成”的进度，
      // 而不是在最后一道题后把整个区块直接隐藏。
      ? plan.topicStats.filter((topic) => topic.scheduledTodayCount > 0)
      : plan.topicStats
  }, [plan])
  const topicPageItems = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredTopics.length / TOPIC_PAGE_SIZE))
    const currentPage = Math.min(topicPage, totalPages)
    const startIndex = (currentPage - 1) * TOPIC_PAGE_SIZE
    return {
      items: filteredTopics.slice(startIndex, startIndex + TOPIC_PAGE_SIZE),
      startIndex,
      totalPages,
    }
  }, [filteredTopics, topicPage])

  useEffect(() => {
    setTopicPage(1)
  }, [plan?.mode, filteredTopics.length])

  useEffect(() => {
    if (!showTeachingHintIntro || practiceTeachingTopics.length === 0) return
    window.localStorage.setItem(TODAY_TEACHING_HINT_SEEN_KEY, 'true')
    const timer = window.setTimeout(() => setShowTeachingHintIntro(false), 3600)
    return () => window.clearTimeout(timer)
  }, [practiceTeachingTopics.length, showTeachingHintIntro])

  const startWeakReviewRound = useCallback(() => {
    if (weakStepIds.size === 0) return
    // 先关弹窗、先打开练习 dialog，保证「开始错题再练」必定进入练习界面；
    // 其余状态变更用 try/catch 保护，任何异常都不能阻断练习 dialog 打开。
    setWeakReviewPromptOpen(false)
    setDrawerOpen(true)
    try {
      startMistakeRetry()
      setRehearsalAll(false)
      setTypeGroupViewing(false)
      setReviewRunNonce((value) => value + 1)
      for (const stepId of weakStepIds) resetRetryCycleUi(stepId)
      setCurrentIdx(0)
    } catch (error) {
      console.error('[today-task] 启动错题重练失败：', error)
    }
  }, [resetRetryCycleUi, startMistakeRetry, weakStepIds])

  /** 关闭练习抽屉：若正处在重练轮则取消重练并回到主轮（错题池保留），避免卡在 review 状态 */
  const closePracticeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setRehearsalAll(false)
    setTypeGroupViewing(false)
    closeSession()
  }, [closeSession])

  const openTopicTeaching = useCallback(async (topicId: string) => {
    const requestId = teachingRequestIdRef.current + 1
    teachingRequestIdRef.current = requestId
    setTeachingMarkdown('')
    setTeachingLoading(true)
    setTeachingOpen(true)
    try {
      const detail = await practiceRepository.getTopicDetail(topicId)
      if (teachingRequestIdRef.current !== requestId) return
      setTeachingMarkdown(detail?.topic?.teachingMarkdown || '')
    } finally {
      if (teachingRequestIdRef.current === requestId) setTeachingLoading(false)
    }
  }, [])

  // ── 按状态分组统计（用于分段进度条）──
  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, review: 0, new: 0, done: 0 }
    for (const s of steps) {
      if (passedStepIds.has(s.id)) { counts.done++ }
      else if (s.scheduleStatus === 'overdue') { counts.overdue++ }
      else if (s.scheduleStatus === 'review') { counts.review++ }
      else { counts.new++ }
    }
    return counts
  }, [passedStepIds, steps])

  // ── 分段进度条颜色配置 ──
  const SEGMENT_COLORS: Record<string, string> = {
    overdue: 'bg-red-500',
    review: 'bg-amber-500',
    new: 'bg-muted-foreground/45',
    done: 'bg-emerald-500',
  }

  const SegmentedBar = ({ segments, className }: { segments: Array<{ key: string; count: number; color: string }>; className?: string }) => {
    const total = segments.reduce((s, seg) => s + seg.count, 0)
    if (total === 0) return <div className={cn('h-1.5 w-full rounded-full bg-muted', className)} />
    return (
      <div className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
        {segments.filter(s => s.count > 0).map((seg) => (
          <div
            key={seg.key}
            className={cn('h-full transition-all', seg.color)}
            style={{ width: `${(seg.count / total) * 100}%` }}
          />
        ))}
      </div>
    )
  }

  const topSegments = useMemo(() => {
    if (plan?.mode === 'review') {
      return [
        // 完成进度始终从左侧开始，和今日练习保持一致。
        { key: 'done', count: statusCounts.done, color: SEGMENT_COLORS.done },
        { key: 'overdue', count: statusCounts.overdue, color: SEGMENT_COLORS.overdue },
        { key: 'review', count: statusCounts.review, color: SEGMENT_COLORS.review },
        { key: 'new', count: statusCounts.new, color: SEGMENT_COLORS.new },
      ]
    }
    return [
      { key: 'done', count: passedCount, color: 'bg-emerald-500' },
      { key: 'weak', count: weakCount, color: 'bg-red-500/70' },
      { key: 'pending', count: unattemptedCount, color: 'bg-muted-foreground/30' },
    ]
  }, [passedCount, plan?.mode, statusCounts, unattemptedCount, weakCount])
  const practiceOrderLabel = dailyPracticeRandomOrder ? t('todayTask.randomPick') : t('todayTask.sequentialPick')
  const activeModeLabel = plan?.mode === 'review' ? t('todayTask.reviewList') : t('todayTask.practiceGroup')

  // ── 自动提交：当前轮全部完成时持久化记录到本地 + 同步后端 ──
  useEffect(() => {
    if (hasSubmittedToday || submitting || !sessionHydrated || steps.length === 0) return
    const roundDone = reviewRoundActive ? reviewAllDone : (allDone && !needsReviewRound)
    if (!roundDone) return

    const submit = async () => {
      try {
        await submitToday(enrichedWarmupRecords, warmupRecordId)
        console.log('[today-task] ✅ 本组练习已提交 |', activeDoneCount, '题')
        // Preserve the final feedback card, matching the main-practice flow.
        // The learner can close the drawer after reading it.
      } catch (err) {
        console.warn('[today-task] ⚠️ 提交失败，下次刷新后重试:', err)
      }
    }

    submit()
  }, [activeDoneCount, allDone, enrichedWarmupRecords, hasSubmittedToday, needsReviewRound, reviewAllDone, reviewRoundActive, sessionHydrated, steps.length, submitting, warmupRecordId, submitToday])

  const groupedSteps = useMemo<PracticeGroup[]>(() => {
    const order = new Map<string, PracticeGroup>()
    steps.forEach((step, index) => {
      const meta = TYPE_META[step.type] ?? {
        label: step.displayLabel || t('todayTask.knowledgePoint'),
        icon: PenLine,
        color: 'bg-primary/10 text-primary',
      }
      const group = order.get(step.type) ?? {
        type: step.type,
        meta,
        steps: [],
        doneCount: 0,
        totalCount: 0,
      }
      group.steps.push({ step, index })
      group.totalCount += 1
      if (passedStepIds.has(step.id)) group.doneCount += 1
      order.set(step.type, group)
    })
    return Array.from(order.values())
  }, [passedStepIds, steps])

  const playlistGroups = useMemo<PracticeGroup[]>(() => {
    // 抽屉保留全部题目供定位；错题必须以独立状态显示，不能伪装成待练。
    const sourceSteps = activeSteps
    const doneIds = reviewRoundActive ? reviewDoneIds : passedStepIds
    const order = new Map<string, PracticeGroup>()
    sourceSteps.forEach((step, index) => {
      const meta = TYPE_META[step.type] ?? {
        label: step.displayLabel || t('todayTask.knowledgePoint'),
        icon: PenLine,
        color: 'bg-primary/10 text-primary',
      }
      const group = order.get(step.type) ?? {
        type: step.type,
        meta,
        steps: [],
        doneCount: 0,
        totalCount: 0,
      }
      group.steps.push({ step, index })
      group.totalCount += 1
      if (doneIds.has(step.id)) group.doneCount += 1
      order.set(step.type, group)
    })
    return Array.from(order.values())
  }, [activeSteps, passedStepIds, reviewDoneIds, reviewRoundActive, t])

  const openStepAt = useCallback((index: number) => {
    const step = activeSteps[index]
    if (!step) return
    setCurrentIdx(index)
    if (!reviewRoundActive) setRehearsalAll(false)
    if (reviewRoundActive) setMachineCurrentStep(step.id)
    else openMainSession(step.id, { stepIds: activeSteps.map((item) => item.id), includeAttempted: true })
    if (step.id.startsWith('placeholder:')) {
      return
    } else {
      setDrawerOpen(true)
    }
  }, [activeSteps, openMainSession, reviewRoundActive, setMachineCurrentStep])

  /** Open the first unfinished card from a type or topic without relying on a stale list index. */
  const openPendingSteps = useCallback((candidateStepIds: string[]) => {
    const candidateIds = new Set(candidateStepIds)
    if (reviewRoundActive) {
      const nextIndex = activeSteps.findIndex((step) => candidateIds.has(step.id) && !reviewDoneIds.has(step.id))
      if (nextIndex < 0) return
      setCurrentIdx(nextIndex)
      setMachineCurrentStep(activeSteps[nextIndex].id)
      setDrawerOpen(true)
      return
    }

    const nextStep = steps.find((step) => candidateIds.has(step.id) && !attemptedIds.has(step.id))
    if (!nextStep) return
    const pendingIndex = steps.filter((step) => !attemptedIds.has(step.id)).findIndex((step) => step.id === nextStep.id)
    setRehearsalAll(false)
    openMainSession(nextStep.id)
    setCurrentIdx(Math.max(0, pendingIndex))
    setDrawerOpen(true)
  }, [activeSteps, attemptedIds, openMainSession, reviewDoneIds, reviewRoundActive, setMachineCurrentStep, steps])

  const openGroup = useCallback((group: PracticeGroup) => {
    const stepIds = group.steps.map(({ step }) => step.id)
    if (stepIds.length === 0) return
    // Enter the practice dialog with this complete type group. Answered cards
    // stay in the session so its question list can show their results too.
    setRehearsalAll(false)
    setTypeGroupViewing(true)
    openMainSession(stepIds[0], { stepIds, includeAttempted: true })
    setCurrentIdx(0)
    setDrawerOpen(true)
  }, [openMainSession])

  const openTopicPractice = useCallback((topicId: string) => {
    setTypeGroupViewing(false)
    openPendingSteps(steps.filter((step) => step.topicId === topicId).map((step) => step.id))
  }, [openPendingSteps, steps])

  const continueCurrentPractice = useCallback(() => {
    setTypeGroupViewing(false)
    if (reviewRoundActive) {
      const firstPendingIndex = (reviewSteps ?? []).findIndex((step) => !reviewDoneIds.has(step.id))
      if (firstPendingIndex >= 0) {
        setCurrentIdx(firstPendingIndex)
        setDrawerOpen(true)
      }
      return
    }
    if (needsReviewRound) {
      startWeakReviewRound()
      return
    }
    // Do not derive the next card from the previously opened session: that
    // snapshot can still contain an attempted mistake. The main round may
    // open only an item that has never been attempted; mistakes have their
    // own retry entry point above.
    const nextUnattemptedStep = steps.find((step) => !attemptedIds.has(step.id))
    if (!nextUnattemptedStep) return
    setRehearsalAll(false)
    openMainSession(nextUnattemptedStep.id)
    setCurrentIdx(0)
    setDrawerOpen(true)
  }, [attemptedIds, needsReviewRound, openMainSession, reviewDoneIds, reviewRoundActive, reviewSteps, startWeakReviewRound, steps])

  // ── 今日练习记录：recordEntry 置顶（最新在前），历史索引按 updated_at
  // 降序，此处仅去重合并，不再重复排序。
  const todayRecords = useMemo(() => {
    const latestByStep = new Map<string, WarmupRecordEntry>()
    for (const record of [...enrichedWarmupRecords, ...historicalTodayRecords]) {
      const key = record.stepId || `${record.zh}|${record.answer}`
      latestByStep.set(key, record)
    }
    return [...latestByStep.values()]
  }, [enrichedWarmupRecords, historicalTodayRecords])
  // ── 导航 ──
  const currentStep = activeSteps[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < activeSteps.length - 1
  const currentStepDone = currentStep ? activeDoneIds.has(currentStep.id) : false
  const gotoPrev = useCallback(() => setCurrentIdx((p) => {
    const next = Math.max(0, p - 1)
    setMachineCurrentStep(activeSteps[next]?.id ?? null)
    return next
  }), [activeSteps, setMachineCurrentStep])
  const gotoNext = useCallback(() => setCurrentIdx((p) => {
    const next = Math.min(activeSteps.length - 1, p + 1)
    setMachineCurrentStep(activeSteps[next]?.id ?? null)
    return next
  }), [activeSteps, setMachineCurrentStep])

  useEffect(() => {
    if (!todayState.currentStepId) return
    const index = activeSteps.findIndex((step) => step.id === todayState.currentStepId)
    if (index >= 0) setCurrentIdx(index)
  }, [activeSteps, todayState.currentStepId])

  // 队列收缩（题被标记为错题移出「继续练习」）时修正越界索引
  useEffect(() => {
    if (activeSteps.length > 0 && currentIdx >= activeSteps.length) {
      setCurrentIdx(activeSteps.length - 1)
    }
  }, [activeSteps.length, currentIdx])

  useEffect(() => {
    if (!drawerOpen || !autoNextEnabled || !hasNext || !currentStepDone) return
    const timer = window.setTimeout(() => {
      setCurrentIdx((prev) => {
        const next = Math.min(activeSteps.length - 1, prev + 1)
        setMachineCurrentStep(activeSteps[next]?.id ?? null)
        return next
      })
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [activeSteps, autoNextEnabled, currentIdx, currentStepDone, drawerOpen, hasNext, setMachineCurrentStep])

  // ── 加载态：仅在无缓存数据时展示 ──
  if (loading && !plan) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4" data-spotlight="today-overview">
        <div className="rounded-lg bg-muted/30 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {t('todayTask.fetchingPlan')}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {t('todayTask.fetchingPlanHint')}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── 空态 ──
  if (error || (!loading && !plan)) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4" data-spotlight="today-overview">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            {error || t('todayTask.noContent')}
          </p>
          <Button className="mt-4" asChild>
            <Link to="/learning">
              {t('todayTask.choosePack')}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── 当前练习类型信息 ──
  const currentMeta = TYPE_META[currentStep?.type] ?? {
    label: t('todayTask.practiceItem'),
    icon: PenLine,
    color: 'bg-primary/10 text-primary',
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4" data-spotlight="today-overview">
      {/* ── Header ── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {targetPackId && plan.units[0] && (
            <Link
              to="/learning"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-3.5" />
              <span className="truncate">{plan.units[0].title}</span>
            </Link>
          )}
        </div>
        {isMobile && (
          <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45">
            {/* 换一批：暂时隐藏，随机逻辑后续统一在 buildTodayPlan 内调整 */}
            <button
              type="button"
              onClick={(e) => { e.currentTarget.blur(); void syncTodayTask() }}
              disabled={manualSyncing}
              className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="同步今日任务"
              title="同步今日任务"
            >
              <RefreshCw className={cn('size-[17px]', manualSyncing && 'animate-spin')} />
              {hasPendingSync && !manualSyncing && (
                <span className="absolute -right-0.5 -top-0.5">
                  <AlertCircle className="size-3.5 text-amber-500" />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => { e.currentTarget.blur(); setRecordsOpen(true) }}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
              aria-label={t('todayTask.practiceRecords')}
            >
              <ClipboardList className="size-[18px]" />
            </button>
          </div>
        )}
      </div>

      {/* ── 进度条 ── */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => switchPlanMode('review')}
          className={cn(
            'rounded-lg border px-3 py-2.5 text-left transition-colors active:scale-[0.98]',
            plan.mode === 'review'
              ? 'border-amber-400 bg-amber-500/10 text-foreground'
              : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/35',
          )}
        >
          <span className="block text-sm font-semibold">{t('todayTask.todayReview')}</span>
          <span className="mt-0.5 block text-[11px]">
            {t('todayTask.expireOverdue', { count: reviewDebtCount ?? plan.availableReviewCount })}
          </span>
        </button>
        <button
          type="button"
          data-spotlight="today-practice-button"
          onClick={() => switchPlanMode('practice')}
          className={cn(
            'rounded-lg border px-3 py-2.5 text-left transition-colors active:scale-[0.98]',
            plan.mode === 'practice'
              ? 'border-blue-400 bg-blue-500/10 text-foreground'
              : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/35',
          )}
        >
          <span className="block text-sm font-semibold">{t('todayTask.todayPractice')}</span>
          <span className="mt-0.5 block text-[11px]">
            {practiceOrderLabel} {practiceTabAttemptedCount}/{practiceTabTotalCount}
          </span>
        </button>
      </div>

      <div className="mb-5 rounded-lg bg-muted/30 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{activeModeLabel}{t('todayTask.progress')}</p>
            {hasSubmittedToday && allResolved && (
              <Badge variant="default" className="h-5 rounded-full px-2 text-[10px] bg-green-500/15 text-green-600">
                <CheckCircle2 className="mr-0.5 size-3" /> {t('todayTask.completed')}
              </Badge>
            )}
            {submitting && (
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] animate-pulse">
                {t('todayTask.syncing')}
              </Badge>
            )}
            {targetDate && (
              <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                {t('todayTask.testDate')} {plan.date}
              </Badge>
            )}
          </div>
          <Badge variant="secondary" className="h-6 shrink-0 rounded-full px-2 text-[10px]">
            {attemptedCount}/{plan.scheduledItemIds.length} {t('todayTask.questions')}
          </Badge>
        </div>
        <SegmentedBar segments={topSegments} />
          <div className="mt-3 flex items-stretch gap-2">
            {!hasPracticeSteps ? (
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-left text-muted-foreground"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{isReviewMode ? t('todayTask.noReviewToday') : t('todayTask.noPractice')}</span>
              </button>
            ) : (
              <>
                {/* 重练进行中：继续重练 */}
                {reviewRoundActive && (
                  <button
                    type="button"
                    onClick={continueCurrentPractice}
                    className="flex w-full items-center justify-between gap-3 rounded-md bg-primary/[0.06] px-3 py-2 text-left text-primary transition-colors active:scale-[0.99] hover:bg-primary/[0.1]"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{isReviewMode ? t('todayTask.continueReview') : t('todayTask.continuePractice')}</span>
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-primary hover:bg-primary/10">
                      <ArrowRight className="size-4" />
                    </span>
                  </button>
                )}
                {/* 主轮未完成：继续练习 */}
                {!reviewRoundActive && !allDone && (
                  <button
                    type="button"
                    onClick={continueCurrentPractice}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md bg-primary/[0.06] px-3 py-2 text-left text-primary transition-colors active:scale-[0.99] hover:bg-primary/[0.1]"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{mainActionLabel}</span>
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-primary hover:bg-primary/10">
                      <ArrowRight className="size-4" />
                    </span>
                  </button>
                )}
                {/* 全完成无错题：重新练习 */}
                {!reviewRoundActive && allDone && weakStepIds.size === 0 && (
                  <button
                    type="button"
                    onClick={startRePractice}
                    className="flex w-full items-center justify-between gap-3 rounded-md bg-emerald-500/[0.08] px-3 py-2 text-left text-emerald-700 transition-colors active:scale-[0.99] hover:bg-emerald-500/[0.12] dark:text-emerald-300"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{isReviewMode ? t('todayTask.reviewAgain') : t('todayTask.rePractice')}</span>
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
                      <CheckCircle2 className="size-4" />
                    </span>
                  </button>
                )}
                {/* 有错题：练习错题（未完成时与继续练习各半，全完成时占满） */}
                {!reviewRoundActive && weakStepIds.size > 0 && (
                  <button
                    type="button"
                    onClick={startWeakReviewRound}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md bg-red-500/[0.08] px-3 py-2 text-left text-red-600 transition-colors active:scale-[0.99] hover:bg-red-500/[0.12] dark:text-red-400"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{isReviewMode ? t('todayTask.reviewWrong', { count: weakStepIds.size }) : t('todayTask.practiceWrong', { count: weakStepIds.size })}</span>
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">
                      <ArrowRight className="size-4" />
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
          {!isReviewMode && allDone && weakStepIds.size === 0 && !reviewRoundActive && (
            <button
              type="button"
              onClick={startNewPracticeSet}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 active:scale-[0.99]"
            >
              {dailyPracticeRandomOrder ? t('todayTask.randomAgain') : t('todayTask.practiceAgain')}
              <ArrowRight className="size-3.5" />
            </button>
          )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          {plan.mode === 'review' ? (
            <>
              {statusCounts.done > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500" />{t('todayTask.done', { count: statusCounts.done })}</span>}
              {statusCounts.overdue > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-red-500" />{t('todayTask.overdue', { count: statusCounts.overdue })}</span>}
              {statusCounts.review > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-amber-500" />{t('todayTask.review', { count: statusCounts.review })}</span>}
              {statusCounts.new > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/45" />{t('todayTask.newPractice', { count: statusCounts.new })}</span>}
              {statusCounts.done === 0 && statusCounts.overdue === 0 && statusCounts.review === 0 && statusCounts.new === 0 && (
                <span className="text-muted-foreground/50">{t('todayTask.noReviewToday')}</span>
              )}
            </>
          ) : (
            <>
              {passedCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500" />{t('todayTask.done', { count: passedCount })}</span>}
              {weakCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-red-500/70" />{t('todayTask.practiceWrong', { count: weakCount })}</span>}
              {unattemptedCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/45" />{t('todayTask.unattempted', { count: unattemptedCount })}</span>}
              {passedCount === 0 && weakCount === 0 && unattemptedCount === 0 && (
                <span className="text-muted-foreground/50">{t('todayTask.noPractice')}</span>
              )}
            </>
          )}
        </div>
        {plan.mode === 'practice' && practiceTeachingTopics.length > 0 && (
          <section className="mt-3 border-t border-border/45 pt-2.5" aria-label={t('todayTask.teachingSectionAria')}>
            <p className="text-[10px] leading-4 text-muted-foreground">
              {showTeachingHintIntro ? t('todayTask.teachingHintIntro') : t('todayTask.teachingHint')}
            </p>
            <div className="mt-1.5 flex min-w-0 gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              {visibleTeachingTopics.map((topic, index) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => { void openTopicTeaching(topic.id) }}
                  className={cn(
                    'inline-flex h-8 max-w-[12.5rem] shrink-0 items-center rounded-lg bg-primary/[0.08] px-3 text-[11px] font-medium text-primary transition-colors hover:bg-primary/[0.14] active:scale-[0.98]',
                    showTeachingHintIntro && index === 0 && 'animate-pulse ring-1 ring-primary/20 motion-reduce:animate-none',
                  )}
                  title={topic.title}
                >
                  <span className="truncate">{topic.title}</span>
                </button>
              ))}
              {practiceTeachingTopics.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllTeachingTopics((visible) => !visible)}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg bg-muted/70 px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted active:scale-[0.98]"
                  title={practiceTeachingTopics.slice(3).map((topic) => topic.title).join('、')}
                >
                  {showAllTeachingTopics
                    ? t('todayTask.collapseTopics')
                    : t('todayTask.moreTeachingTopics', { count: practiceTeachingTopics.length - 3 })}
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── 练习卡片列表 ── */}
      {steps.length === 0 && (
        <div className="mb-5 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
          <Target className="mx-auto size-9 text-muted-foreground/35" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {plan.mode === 'review' ? t('todayTask.noReviewToday') : t('todayTask.noRandomContent')}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {plan.mode === 'review'
              ? t('todayTask.switchToPractice', { modeName: dailyPracticeRandomOrder ? t('todayTask.randomPick') : t('todayTask.sequentialPick') })
              : t('todayTask.downloadOrSelect')}
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {groupedSteps.map((group) => {
          const Icon = group.meta.icon
          const isDone = group.doneCount === group.totalCount
          const examples = group.steps
            .map(({ step }) => step.headerContent || step.label)
            .filter(Boolean)
            .slice(0, 3)

          return (
            <Card
              key={group.type}
              className={cn(
                'cursor-pointer border-0 bg-muted/30 shadow-none transition-all active:scale-[0.98]',
                isDone && 'opacity-60',
              )}
              onClick={() => openGroup(group)}
            >
              <CardContent className="flex items-start gap-3 p-3.5">
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', group.meta.color)}>
                  {isDone ? <CheckCircle2 className="size-5 text-green-500" /> : <Icon className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className={cn('truncate text-sm font-semibold', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {group.meta.label}
                    </p>
                    <Badge variant={isDone ? 'default' : 'secondary'} className="h-5 shrink-0 rounded-full px-2 text-[10px]">
                      {group.doneCount}/{group.totalCount}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {examples.join(' · ') || `${group.totalCount} ${t('todayTask.exercises')}`}
                  </p>
                  {group.totalCount > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.steps.slice(0, 4).map(({ step }, itemIndex) => (
                        <span
                          key={step.id}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px]',
                            passedStepIds.has(step.id)
                              ? 'bg-green-500/10 text-green-600 dark:text-green-300'
                              : weakStepIds.has(step.id)
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-background/70 text-muted-foreground',
                          )}
                        >
                          {itemIndex + 1}
                        </span>
                      ))}
                      {group.totalCount > 4 && (
                        <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                          +{group.totalCount - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground/60" />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── 今日话题快捷入口（按当前模式过滤）── */}
      {filteredTopics.length > 0 && (() => {
        const isReviewMode = plan.mode === 'review'
        const displayedTopics = topicsExpanded ? topicPageItems.items : filteredTopics.slice(0, 3)

        return (
          <>
            <Separator className="my-6" />
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {isReviewMode ? t('todayTask.topicsToReview') : t('todayTask.currentTopics')}
                  </h2>
                  <span className="truncate text-xs text-muted-foreground">
                    {isReviewMode ? t('todayTask.topicsWithReviewItems', { count: filteredTopics.length }) : t('todayTask.topicsCount', { count: filteredTopics.length })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTopicsExpanded((expanded) => !expanded)
                    setTopicPage(1)
                  }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  aria-label={topicsExpanded ? t('common.collapse') : t('common.expand')}
                >
                  <ChevronDown className={cn('size-4 transition-transform duration-200', !topicsExpanded && '-rotate-90')} />
                </button>
              </div>
              <div className="space-y-1.5">
                {displayedTopics.map((topic, index) => {
                  const absoluteIndex = topicsExpanded ? topicPageItems.startIndex + index : index
                  const detail = isReviewMode
                    ? [
                        topic.overdueCount > 0 ? `${t('todayTask.statusOverdue')} ${topic.overdueCount}` : null,
                        topic.todayReviewCount > 0 ? `${t('todayTask.statusReview')} ${topic.todayReviewCount}` : null,
                        topic.todayNewCount > 0 ? `${t('todayTask.statusNew')} ${topic.todayNewCount}` : null,
                      ].filter(Boolean).join(' · ')
                    : null
                  const unPracticed = topic.totalCount - topic.practicedCount
                  const assetSummary = [
                    topic.vocabCount > 0 ? `${topic.vocabCount} ${t('learning.vocab')}` : null,
                    topic.chunkCount > 0 ? `${topic.chunkCount} ${t('learning.chunks')}` : null,
                    topic.patternCount > 0 ? `${topic.patternCount} ${t('learning.patterns')}` : null,
                  ].filter(Boolean).join(' · ')
                  return (
                    <div key={topic.topicId} className="group flex overflow-hidden rounded-lg bg-muted/25 transition-colors hover:bg-muted/50">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => { void openTopicTeaching(topic.topicId) }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void openTopicTeaching(topic.topicId)
                          }
                        }}
                        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-3 py-3 active:scale-[0.99]"
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {absoluteIndex + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="line-clamp-1 flex-1 text-sm font-medium text-foreground">{topic.topicTitle}</p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {assetSummary || `${topic.totalCount} ${t('todayTask.exercises')}`}{detail ? ` · ${detail}` : ''}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <SegmentedBar
                            segments={isReviewMode
                              ? [
                                  { key: 'done', count: topic.doneTodayCount, color: SEGMENT_COLORS.done },
                                  { key: 'overdue', count: topic.overdueCount, color: SEGMENT_COLORS.overdue },
                                  { key: 'review', count: topic.todayReviewCount, color: SEGMENT_COLORS.review },
                                  { key: 'new', count: topic.todayNewCount, color: SEGMENT_COLORS.new },
                                ]
                              : [
                                  { key: 'done', count: topic.practicedCount, color: 'bg-emerald-500' },
                                  { key: 'pending', count: unPracticed, color: 'bg-muted-foreground/30' },
                                ]
                            }
                          />
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {isReviewMode
                              ? t('todayTask.notReviewed', { count: topic.overdueCount + topic.todayReviewCount })
                              : t('todayTask.practiced', { done: topic.practicedCount, total: topic.totalCount })
                            }
                          </span>
                        </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTopicPractice(topic.topicId)}
                        className="flex w-10 shrink-0 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground"
                        aria-label={`${topic.topicTitle} ${t('todayTask.practice')}`}
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
              {filteredTopics.length > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setTopicsExpanded((expanded) => !expanded)
                    setTopicPage(1)
                  }}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <ChevronDown className={cn('size-3.5 transition-transform duration-200', topicsExpanded && 'rotate-180')} />
                  {topicsExpanded ? t('common.collapse') : t('common.expand')}
                </button>
              )}
              {topicsExpanded && topicPageItems.totalPages > 1 && (
                <div className="mt-1 flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">
                    {t('common.total')} {filteredTopics.length} {t('learning.items')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={topicPage <= 1} onClick={() => setTopicPage((page) => page - 1)}>
                      {t('common.prevPage')}
                    </Button>
                    <span className="min-w-10 text-center text-[11px] text-muted-foreground">{topicPage}/{topicPageItems.totalPages}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={topicPage >= topicPageItems.totalPages} onClick={() => setTopicPage((page) => page + 1)}>
                      {t('common.nextPage')}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </>
        )
      })()}

      {/* ── 练习 Dialog（与 LearningInsightDialog 完全统一）── */}
      <PracticeVnDrawer
        open={teachingOpen}
        onOpenChange={setTeachingOpen}
        teachingMarkdown={teachingMarkdown}
        loading={teachingLoading}
        hideToggles
      />

      <Dialog
        open={drawerOpen}
        onOpenChange={(open) => { if (!open) closePracticeDrawer() }}
      >
        <DialogContent
          data-keyboard-overlay="practice"
          className="left-0 top-0 !z-[10000] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 pt-safe md:left-[50%] md:top-[50%] md:h-[88vh] md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-2xl md:pt-0 [&>button]:hidden"
        >
          <DialogTitle className="sr-only">
            {currentStep?.displayLabel || currentMeta.label} · {currentStep?.topicTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {currentStep?.label}
          </DialogDescription>

          <div className="flex min-h-0 flex-1 flex-col">
            {/* Header：Badge 标识题型，大字展示练习内容 */}
            <div data-keyboard-practice-header className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {(() => { const Icon = currentMeta.icon; return <Icon className="size-[18px]" /> })()}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <Badge variant="secondary" className="min-w-0 max-w-[45%] truncate">{currentMeta.label}</Badge>
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/70">
                        <span>{t('todayTask.autoNext')}</span>
                        <Switch
                          checked={autoNextEnabled}
                          onCheckedChange={setAutoNextEnabled}
                          disabled={activeTotal <= 1}
                          className="origin-right scale-90"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={closePracticeDrawer}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div data-keyboard-practice-title className="min-w-0">
                    <h2 className="line-clamp-2 break-words text-lg font-bold leading-snug text-foreground">
                      {currentStep?.headerContent || currentStep?.label}
                    </h2>
                    <p className="mt-1 line-clamp-1 break-words text-sm leading-relaxed text-muted-foreground">
                      {currentStep?.topicTitle}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 md:px-6">
              <div key={`${currentStep?.id}:${reviewRunNonce}:${currentStep ? (todayState.retryCycles[currentStep.id]?.cycle ?? 0) : 0}`}>
                {currentStep?.render()}
              </div>
            </div>

            {/* Bottom nav */}
            <div data-keyboard-practice-footer className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
              <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
                <ChevronLeft className="size-4" />
                <span className="ml-1">{t('todayTask.prevQuestion')}</span>
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentIdx + 1} / {activeTotal}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
                  <span className="mr-1">{t('todayTask.nextQuestion')}</span>
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(event) => {
                    event.currentTarget.blur()
                    setPlaylistOpen(true)
                  }}
                  title={t('todayTask.questionList')}
                >
                  <ListMusic className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 题目列表 Drawer ── */}
      <Drawer open={playlistOpen} onOpenChange={setPlaylistOpen}>
        <DrawerContent className="h-[100dvh] rounded-none pt-safe !z-[10001]" overlayClassName="!z-[10001]">
          <div className="flex items-center justify-between px-5 py-3">
            <DrawerTitle className="text-lg">{plan.mode === 'review' ? t('todayTask.todayReviewQuestions') : t('todayTask.todayPracticeQuestions')}</DrawerTitle>
            <button
              type="button"
              onClick={() => setPlaylistOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-4 pb-8">
            <div className="space-y-5">
              {playlistGroups.map((group) => {
                const Icon = group.meta.icon
                return (
                  <section
                    key={group.type}
                    className="space-y-1"
                  >
                    <div className="flex items-center gap-2 px-2.5 pb-1 pt-0.5 text-muted-foreground">
                      <Icon className="size-4 shrink-0" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{group.meta.label}</p>
                      <span className="shrink-0 text-xs tabular-nums">{group.doneCount}/{group.totalCount}</span>
                    </div>
                    {group.steps.map(({ step, index }) => {
                      const isCurrent = index === currentIdx
                      const isDone = (reviewRoundActive ? reviewDoneIds : passedStepIds).has(step.id)
                      const isWrong = !isDone && weakStepIds.has(step.id)
                      const statusLabel = isCurrent
                        ? t('todayTask.current')
                        : isDone
                          ? t('todayTask.completed')
                          : isWrong
                            ? t('todayTask.wrongItem')
                            : t('todayTask.pendingItems')
                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => { openStepAt(index); setPlaylistOpen(false) }}
                          className={cn(
                            'grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                            isCurrent ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                          )}
                        >
                          <span className={cn(
                            'flex size-5 items-center justify-center rounded-full text-[10px] font-medium',
                            isCurrent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                          )}>
                            {index + 1}
                          </span>
                          <span className="line-clamp-2 min-w-0 break-words leading-5">
                            {step.headerContent || step.label}
                          </span>
                          <span className={cn(
                            'max-w-[4.5rem] shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] font-medium',
                            isCurrent ? 'bg-primary/15 text-primary' : isDone ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : isWrong ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-muted text-muted-foreground',
                          )}>
                            {statusLabel}
                          </span>
                        </button>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* ── 练习记录 Drawer ── */}
      <Dialog
        open={weakReviewPromptOpen}
        onOpenChange={(open) => {
          if (!open) setWeakReviewPromptOpen(false)
        }}
      >
        <DialogContent className="!z-[10002] w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-5">
          <DialogTitle className="text-base">{t('todayTask.needReviewTitle', { count: weakStepIds.size })}</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {t('todayTask.needReviewDesc')}
          </DialogDescription>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-2">
            {weakRecords.slice(0, 5).map((record) => {
              const step = steps.find((item) => item.id === record.stepId)
              return (
                <div key={record.stepId} className="border-b border-border/50 px-1 py-2.5 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={record.score === 'miss' ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">
                      {record.score === 'miss' ? t('todayTask.unknownWord') : t('todayTask.pendingStable')}
                    </Badge>
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {step?.displayLabel || t('todayTask.practice')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-foreground">{record.zh}</p>
                </div>
              )
            })}
            {weakRecords.length > 5 && (
              <p className="px-1 text-[11px] text-muted-foreground">{t('todayTask.willReviewTogether', { count: weakRecords.length - 5 })}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                // 「稍后再练」：关闭弹窗并标记 dismiss，让本轮主轮记录得以提交；
                // 错题保留，随时可从页面「练习错题」按钮进入重练。
                setWeakReviewPromptOpen(false)
                dismissReviewRound()
              }}
            >
              {t('todayTask.later')}
            </Button>
            <Button className="flex-1" onClick={startWeakReviewRound}>
              {t('todayTask.startWrongReview')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 同步发现今日任务更新 → 询问是否立即刷新 ── */}
      <Dialog open={showTodayUpdateDialog} onOpenChange={setShowTodayUpdateDialog}>
        <DialogContent className="!z-[10002] w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-5">
          <DialogTitle className="text-base">{t('todayTask.todayUpdateTitle')}</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-5">
            {t('todayTask.todayUpdateDesc')}
          </DialogDescription>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowTodayUpdateDialog(false)}>
              {t('todayTask.todayUpdateLater')}
            </Button>
            <Button className="flex-1" onClick={applyTodayUpdate}>
              {t('todayTask.todayUpdateNow')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TodayRecordsDrawer
        open={recordsOpen}
        onOpenChange={setRecordsOpen}
        records={todayRecords}
        steps={steps}
      />
    </div>
  )
}

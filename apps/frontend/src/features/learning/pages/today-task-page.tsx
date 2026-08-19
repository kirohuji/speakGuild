import { useEffect, useMemo, useRef, useState, useCallback, useReducer } from 'react'
import type React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, Blocks, Braces, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, ListChecks, ListMusic, PenLine, Replace, Split, Target,
  CheckCircle2, Loader2,
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
import { useWarmupSessionStore, type WarmupRecordEntry, type WarmupScore } from '@/stores/warmup-session.store'
import { useDailyPracticeStore } from '@/stores/daily-practice.store'
import type { DailyPracticePlanMode, DailyPracticeStatus } from '@/lib/offline/daily-practice.repository'
import { TodayRecordsDrawer } from '../components/today-records-drawer'
import { PracticeVnDrawer } from '@/features/practice/components/practice-vn-drawer'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { preloadWarmupLocalJudge, type WarmupReferencePreloadInput } from '@/lib/local-ai/warmup-local-judge'
import { useAuth } from '@/providers/auth-provider'
import { toast } from 'sonner'
import { practiceRepository } from '@/lib/offline'
import { useEffectivePracticeTimer } from '@/hooks/use-effective-practice-timer'
import { useIsMobile } from '@/hooks/use-mobile'

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
const TOPIC_PAGE_SIZE = 8

function normalizePlanMode(mode: string | null): DailyPracticePlanMode {
  return mode === 'review' || mode === 'practice' ? mode : 'practice'
}

function getSessionPlanMode(): DailyPracticePlanMode {
  if (typeof window === 'undefined') return 'practice'
  return normalizePlanMode(window.sessionStorage.getItem(TODAY_TASK_MODE_SESSION_KEY))
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

// ── round 状态机（主轮 + 重练轮）──
type RoundKind = 'main' | 'review'

interface RoundState {
  kind: RoundKind
  /** 主轮：已练集合（含错题，用于轮次完成判定与重访恢复） */
  attemptedIds: Set<string>
  /** 重练轮：待重练的 id 集合（kind=review 时有效） */
  reviewPendingIds: Set<string>
  /** 重练轮：已通过的 id 集合 */
  reviewDoneIds: Set<string>
  /** 轮次序号：决定 warmupRecordId；「下一组/重新练习/模式切换」+1 */
  roundNonce: number
  /** 错题弹窗「稍后再练」标记 */
  reviewDismissed: boolean
}

type RoundAction =
  | { type: 'initMain'; attemptedIds: string[] }
  | { type: 'completeStep'; stepId: string; passed: boolean }
  | { type: 'startReview'; weakIds: string[] }
  | { type: 'finishReview' }
  | { type: 'dismissReview' }
  | { type: 'resetRound'; roundNonce: number }

const initialRound: RoundState = {
  kind: 'main',
  attemptedIds: new Set(),
  reviewPendingIds: new Set(),
  reviewDoneIds: new Set(),
  roundNonce: 0,
  reviewDismissed: false,
}

function roundReducer(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'initMain':
      return {
        ...state,
        kind: 'main',
        attemptedIds: new Set(action.attemptedIds),
        reviewPendingIds: new Set(),
        reviewDoneIds: new Set(),
        reviewDismissed: false,
      }
    case 'completeStep': {
      if (state.kind === 'review') {
        // 重练轮：答对才计入完成
        if (!action.passed) return state
        const reviewDoneIds = new Set(state.reviewDoneIds)
        reviewDoneIds.add(action.stepId)
        return { ...state, reviewDoneIds }
      }
      // 主轮：答对/答错/我不会都算已练（保证轮次可完成），通过与否由 records 派生
      const attemptedIds = new Set(state.attemptedIds)
      attemptedIds.add(action.stepId)
      return { ...state, attemptedIds }
    }
    case 'startReview':
      return {
        ...state,
        kind: 'review',
        reviewPendingIds: new Set(action.weakIds),
        reviewDoneIds: new Set(),
        reviewDismissed: false,
      }
    case 'finishReview':
      return {
        ...state,
        kind: 'main',
        reviewPendingIds: new Set(),
        reviewDoneIds: new Set(),
        reviewDismissed: true,
      }
    case 'dismissReview':
      return { ...state, reviewDismissed: true }
    case 'resetRound':
      return {
        kind: 'main',
        attemptedIds: new Set(),
        reviewPendingIds: new Set(),
        reviewDoneIds: new Set(),
        roundNonce: action.roundNonce,
        reviewDismissed: false,
      }
  }
}

// ── 组件 ──
export function TodayTaskPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const isMobile = useIsMobile()
  const onboardingCompletedSegments = useOnboardingStore((state) => state.completedSegments)
  const isAdmin = session?.user?.role === 'admin'
  const TYPE_META = useTypeMeta(t)
  const warmupStore = useWarmupSessionStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const targetPackId = searchParams.get('packId') || null
  const targetDate = searchParams.get('date') || null
  const plan = useDailyPracticeStore((s) => s.plan)
  const loading = useDailyPracticeStore((s) => s.loading)
  const error = useDailyPracticeStore((s) => s.error)
  const submitting = useDailyPracticeStore((s) => s.submitting)
  const loadToday = useDailyPracticeStore((s) => s.loadToday)
  const completeStep = useDailyPracticeStore((s) => s.completeStep)
  const submitToday = useDailyPracticeStore((s) => s.submitToday)
  const dailyGoal = usePreferencesStore((s) => s.dailyGoal)
  const dailyPracticeRandomOrder = usePreferencesStore((s) => s.dailyPracticeRandomOrder)
  const localAiWarmupJudgeEnabled = usePreferencesStore((s) => s.localAiWarmupJudgeEnabled)

  // 练习状态
  const hydrateWarmupSession = useWarmupSessionStore((s) => s.hydrateSession)
  const hydrateHistoricalStepStates = useWarmupSessionStore((s) => s.hydrateHistoricalStepStates)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
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
  const [round, dispatchRound] = useReducer(roundReducer, initialRound)
  const [reviewRunNonce, setReviewRunNonce] = useState(0)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false)
  const reviewRoundActive = round.kind === 'review'
  const attemptedIds = round.attemptedIds
  const reviewPendingIds = round.reviewPendingIds
  const reviewDoneIds = round.reviewDoneIds
  const roundNonce = round.roundNonce
  const reviewDismissed = round.reviewDismissed
  const localAiPreloadKeyRef = useRef<string | null>(null)
  const warmupSessionHydratedKeyRef = useRef<string | null>(null)
  const teachingRequestIdRef = useRef(0)
  const planMode = searchParams.has('mode') ? normalizePlanMode(searchParams.get('mode')) : getSessionPlanMode()
  const [planRunSeed, setPlanRunSeed] = useState(0)
  useEffectivePracticeTimer({
    enabled: drawerOpen && Boolean(plan?.date),
    sourceId: plan?.date ? `daily:${plan.date}` : null,
    scope: 'daily',
    questionCount: attemptedIds.size,
  })
  const currentPlanReusable = Boolean(
    plan &&
    planRunSeed === 0 &&
    plan.dailyGoal === dailyGoal &&
    plan.mode === planMode &&
    (!targetDate || plan.date === targetDate) &&
    (!targetPackId || plan.units.some((unit) => unit.id === targetPackId)),
  )

  useEffect(() => {
    if (currentPlanReusable) return
    warmupStore.clearSession()
    setHasSubmittedToday(false)
    setSessionHydrated(false)
    setReviewRunNonce(0)
    let cancelled = false
    loadToday(targetPackId, targetDate, planMode, planRunSeed > 0)
      .then(() => {
        if (cancelled) return
        // 用 store 最新 plan 初始化主轮已练集合（闭包里的 plan 是旧的）
        dispatchRound({
          type: 'initMain',
          attemptedIds: useDailyPracticeStore.getState().plan?.completedItemIds ?? [],
        })
      })
    return () => { cancelled = true }
  }, [currentPlanReusable, dispatchRound, loadToday, targetPackId, targetDate, planMode, planRunSeed])

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

  const markDone = useCallback(async (stepId: string, score: WarmupScore = 'strong', passed = true) => {
    // 只有通过（strong/ok/weak）才写 SM-2 进度；答错/我不会不消耗新题池（重新练习会再遇到）
    if (passed) {
      const source = plan?.steps.find((step) => step.itemId === stepId)
      if (source) await completeStep(source, score)
    }
    dispatchRound({ type: 'completeStep', stepId, passed })
  }, [completeStep, dispatchRound, plan?.steps])

  const switchPlanMode = useCallback((nextMode: DailyPracticePlanMode) => {
    if (nextMode === plan?.mode) return
    window.sessionStorage.setItem(TODAY_TASK_MODE_SESSION_KEY, nextMode)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('mode', nextMode)
      return next
    })
    dispatchRound({ type: 'resetRound', roundNonce: roundNonce + 1 })
    setPlanRunSeed(0)
    setCurrentIdx(0)
    setSessionHydrated(false)
    setDrawerOpen(false)
    setPlaylistOpen(false)
    setRecordsOpen(false)
    setReviewRunNonce(0)
    setHasSubmittedToday(false)
    warmupStore.clearSession()
  }, [dispatchRound, plan?.mode, roundNonce, setSearchParams, warmupStore])

  const startNewPracticeSet = useCallback(() => {
    dispatchRound({ type: 'resetRound', roundNonce: roundNonce + 1 })
    setPlanRunSeed(Date.now())
    setCurrentIdx(0)
    setSessionHydrated(false)
    setDrawerOpen(false)
    setPlaylistOpen(false)
    setRecordsOpen(false)
    setReviewRunNonce(0)
    setHasSubmittedToday(false)
    warmupStore.clearSession()
  }, [dispatchRound, roundNonce, warmupStore])

  const startRePractice = useCallback(() => {
    dispatchRound({ type: 'resetRound', roundNonce: roundNonce + 1 })
    setCurrentIdx(0)
    setSessionHydrated(false)
    setDrawerOpen(false)
    setPlaylistOpen(false)
    setRecordsOpen(false)
    setReviewRunNonce(0)
    setHasSubmittedToday(false)
    warmupStore.clearSession()
  }, [dispatchRound, roundNonce, warmupStore])

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
        topicTitle: source.topicTitle,
        scheduleStatus: source.scheduleStatus,
      }

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
                disableSkip={reviewRoundActive}
                onComplete={(_idx, passed, score) => { if (reviewRoundActive && !passed) return; void markDone(sid, score, passed) }}
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
                disableSkip={reviewRoundActive}
                onComplete={(_idx, passed, score) => { if (reviewRoundActive && !passed) return; void markDone(sid, score, passed) }}
                hideHeader
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
                disableSkip={reviewRoundActive}
                onComplete={(_idx, passed, score) => { if (reviewRoundActive && !passed) return; void markDone(sid, score, passed) }}
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
                disableSkip={reviewRoundActive}
                onComplete={(_idx, passed, score) => { if (reviewRoundActive && !passed) return; void markDone(sid, score, passed) }}
                hideHeader
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
                onComplete={(_passed, score) => { void markDone(sid, score) }}
                hideHeader
              />
            ),
        }
      })
  }, [markDone, plan?.steps, reviewRoundActive])

  // 重练轮由待重练 id 集合派生（保证 render 闭包基于最新 reviewRoundActive）
  const reviewSteps = useMemo<PracticeItem[] | null>(() => {
    if (!reviewRoundActive || reviewPendingIds.size === 0) return null
    return steps.filter((step) => reviewPendingIds.has(step.id))
  }, [reviewPendingIds, reviewRoundActive, steps])
  // 通过集合（绿）由 records 派生；待练（红）与未练（灰）同理
  const passedStepIds = useMemo(() => {
    const set = new Set<string>()
    for (const record of warmupStore.records) if (record.passed) set.add(record.stepId)
    return set
  }, [warmupStore.records])
  // 错题池（我不会/答错）：records 中 score 为 weak/miss
  const weakRecords = useMemo(
    () => warmupStore.records.filter((record) => record.score === 'weak' || record.score === 'miss'),
    [warmupStore.records],
  )
  const weakStepIds = useMemo(() => new Set(weakRecords.map((record) => record.stepId)), [weakRecords])
  // 主轮「继续练习」队列：排除错题（错题只通过「练习错题」重练）
  const mainQueue = useMemo(() => steps.filter((s) => !weakStepIds.has(s.id)), [steps, weakStepIds])
  const activeSteps = reviewRoundActive && reviewSteps ? reviewSteps : mainQueue
  const activeDoneIds = reviewRoundActive ? reviewDoneIds : passedStepIds
  // 续练定位：主轮用「已练」（含错题，下一个未练开始），重练轮用 reviewDoneIds
  const resumeDoneIds = reviewRoundActive ? reviewDoneIds : attemptedIds

  const warmupRecordId = useMemo(() => {
    if (!plan || plan.scheduledItemIds.length === 0) return null
    const scope = plan.units.map((unit) => unit.id).join(',') || 'mixed'
    return `today-warmup:${plan.date}:${plan.mode}:${scope}:${roundNonce || 'current'}:${plan.scheduledItemIds.join('|')}`
  }, [plan, roundNonce])

  useEffect(() => {
    if (!warmupRecordId || steps.length === 0) return
    if (warmupSessionHydratedKeyRef.current === warmupRecordId) return
    warmupSessionHydratedKeyRef.current = warmupRecordId
    let cancelled = false
    const markHydrated = () => { if (!cancelled) setSessionHydrated(true) }
    void practiceRepository.getLocalWarmupRecord(warmupRecordId).then((record) => {
      if (cancelled) return
      // 已提交过的轮次：重访不重复提交（防后端重复建 practiceWarmupRecord + 打卡翻倍）
      const stored = record as ({ items?: WarmupRecordEntry[]; syncStatus?: string } | null)
      if (stored?.syncStatus === 'synced' && Array.isArray(stored?.items) && (stored.items?.length ?? 0) > 0) {
        setHasSubmittedToday(true)
      }
      const rawRecords = record?.items ?? []
      const stepIds = new Set(steps.map((step) => step.id))
      const currentRecords = Array.isArray(rawRecords) ? (rawRecords as WarmupRecordEntry[])
        .filter((record) => stepIds.has(record.stepId))
        : []
      if (currentRecords.length > 0) hydrateWarmupSession(currentRecords)
      const missingStepIds = steps
        .map((step) => step.id)
        .filter((stepId) => !currentRecords.some((record) => record.stepId === stepId))
      if (missingStepIds.length === 0) { markHydrated(); return }
      void practiceRepository.getLatestWarmupEntriesByStepIds(missingStepIds, warmupRecordId).then((records) => {
        if (!cancelled && records.length > 0) hydrateHistoricalStepStates(records)
        markHydrated()
      })
    }).catch(() => markHydrated())
    return () => { cancelled = true }
  }, [hydrateHistoricalStepStates, hydrateWarmupSession, steps, warmupRecordId])

  const enrichedWarmupRecords = useMemo(() => {
    const stepById = new Map(steps.map((step) => [step.id, step]))
    return warmupStore.records.map((record) => {
      const step = stepById.get(record.stepId)
      return {
        ...record,
        displayLabel: record.displayLabel ?? step?.displayLabel,
        topicTitle: record.topicTitle ?? step?.topicTitle,
      }
    })
  }, [steps, warmupStore.records])

  useEffect(() => {
    if (!warmupRecordId || !plan || enrichedWarmupRecords.length === 0) return
    // 已提交且不在重练中 → 不再把 synced 改回 pending
    if (hasSubmittedToday && !reviewRoundActive) return
    const firstTopic = plan.topicStats.find((topic) => topic.scheduledTodayCount > 0) ?? plan.topicStats[0]
    if (!firstTopic) return
    void practiceRepository.upsertLocalWarmupRecord({
      id: warmupRecordId,
      topicId: firstTopic.topicId,
      topicTitle: firstTopic.topicTitle,
      items: enrichedWarmupRecords,
      syncStatus: 'pending',
    }).catch(() => undefined)
  }, [enrichedWarmupRecords, hasSubmittedToday, plan, reviewRoundActive, warmupRecordId])

  useEffect(() => {
    if (!recordsOpen || !plan?.date) return
    let cancelled = false
    void practiceRepository.getWarmupEntriesByDate(plan.date).then((records) => {
      if (!cancelled) setHistoricalTodayRecords(records)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [recordsOpen, plan?.date, warmupStore.records])

  // ── 进度统计 ──
  const attemptedCount = steps.filter((s) => attemptedIds.has(s.id)).length
  const hasPracticeSteps = steps.length > 0
  const allDone = steps.length > 0 && attemptedCount >= steps.length
  const activeDoneCount = activeSteps.filter((s) => activeDoneIds.has(s.id)).length
  const activeTotal = activeSteps.length
  const reviewAllDone = reviewRoundActive && activeTotal > 0 && activeSteps.every((s) => reviewDoneIds.has(s.id))
  const passedCount = steps.filter((s) => passedStepIds.has(s.id)).length
  const weakCount = steps.filter((s) => weakStepIds.has(s.id)).length
  const unattemptedCount = steps.length - passedCount - weakCount
  const needsReviewRound = allDone && weakStepIds.size > 0 && !reviewRoundActive && !reviewDismissed

  const upcomingTopicCandidates = useMemo(() => {
    if (!plan || allDone) return []
    const topics = new Map<string, { id: string; title: string }>()
    for (const step of plan.steps) {
      if (attemptedIds.has(step.itemId) || topics.has(step.topicId)) continue
      topics.set(step.topicId, { id: step.topicId, title: step.topicTitle })
    }
    return [...topics.values()]
  }, [allDone, attemptedIds, plan])

  useEffect(() => {
    const missingTopicIds = upcomingTopicCandidates
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
  }, [teachingAvailability, upcomingTopicCandidates])

  const upcomingTeachingTopics = useMemo(
    () => upcomingTopicCandidates.filter((topic) => teachingAvailability[topic.id]),
    [teachingAvailability, upcomingTopicCandidates],
  )

  const visibleTeachingTopics = showAllTeachingTopics
    ? upcomingTeachingTopics
    : upcomingTeachingTopics.slice(0, 3)

  const filteredTopics = useMemo(() => {
    if (!plan) return []
    return plan.mode === 'review'
      ? plan.topicStats.filter((topic) => topic.overdueCount > 0 || topic.todayReviewCount > 0)
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
    if (!showTeachingHintIntro || upcomingTeachingTopics.length === 0) return
    window.localStorage.setItem(TODAY_TEACHING_HINT_SEEN_KEY, 'true')
    const timer = window.setTimeout(() => setShowTeachingHintIntro(false), 3600)
    return () => window.clearTimeout(timer)
  }, [showTeachingHintIntro, upcomingTeachingTopics.length])

  const startWeakReviewRound = useCallback(() => {
    if (weakStepIds.size === 0) return
    dispatchRound({ type: 'startReview', weakIds: [...weakStepIds] })
    setReviewRunNonce((value) => value + 1)
    warmupStore.resetStepStates([...weakStepIds])
    setCurrentIdx(0)
    setDrawerOpen(true)
  }, [dispatchRound, weakStepIds, warmupStore])

  /** 关闭练习抽屉：若正处在重练轮则取消重练并回到主轮（错题池保留），避免卡在 review 状态 */
  const closePracticeDrawer = useCallback(() => {
    setDrawerOpen(false)
    if (reviewRoundActive) dispatchRound({ type: 'finishReview' })
  }, [dispatchRound, reviewRoundActive])

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
    if (plan?.mode === 'practice') {
      if (reviewRoundActive) {
        const pending = activeTotal - activeDoneCount
        return [
          { key: 'done', count: activeDoneCount, color: 'bg-emerald-500' },
          { key: 'pending', count: pending, color: 'bg-muted-foreground/30' },
        ]
      }
      return [
        { key: 'done', count: passedCount, color: 'bg-emerald-500' },
        { key: 'weak', count: weakCount, color: 'bg-red-500/70' },
        { key: 'pending', count: unattemptedCount, color: 'bg-muted-foreground/30' },
      ]
    }
    return [
      { key: 'overdue', count: statusCounts.overdue, color: SEGMENT_COLORS.overdue },
      { key: 'review', count: statusCounts.review, color: SEGMENT_COLORS.review },
      { key: 'new', count: statusCounts.new, color: SEGMENT_COLORS.new },
      { key: 'done', count: statusCounts.done, color: SEGMENT_COLORS.done },
    ]
  }, [activeDoneCount, activeTotal, passedCount, plan?.mode, reviewRoundActive, statusCounts, unattemptedCount, weakCount])
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
        setHasSubmittedToday(true)
        // 重练完成 → 回到主视图完成态（仍有错题则「练习错题 N」按钮保留）
        if (reviewRoundActive) {
          dispatchRound({ type: 'finishReview' })
          setCurrentIdx(0)
          setDrawerOpen(false)
        }
      } catch (err) {
        console.warn('[today-task] ⚠️ 提交失败，下次刷新后重试:', err)
      }
    }

    submit()
  }, [activeDoneCount, allDone, dispatchRound, enrichedWarmupRecords, hasSubmittedToday, needsReviewRound, reviewAllDone, reviewRoundActive, sessionHydrated, steps.length, submitting, warmupRecordId, submitToday])

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
    // 主轮：与「继续练习」队列一致（排除错题，错题只通过「练习错题」重练）
    const sourceSteps = reviewRoundActive && reviewSteps ? reviewSteps : mainQueue
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
  }, [mainQueue, passedStepIds, reviewDoneIds, reviewRoundActive, reviewSteps, t])

  const openStepAt = useCallback((index: number) => {
    const step = activeSteps[index]
    if (!step) return
    setCurrentIdx(index)
    if (step.id.startsWith('placeholder:')) {
      markDone(step.id, 'ok')
    } else {
      setDrawerOpen(true)
    }
  }, [activeSteps, markDone])

  const openGroup = useCallback((group: PracticeGroup) => {
    const target = group.steps.find(({ step }) => !resumeDoneIds.has(step.id)) ?? group.steps[0]
    if (!target) return
    // 组内索引基于全量 steps，需映射到当前练习队列（主轮已排除错题）
    const targetIdx = activeSteps.findIndex((s) => s.id === target.step.id)
    if (targetIdx < 0) return
    setCurrentIdx(targetIdx)
    const step = activeSteps[targetIdx]
    if (step?.id.startsWith('placeholder:')) markDone(step.id, 'ok')
    else setDrawerOpen(true)
  }, [activeSteps, markDone, resumeDoneIds])

  const continueCurrentPractice = useCallback(() => {
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
    const firstPendingIndex = activeSteps.findIndex((step) => !resumeDoneIds.has(step.id))
    openStepAt(firstPendingIndex >= 0 ? firstPendingIndex : 0)
  }, [activeSteps, needsReviewRound, openStepAt, resumeDoneIds, reviewDoneIds, reviewRoundActive, reviewSteps, startWeakReviewRound])

  // ── 今日练习记录 ──
  const todayRecords = useMemo(() => {
    const latestByStep = new Map<string, WarmupRecordEntry>()
    for (const record of [...historicalTodayRecords, ...enrichedWarmupRecords]) {
      const key = record.stepId || `${record.zh}|${record.answer}`
      latestByStep.set(key, record)
    }
    return [...latestByStep.values()]
  }, [enrichedWarmupRecords, historicalTodayRecords])
  const extraTodayRecordCount = useMemo(() => {
    const scheduledStepIds = new Set(steps.map((step) => step.id))
    return todayRecords.filter((record) => !scheduledStepIds.has(record.stepId)).length
  }, [steps, todayRecords])

  // ── 导航 ──
  const currentStep = activeSteps[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < activeSteps.length - 1
  const currentStepDone = currentStep ? activeDoneIds.has(currentStep.id) : false
  const gotoPrev = useCallback(() => setCurrentIdx((p) => Math.max(0, p - 1)), [])
  const gotoNext = useCallback(() => setCurrentIdx((p) => Math.min(activeSteps.length - 1, p + 1)), [activeSteps.length])

  // 队列收缩（题被标记为错题移出「继续练习」）时修正越界索引
  useEffect(() => {
    if (activeSteps.length > 0 && currentIdx >= activeSteps.length) {
      setCurrentIdx(activeSteps.length - 1)
    }
  }, [activeSteps.length, currentIdx])

  useEffect(() => {
    if (!drawerOpen || !autoNextEnabled || !hasNext || !currentStepDone) return
    const timer = window.setTimeout(() => {
      setCurrentIdx((prev) => Math.min(activeSteps.length - 1, prev + 1))
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [activeSteps.length, autoNextEnabled, currentIdx, currentStepDone, drawerOpen, hasNext])

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
          <span className="mt-0.5 block text-[11px]">{t('todayTask.expireOverdue', { count: plan.availableReviewCount })}</span>
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
          <span className="mt-0.5 block text-[11px]">{practiceOrderLabel} {Math.min(plan.dailyGoal, plan.practicePoolCount)} / {plan.practicePoolCount}</span>
        </button>
      </div>

      <div className="mb-5 rounded-lg bg-muted/30 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{activeModeLabel}{t('todayTask.progress')}</p>
            {hasSubmittedToday && allDone && (
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
          <Badge variant="secondary" className="h-6 rounded-full px-2 text-[10px]">
            {activeDoneCount}/{activeTotal} {t('todayTask.questions')}
          </Badge>
          {extraTodayRecordCount > 0 && (
            <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px] text-emerald-600">
              {t('todayTask.extraPractice', { count: extraTodayRecordCount })}
            </Badge>
          )}
        </div>
        <SegmentedBar segments={topSegments} />
        {plan.mode === 'practice' && (
          <>
          <div className="mt-3 flex items-stretch gap-2">
            {!hasPracticeSteps ? (
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-left text-muted-foreground"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{t('todayTask.noPractice')}</span>
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
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{t('todayTask.continuePractice')}</span>
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
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{t('todayTask.continuePractice')}</span>
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
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{t('todayTask.rePractice')}</span>
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
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{t('todayTask.practiceWrong', { count: weakStepIds.size })}</span>
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">
                      <ArrowRight className="size-4" />
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
          {allDone && weakStepIds.size === 0 && !reviewRoundActive && (
            <button
              type="button"
              onClick={startNewPracticeSet}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 active:scale-[0.99]"
            >
              {dailyPracticeRandomOrder ? t('todayTask.randomAgain') : t('todayTask.practiceAgain')}
              <ArrowRight className="size-3.5" />
            </button>
          )}
          </>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          {plan.mode === 'practice' ? (
            <>
              {passedCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500" />{t('todayTask.done', { count: passedCount })}</span>}
              {weakCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-red-500/70" />{t('todayTask.toPractice', { count: weakCount })}</span>}
              {extraTodayRecordCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500/70" />{t('todayTask.extraPractice', { count: extraTodayRecordCount })}</span>}
              {unattemptedCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/45" />{t('todayTask.unattempted', { count: unattemptedCount })}</span>}
            </>
          ) : (
            <>
              {statusCounts.overdue > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-red-500" />{t('todayTask.overdue', { count: statusCounts.overdue })}</span>}
              {statusCounts.review > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-amber-500" />{t('todayTask.review', { count: statusCounts.review })}</span>}
              {statusCounts.new > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/45" />{t('todayTask.newPractice', { count: statusCounts.new })}</span>}
              {statusCounts.done > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500" />{t('todayTask.done', { count: statusCounts.done })}</span>}
              {extraTodayRecordCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500/70" />{t('todayTask.extraPractice', { count: extraTodayRecordCount })}</span>}
            </>
          )}
          {statusCounts.overdue === 0 && statusCounts.review === 0 && statusCounts.new === 0 && statusCounts.done === 0 && (
            <span className="text-muted-foreground/50">{t('todayTask.noPractice')}</span>
          )}
        </div>
        {plan.mode === 'practice' && upcomingTeachingTopics.length > 0 && (
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
              {upcomingTeachingTopics.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllTeachingTopics((visible) => !visible)}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg bg-muted/70 px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted active:scale-[0.98]"
                  title={upcomingTeachingTopics.slice(3).map((topic) => topic.title).join('、')}
                >
                  {showAllTeachingTopics
                    ? t('todayTask.collapseTopics')
                    : t('todayTask.moreTeachingTopics', { count: upcomingTeachingTopics.length - 3 })}
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
                                  { key: 'overdue', count: topic.overdueCount, color: SEGMENT_COLORS.overdue },
                                  { key: 'review', count: topic.todayReviewCount, color: SEGMENT_COLORS.review },
                                  { key: 'new', count: topic.todayNewCount, color: SEGMENT_COLORS.new },
                                  { key: 'done', count: topic.doneTodayCount, color: SEGMENT_COLORS.done },
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
                      <Link
                        to={`/practice/session/${topic.topicId}?mode=${plan.mode}`}
                        onClick={(event) => event.stopPropagation()}
                        className="flex w-10 shrink-0 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground"
                        aria-label={`${topic.topicTitle} ${t('todayTask.practice')}`}
                      >
                        <ChevronRight className="size-4" />
                      </Link>
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
              <div key={`${currentStep?.id}:${reviewRunNonce}`}>
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
            <div className="space-y-1">
              {playlistGroups.map((group) => {
                const isActive = group.steps.some(({ index }) => index === currentIdx)
                const isDone = group.doneCount === group.totalCount
                const Icon = group.meta.icon
                return (
                  <button
                    key={group.type}
                    type="button"
                    onClick={() => { openGroup(group); setPlaylistOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{group.meta.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{group.doneCount}/{group.totalCount} {t('todayTask.questionsCompleted')}</p>
                    </div>
                    {isDone && <CheckCircle2 className="size-4 shrink-0 text-green-500" />}
                    {isActive && <Badge variant="default" className="px-1.5 py-0 text-[10px]">{t('todayTask.current')}</Badge>}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* ── 练习记录 Drawer ── */}
      <Dialog
        open={needsReviewRound}
        onOpenChange={(open) => {
          if (!open) dispatchRound({ type: 'dismissReview' })
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
            <Button variant="outline" className="flex-1" onClick={() => dispatchRound({ type: 'dismissReview' })}>
              {t('todayTask.later')}
            </Button>
            <Button className="flex-1" onClick={startWeakReviewRound}>
              {t('todayTask.startWrongReview')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TodayRecordsDrawer
        open={recordsOpen}
        onOpenChange={setRecordsOpen}
        records={todayRecords}
        steps={steps}
        onReplay={(idx) => { setCurrentIdx(idx); setRecordsOpen(false); setDrawerOpen(true) }}
      />
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
import { usePreferencesStore } from '@/stores/preferences.store'
import { preloadWarmupLocalJudge, type WarmupReferencePreloadInput } from '@/lib/local-ai/warmup-local-judge'
import { useAuth } from '@/providers/auth-provider'
import { toast } from 'sonner'
import { practiceRepository } from '@/lib/offline'

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

function useTopicStatusMeta(t: (key: string) => string): Record<DailyPracticeStatus, { label: string; badge: string; bar: string }> {
  return useMemo(() => ({
    overdue: { label: t('todayTask.statusOverdue'), badge: 'border-red-300 text-red-600 bg-red-500/10', bar: 'bg-red-500' },
    review: { label: t('todayTask.statusReview'), badge: 'border-amber-300 text-amber-700 bg-amber-500/10', bar: 'bg-amber-500' },
    new: { label: t('todayTask.statusNew'), badge: 'border-blue-300 text-blue-600 bg-blue-500/10', bar: 'bg-muted-foreground/45' },
    done: { label: t('todayTask.statusDone'), badge: 'border-emerald-300 text-emerald-600 bg-emerald-500/10', bar: 'bg-emerald-500' },
    mastered: { label: t('todayTask.statusMastered'), badge: 'border-violet-300 text-violet-600 bg-violet-500/10', bar: 'bg-violet-500' },
  }), [t])
}

// ── 组件 ──
export function TodayTaskPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const isAdmin = session?.user?.role === 'admin'
  const TYPE_META = useTypeMeta(t)
  const TOPIC_STATUS_META = useTopicStatusMeta(t)
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
  const dailyPracticeRandomOrder = usePreferencesStore((s) => s.dailyPracticeRandomOrder)
  const localAiWarmupJudgeEnabled = usePreferencesStore((s) => s.localAiWarmupJudgeEnabled)

  // 练习状态
  const hydrateWarmupSession = useWarmupSessionStore((s) => s.hydrateSession)
  const hydrateHistoricalStepStates = useWarmupSessionStore((s) => s.hydrateHistoricalStepStates)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [historicalTodayRecords, setHistoricalTodayRecords] = useState<WarmupRecordEntry[]>([])
  const [autoNextEnabled, setAutoNextEnabled] = useState(false)
  const [reviewRoundStarted, setReviewRoundStarted] = useState(false)
  const [reviewRoundFinished, setReviewRoundFinished] = useState(false)
  const [reviewRunNonce, setReviewRunNonce] = useState(0)
  const localAiPreloadKeyRef = useRef<string | null>(null)
  const warmupSessionHydratedKeyRef = useRef<string | null>(null)
  const planMode = searchParams.has('mode') ? normalizePlanMode(searchParams.get('mode')) : getSessionPlanMode()
  const [planRunSeed, setPlanRunSeed] = useState(0)
  const currentPlanReusable = Boolean(
    plan &&
    planRunSeed === 0 &&
    plan.mode === planMode &&
    (!targetDate || plan.date === targetDate) &&
    (!targetPackId || plan.units.some((unit) => unit.id === targetPackId)),
  )

  useEffect(() => {
    if (currentPlanReusable) return
    warmupStore.clearSession()
    setHasSubmittedToday(false)
    setReviewRoundStarted(false)
    setReviewRoundFinished(false)
    setReviewRunNonce(0)
    loadToday(targetPackId, targetDate, planMode, planRunSeed > 0)
  }, [currentPlanReusable, loadToday, targetPackId, targetDate, planMode, planRunSeed])

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
        if (isAdmin && (result?.computedCount ?? 0) > 0) toast.success(`本地 AI 预加载成功 · ${result?.computedCount ?? references.length} 题`)
      })
      .catch((error) => {
        console.warn('[warmup-local-judge] preload failed:', error)
        if (isAdmin) toast.warning(`本地 AI 预加载失败：${error instanceof Error ? error.message : String(error)}`)
      })
  }, [drawerOpen, isAdmin, localAiWarmupJudgeEnabled, plan?.steps, plan?.units, targetPackId])

  useEffect(() => {
    setDoneIds(new Set(plan?.completedItemIds ?? []))
  }, [plan?.completedItemIds])

  const markDone = useCallback(async (stepId: string, score: WarmupScore = 'strong') => {
    const source = plan?.steps.find((step) => step.itemId === stepId)
    if (source) await completeStep(source, score)
    setDoneIds((prev) => {
      const next = new Set(prev)
      next.add(stepId)
      return next
    })
  }, [completeStep, plan?.steps])

  // ── 自动提交状态（effect 移至 doneCount/steps 声明之后）──
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false)

  const switchPlanMode = useCallback((nextMode: DailyPracticePlanMode) => {
    window.sessionStorage.setItem(TODAY_TASK_MODE_SESSION_KEY, nextMode)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('mode', nextMode)
      return next
    })
    setPlanRunSeed(Date.now())
    setCurrentIdx(0)
    setDoneIds(new Set())
    setDrawerOpen(false)
    setPlaylistOpen(false)
    setRecordsOpen(false)
    setReviewRoundStarted(false)
    setReviewRoundFinished(false)
    setReviewRunNonce(0)
    setHasSubmittedToday(false)
    warmupStore.clearSession()
  }, [warmupStore])

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
                onComplete={(_idx, _passed, score) => { void markDone(sid, score) }}
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
                onComplete={(_idx, _passed, score) => { void markDone(sid, score) }}
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
                onComplete={(_idx, _passed, score) => { void markDone(sid, score) }}
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
                onComplete={(_idx, _passed, score) => { void markDone(sid, score) }}
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
  }, [markDone, plan?.steps])

  const warmupRecordId = useMemo(() => {
    if (!plan || plan.scheduledItemIds.length === 0) return null
    const scope = plan.units.map((unit) => unit.id).join(',') || 'mixed'
    return `today-warmup:${plan.date}:${plan.mode}:${scope}:${planRunSeed || 'current'}:${plan.scheduledItemIds.join('|')}`
  }, [plan, planRunSeed])

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
      if (currentRecords.length > 0) hydrateWarmupSession(currentRecords)
      const missingStepIds = steps
        .map((step) => step.id)
        .filter((stepId) => !currentRecords.some((record) => record.stepId === stepId))
      if (missingStepIds.length === 0) return
      void practiceRepository.getLatestWarmupEntriesByStepIds(missingStepIds, warmupRecordId).then((records) => {
        if (!cancelled && records.length > 0) hydrateHistoricalStepStates(records)
      })
    }).catch(() => undefined)
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
    const firstTopic = plan.topicStats.find((topic) => topic.scheduledTodayCount > 0) ?? plan.topicStats[0]
    if (!firstTopic) return
    void practiceRepository.upsertLocalWarmupRecord({
      id: warmupRecordId,
      topicId: firstTopic.topicId,
      topicTitle: firstTopic.topicTitle,
      items: enrichedWarmupRecords,
      syncStatus: 'pending',
    }).catch(() => undefined)
  }, [enrichedWarmupRecords, plan, warmupRecordId])

  useEffect(() => {
    if (!recordsOpen || !plan?.date) return
    let cancelled = false
    void practiceRepository.getWarmupEntriesByDate(plan.date).then((records) => {
      if (!cancelled) setHistoricalTodayRecords(records)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [recordsOpen, plan?.date, warmupStore.records])

  // ── 进度统计 ──
  const doneCount = steps.filter((s) => doneIds.has(s.id)).length
  const donePercent = steps.length > 0 ? (doneCount / steps.length) * 100 : 0
  const allDone = steps.length > 0 && doneCount >= steps.length
  const weakRecords = useMemo(
    () => warmupStore.records.filter((record) => record.score === 'weak' || record.score === 'miss'),
    [warmupStore.records],
  )
  const weakStepIds = useMemo(() => new Set(weakRecords.map((record) => record.stepId)), [weakRecords])
  const needsReviewRound = allDone && weakStepIds.size > 0 && !reviewRoundStarted && !reviewRoundFinished

  const startWeakReviewRound = useCallback(() => {
    if (weakStepIds.size === 0) return
    setReviewRoundStarted(true)
    setReviewRoundFinished(false)
    setReviewRunNonce((value) => value + 1)
    setDoneIds((prev) => new Set([...prev].filter((id) => !weakStepIds.has(id))))
    warmupStore.resetSteps([...weakStepIds])
    const firstWeakIndex = steps.findIndex((step) => weakStepIds.has(step.id))
    if (firstWeakIndex >= 0) {
      setCurrentIdx(firstWeakIndex)
      setDrawerOpen(true)
    }
  }, [steps, warmupStore, weakStepIds])

  useEffect(() => {
    if (allDone && reviewRoundStarted && !reviewRoundFinished) {
      setReviewRoundFinished(true)
    }
  }, [allDone, reviewRoundFinished, reviewRoundStarted])

  // ── 按状态分组统计（用于分段进度条）──
  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, review: 0, new: 0, done: 0 }
    for (const s of steps) {
      if (doneIds.has(s.id)) { counts.done++ }
      else if (s.scheduleStatus === 'overdue') { counts.overdue++ }
      else if (s.scheduleStatus === 'review') { counts.review++ }
      else { counts.new++ }
    }
    return counts
  }, [steps, doneIds])

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
      const pending = steps.length - statusCounts.done
      return [
        { key: 'done', count: statusCounts.done, color: 'bg-emerald-500' },
        { key: 'pending', count: pending, color: 'bg-muted-foreground/30' },
      ]
    }
    return [
      { key: 'overdue', count: statusCounts.overdue, color: SEGMENT_COLORS.overdue },
      { key: 'review', count: statusCounts.review, color: SEGMENT_COLORS.review },
      { key: 'new', count: statusCounts.new, color: SEGMENT_COLORS.new },
      { key: 'done', count: statusCounts.done, color: SEGMENT_COLORS.done },
    ]
  }, [statusCounts, steps.length, plan?.mode])
  const practiceOrderLabel = dailyPracticeRandomOrder ? t('todayTask.randomPick') : t('todayTask.sequentialPick')
  const activeModeLabel = plan?.mode === 'review' ? t('todayTask.reviewList') : t('todayTask.practiceGroup')

  // ── 自动提交：全部完成时持久化记录到本地 + 同步后端 ──
  useEffect(() => {
    if (hasSubmittedToday || steps.length === 0) return
    if (!allDone || needsReviewRound) return

    const submit = async () => {
      try {
        await submitToday(enrichedWarmupRecords, warmupRecordId)
        console.log('[today-task] ✅ 本组练习已提交 |', doneCount, '题')
      } catch (err) {
        console.warn('[today-task] ⚠️ 提交失败，下次刷新后重试:', err)
      } finally {
        setHasSubmittedToday(true)
      }
    }

    submit()
  }, [allDone, enrichedWarmupRecords, needsReviewRound, steps.length, hasSubmittedToday, warmupRecordId, submitToday])

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
      if (doneIds.has(step.id)) group.doneCount += 1
      order.set(step.type, group)
    })
    return Array.from(order.values())
  }, [doneIds, steps])

  const openStepAt = useCallback((index: number) => {
    const step = steps[index]
    if (!step) return
    setCurrentIdx(index)
    if (step.id.startsWith('placeholder:')) {
      markDone(step.id, 'ok')
    } else {
      setDrawerOpen(true)
    }
  }, [markDone, steps])

  const openGroup = useCallback((group: PracticeGroup) => {
    const target = group.steps.find(({ step }) => !doneIds.has(step.id)) ?? group.steps[0]
    if (target) openStepAt(target.index)
  }, [doneIds, openStepAt])

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
  const currentStep = steps[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < steps.length - 1
  const currentStepDone = currentStep ? doneIds.has(currentStep.id) : false
  const gotoPrev = useCallback(() => setCurrentIdx((p) => Math.max(0, p - 1)), [])
  const gotoNext = useCallback(() => setCurrentIdx((p) => Math.min(steps.length - 1, p + 1)), [steps.length])

  useEffect(() => {
    if (!drawerOpen || !autoNextEnabled || !hasNext || !currentStepDone) return
    const timer = window.setTimeout(() => {
      setCurrentIdx((prev) => Math.min(steps.length - 1, prev + 1))
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [autoNextEnabled, currentIdx, currentStepDone, drawerOpen, hasNext, steps.length])

  // ── 加载态：仅在无缓存数据时展示 ──
  if (loading && !plan) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
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
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
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
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
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
        <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45 lg:hidden">
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
            {hasSubmittedToday && donePercent >= 100 && (
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
            {doneCount}/{steps.length} {t('todayTask.questions')}
          </Badge>
          {extraTodayRecordCount > 0 && (
            <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px] text-emerald-600">
              额外 +{extraTodayRecordCount}
            </Badge>
          )}
        </div>
        <SegmentedBar segments={topSegments} />
        {plan.mode === 'practice' && (
          <button
            type="button"
            disabled={!allDone || needsReviewRound}
            onClick={() => switchPlanMode('practice')}
            className={cn(
              'mt-3 flex w-full items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              (!allDone || needsReviewRound)
                ? 'cursor-not-allowed border-muted-foreground/20 bg-muted/30 text-muted-foreground'
                : 'border-blue-300/60 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:text-blue-300',
            )}
          >
            {dailyPracticeRandomOrder ? t('todayTask.randomAgain') : t('todayTask.practiceAgain')}
          </button>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          {plan.mode === 'practice' ? (
            <>
              {statusCounts.done > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500" />{t('todayTask.done', { count: statusCounts.done })}</span>}
              {extraTodayRecordCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500/70" />额外练习 {extraTodayRecordCount}</span>}
              {steps.length - statusCounts.done > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/45" />{t('todayTask.pending', { count: steps.length - statusCounts.done })}</span>}
            </>
          ) : (
            <>
              {statusCounts.overdue > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-red-500" />{t('todayTask.overdue', { count: statusCounts.overdue })}</span>}
              {statusCounts.review > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-amber-500" />{t('todayTask.review', { count: statusCounts.review })}</span>}
              {statusCounts.new > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-muted-foreground/45" />{t('todayTask.newPractice', { count: statusCounts.new })}</span>}
              {statusCounts.done > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500" />{t('todayTask.done', { count: statusCounts.done })}</span>}
              {extraTodayRecordCount > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500/70" />额外练习 {extraTodayRecordCount}</span>}
            </>
          )}
          {statusCounts.overdue === 0 && statusCounts.review === 0 && statusCounts.new === 0 && statusCounts.done === 0 && (
            <span className="text-muted-foreground/50">{t('todayTask.noPractice')}</span>
          )}
        </div>
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
                            doneIds.has(step.id)
                              ? 'bg-green-500/10 text-green-600 dark:text-green-300'
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
      {plan.topicStats.length > 0 && (() => {
        const isReviewMode = plan.mode === 'review'
        const filteredTopics = isReviewMode
          ? plan.topicStats.filter((t) => t.overdueCount > 0 || t.todayReviewCount > 0)
          : plan.topicStats

        if (filteredTopics.length === 0) return null

        return (
          <>
            <Separator className="my-6" />
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {isReviewMode ? t('todayTask.topicsToReview') : t('todayTask.currentTopics')}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {isReviewMode ? t('todayTask.topicsWithReviewItems', { count: filteredTopics.length }) : t('todayTask.topicsCount', { count: filteredTopics.length })}
                </span>
              </div>
              <div className="space-y-1.5">
                {filteredTopics.map((topic, index) => {
                  const statusMeta = TOPIC_STATUS_META[topic.status]
                  const detail = isReviewMode
                    ? [
                        topic.overdueCount > 0 ? `${t('todayTask.statusOverdue')} ${topic.overdueCount}` : null,
                        topic.todayReviewCount > 0 ? `${t('todayTask.statusReview')} ${topic.todayReviewCount}` : null,
                        topic.todayNewCount > 0 ? `${t('todayTask.statusNew')} ${topic.todayNewCount}` : null,
                      ].filter(Boolean).join(' · ')
                    : null
                  const unPracticed = topic.totalCount - topic.doneTodayCount - topic.masteredCount
                  return (
                    <Link
                      key={topic.topicId}
                      to={`/practice/session/${topic.topicId}?mode=${plan.mode}`}
                      className="flex items-center gap-3 rounded-lg bg-muted/25 px-3 py-3 transition-colors hover:bg-muted/50 active:scale-[0.98]"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="line-clamp-1 flex-1 text-sm font-medium text-foreground">{topic.topicTitle}</p>
                          <Badge variant="outline" className={cn('shrink-0 rounded-full text-[10px]', isReviewMode ? statusMeta.badge : 'border-muted-foreground/30 text-muted-foreground')}>
                            {isReviewMode
                              ? statusMeta.label
                              : unPracticed > 0
                                ? `${unPracticed} ${t('todayTask.pendingItems')}`
                                : t('todayTask.completed')}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {topic.activeChunksCount} {t('todayTask.expressions')}{detail ? ` · ${detail}` : ''}
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
                                  { key: 'done', count: topic.doneTodayCount + topic.masteredCount, color: 'bg-emerald-500' },
                                  { key: 'pending', count: unPracticed, color: 'bg-muted-foreground/30' },
                                ]
                            }
                          />
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {isReviewMode
                              ? t('todayTask.notReviewed', { count: topic.overdueCount + topic.todayReviewCount })
                              : t('todayTask.practiced', { done: topic.doneTodayCount + topic.masteredCount, total: topic.totalCount })
                            }
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[10px]">{topic.difficulty}</Badge>
                    </Link>
                  )
                })}
              </div>
            </section>
          </>
        )
      })()}

      {/* ── 练习 Dialog（与 LearningInsightDialog 完全统一）── */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
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
            <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/5 to-background px-5 pb-4 pt-9 md:px-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {(() => { const Icon = currentMeta.icon; return <Icon className="size-[18px]" /> })()}
                </div>
                <div className="w-0 flex-1 overflow-hidden">
                  <Badge variant="secondary" className="mb-1.5">{currentMeta.label}</Badge>
                  <h2 className="truncate text-lg font-bold leading-tight text-foreground">
                    {currentStep?.headerContent || currentStep?.label}
                  </h2>
                  <p className="truncate mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {currentStep?.topicTitle}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/70">
                  <span>{t('todayTask.autoNext')}</span>
                  <Switch
                    checked={autoNextEnabled}
                    onCheckedChange={setAutoNextEnabled}
                    disabled={steps.length <= 1}
                    className="origin-right scale-90"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 md:px-6">
              <div key={`${currentStep?.id}:${reviewRunNonce}`}>
                {currentStep?.render()}
              </div>
            </div>

            {/* Bottom nav */}
            <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
              <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
                <ChevronLeft className="size-4" />
                <span className="ml-1">{t('todayTask.prevQuestion')}</span>
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentIdx + 1} / {steps.length}
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
              {groupedSteps.map((group) => {
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
          if (!open) startWeakReviewRound()
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
                <div key={record.stepId} className="rounded-lg bg-background px-3 py-2">
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
          <Button className="w-full" onClick={startWeakReviewRound}>
            {t('todayTask.startWrongReview')}
          </Button>
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

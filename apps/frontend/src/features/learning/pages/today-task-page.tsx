import { useEffect, useMemo, useState, useCallback } from 'react'
import type React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, BookOpen, BookText, Braces, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, ListChecks, ListMusic, MessageSquareText, Target,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { cn } from '@/lib/cn'
import { isIOS } from '@/lib/native'
import { ChunkOutputDrillCard } from '@/features/practice/components/chunk-output-drill-card'
import { VocabOutputCard } from '@/features/practice/components/vocab-output-card'
import { PatternDrillCard } from '@/features/practice/components/pattern-drill-card'
import { SentenceDecompositionCard } from '@/features/practice/components/sentence-decomposition-card'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'
import { useDailyPracticeStore } from '@/stores/daily-practice.store'
import type { DailyPracticeStatus } from '@/lib/offline/daily-practice.repository'
import { TodayRecordsDrawer } from '../components/today-records-drawer'

// ── 类型 ──
type SimplePromptItem = { zh: string; answer?: string; hint?: string }
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
  meta: { label: string; icon: typeof BookText; color: string }
  steps: Array<{ step: PracticeItem; index: number }>
  doneCount: number
  totalCount: number
}

// ── 类型显示映射 ──
const TYPE_META: Record<string, { label: string; icon: typeof BookText; color: string }> = {
  chunk_substitution: {
    label: '句块替换',
    icon: MessageSquareText,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
  },
  vocab_drill: {
    label: '词汇输出',
    icon: BookText,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  vocab_sentence_building: {
    label: '一词多句',
    icon: BookText,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  pattern_drill: {
    label: '句型操练',
    icon: Braces,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  sentence_decomposition: {
    label: '句子拆解',
    icon: BookOpen,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
}

const TOPIC_STATUS_META: Record<DailyPracticeStatus, { label: string; badge: string; bar: string }> = {
  overdue: { label: '逾期累积', badge: 'border-red-300 text-red-600 bg-red-500/10', bar: 'bg-red-500' },
  review: { label: '今日复习', badge: 'border-amber-300 text-amber-700 bg-amber-500/10', bar: 'bg-amber-500' },
  new: { label: '今日待练', badge: 'border-blue-300 text-blue-600 bg-blue-500/10', bar: 'bg-blue-500' },
  done: { label: '今日完成', badge: 'border-emerald-300 text-emerald-600 bg-emerald-500/10', bar: 'bg-emerald-500' },
  mastered: { label: '短期掌握', badge: 'border-violet-300 text-violet-600 bg-violet-500/10', bar: 'bg-violet-500' },
}

// ── 组件 ──
export function TodayTaskPage() {
  const warmupStore = useWarmupSessionStore()
  const [searchParams] = useSearchParams()
  const targetPackId = searchParams.get('packId') || null
  const targetDate = searchParams.get('date') || null
  const plan = useDailyPracticeStore((s) => s.plan)
  const loading = useDailyPracticeStore((s) => s.loading)
  const error = useDailyPracticeStore((s) => s.error)
  const submitting = useDailyPracticeStore((s) => s.submitting)
  const loadToday = useDailyPracticeStore((s) => s.loadToday)
  const completeStep = useDailyPracticeStore((s) => s.completeStep)
  const submitToday = useDailyPracticeStore((s) => s.submitToday)

  // 练习状态
  const [currentIdx, setCurrentIdx] = useState(0)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)

  useEffect(() => {
    warmupStore.clearSession()
    setHasSubmittedToday(false)
    loadToday(targetPackId, targetDate)
  }, [loadToday, targetPackId, targetDate])

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
            displayLabel: isWord ? '词汇替换' : '句块替换',
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
                title={item.title || '词汇输出'}
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
                groupTitle={`${vocabWord || '一词多句'} · ${patternChunk}`}
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
                title={item.title || '长句拆解'}
                levels={item.levels}
                stepId={sid}
                onComplete={(_passed, score) => { void markDone(sid, score) }}
                hideHeader
              />
            ),
        }
      })
  }, [markDone, plan?.steps])

  // ── 进度统计 ──
  const doneCount = steps.filter((s) => doneIds.has(s.id)).length
  const donePercent = steps.length > 0 ? (doneCount / steps.length) * 100 : 0

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
    new: 'bg-blue-500',
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

  const topSegments = useMemo(() => [
    { key: 'overdue', count: statusCounts.overdue, color: SEGMENT_COLORS.overdue },
    { key: 'review', count: statusCounts.review, color: SEGMENT_COLORS.review },
    { key: 'new', count: statusCounts.new, color: SEGMENT_COLORS.new },
    { key: 'done', count: statusCounts.done, color: SEGMENT_COLORS.done },
  ], [statusCounts])

  // ── 自动提交：全部完成时持久化记录到本地 + 同步后端 ──
  useEffect(() => {
    if (hasSubmittedToday || steps.length === 0) return
    if (doneCount < steps.length) return

    const submit = async () => {
      try {
        await submitToday(warmupStore.records)
        console.log('[today-task] ✅ 今日练习已提交 |', doneCount, '题')
      } catch (err) {
        console.warn('[today-task] ⚠️ 提交失败，下次刷新后重试:', err)
      } finally {
        setHasSubmittedToday(true)
      }
    }

    submit()
  }, [doneCount, steps.length, hasSubmittedToday, warmupStore.records, submitToday])

  const groupedSteps = useMemo<PracticeGroup[]>(() => {
    const order = new Map<string, PracticeGroup>()
    steps.forEach((step, index) => {
      const meta = TYPE_META[step.type] ?? {
        label: step.displayLabel || '知识点',
        icon: MessageSquareText,
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
  const todayRecords = warmupStore.records

  // ── 导航 ──
  const currentStep = steps[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < steps.length - 1
  const gotoPrev = useCallback(() => setCurrentIdx((p) => Math.max(0, p - 1)), [])
  const gotoNext = useCallback(() => setCurrentIdx((p) => Math.min(steps.length - 1, p + 1)), [steps.length])

  // ── 加载态：仅在无缓存数据时展示 ──
  if (loading && !plan) return <MobilePageLoading rows={4} />

  // ── 空态 ──
  if (error || (!loading && (!plan || steps.length === 0))) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            {error || '今日要练习的学习包暂无可练习内容'}
          </p>
          <Button className="mt-4" asChild>
            <Link to="/learning">
              选择学习包
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── 当前练习类型信息 ──
  const currentMeta = TYPE_META[currentStep?.type] ?? {
    label: '知识点练习',
    icon: MessageSquareText,
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
            aria-label="练习记录"
          >
            <ClipboardList className="size-[18px]" />
          </button>
        </div>
      </div>

      {/* ── 进度条 ── */}
      <div className="mb-5 rounded-lg bg-muted/30 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">今日进度</p>
            {hasSubmittedToday && donePercent >= 100 && (
              <Badge variant="default" className="h-5 rounded-full px-2 text-[10px] bg-green-500/15 text-green-600">
                <CheckCircle2 className="mr-0.5 size-3" /> 已打卡
              </Badge>
            )}
            {submitting && (
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] animate-pulse">
                同步中...
              </Badge>
            )}
            {targetDate && (
              <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                测试日期 {plan.date}
              </Badge>
            )}
          </div>
          <Badge variant="secondary" className="h-6 rounded-full px-2 text-[10px]">
            {doneCount}/{steps.length} 题
          </Badge>
        </div>
        <SegmentedBar segments={topSegments} />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          {statusCounts.overdue > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-red-500" />逾期 {statusCounts.overdue}</span>}
          {statusCounts.review > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-amber-500" />复习 {statusCounts.review}</span>}
          {statusCounts.new > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-blue-500" />新练 {statusCounts.new}</span>}
          {statusCounts.done > 0 && <span className="inline-flex items-center gap-1"><span className="inline-block size-1.5 rounded-full bg-emerald-500" />完成 {statusCounts.done}</span>}
          {statusCounts.overdue === 0 && statusCounts.review === 0 && statusCounts.new === 0 && statusCounts.done === 0 && (
            <span className="text-muted-foreground/50">暂无练习</span>
          )}
        </div>
      </div>

      {/* ── 练习卡片列表 ── */}
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
                    {examples.join(' · ') || `${group.totalCount} 道练习`}
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

      {/* ── 今日话题快捷入口 ── */}
      {plan.topicStats.length > 0 && (
        <>
          <Separator className="my-6" />
          <section>
            {/* <div className="mb-3 flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">今日话题</h2>
              <span className="text-xs text-muted-foreground">快捷练习入口</span>
            </div> */}
            <div className="space-y-1.5">
              {plan.topicStats.map((topic, index) => {
                const statusMeta = TOPIC_STATUS_META[topic.status]
                const detail = [
                  topic.overdueCount > 0 ? `逾期 ${topic.overdueCount}` : null,
                  topic.todayReviewCount > 0 ? `复习 ${topic.todayReviewCount}` : null,
                  topic.todayNewCount > 0 ? `新练 ${topic.todayNewCount}` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <Link
                    key={topic.topicId}
                    to={`/practice/session/${topic.topicId}`}
                    className="flex items-center gap-3 rounded-lg bg-muted/25 px-3 py-3 transition-colors hover:bg-muted/50 active:scale-[0.98]"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="line-clamp-1 flex-1 text-sm font-medium text-foreground">{topic.topicTitle}</p>
                        <Badge variant="outline" className={cn('shrink-0 rounded-full text-[10px]', statusMeta.badge)}>{statusMeta.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {topic.activeChunksCount} 表达 · {Math.max(1, Math.round(topic.suggestedDurationSec / 60))} 分钟{detail ? ` · ${detail}` : ''}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <SegmentedBar
                          segments={[
                            { key: 'overdue', count: topic.overdueCount, color: SEGMENT_COLORS.overdue },
                            { key: 'review', count: topic.todayReviewCount, color: SEGMENT_COLORS.review },
                            { key: 'new', count: topic.todayNewCount, color: SEGMENT_COLORS.new },
                            { key: 'done', count: topic.doneTodayCount, color: SEGMENT_COLORS.done },
                          ]}
                        />
                        <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{topic.topicWarmupProgress}%</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px]">{topic.difficulty}</Badge>
                  </Link>
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* ── 练习 Dialog（与 LearningInsightDialog 完全统一）── */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          data-keyboard-overlay="practice"
          className="!z-[10000] h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 pt-safe md:h-[88vh] md:max-w-3xl md:rounded-2xl md:pt-0 [&>button]:hidden"
        >
          <DialogTitle className="sr-only">
            {currentStep?.displayLabel || currentMeta.label} · {currentStep?.topicTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {currentStep?.label}
          </DialogDescription>

          <div className="flex h-full flex-col">
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
              <div key={currentStep?.id}>
                {currentStep?.render()}
              </div>
            </div>

            {/* Bottom nav */}
            <div className={cn('flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3', isIOS() && 'pb-safe')}>
              <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev} className="gap-1">
                <ChevronLeft className="size-4" />
                <span className="ml-1">上一题</span>
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentIdx + 1} / {steps.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext} className="gap-1">
                  <span className="mr-1">下一题</span>
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPlaylistOpen(true)}
                  title="题目列表"
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
        <DrawerContent className="h-[100dvh] rounded-none pt-safe">
          <div className="flex items-center justify-between px-5 py-3">
            <DrawerTitle className="text-lg">今日练习</DrawerTitle>
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
                      <p className="truncate text-xs text-muted-foreground">{group.doneCount}/{group.totalCount} 题完成</p>
                    </div>
                    {isDone && <CheckCircle2 className="size-4 shrink-0 text-green-500" />}
                    {isActive && <Badge variant="default" className="px-1.5 py-0 text-[10px]">当前</Badge>}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* ── 练习记录 Drawer ── */}
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

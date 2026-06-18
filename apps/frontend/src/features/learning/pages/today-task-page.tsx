import { useEffect, useMemo, useState, useCallback } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, BookText, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, ListChecks, MessageSquareText, Target, Sparkles, Package,
  CheckCircle2, XCircle, Clock3, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { MobilePageLoading } from '@/components/common/mobile-page-loading'
import { cn } from '@/lib/cn'
import type { UnitDetail } from '../api/learning-api'
import { learningPackService, learningRepository } from '@/lib/offline'
import { ChunkOutputDrillCard } from '@/features/practice/components/chunk-output-drill-card'
import { VocabOutputCard } from '@/features/practice/components/vocab-output-card'
import { PatternDrillCard } from '@/features/practice/components/pattern-drill-card'
import { SentenceDecompositionCard } from '@/features/practice/components/sentence-decomposition-card'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useWarmupSessionStore, type WarmupScore } from '@/stores/warmup-session.store'
import { getCategoryIcon } from '../components/category-icons'

// ── 类型 ──
type SimplePromptItem = { zh: string; answer?: string; hint?: string }
type VocabPromptItem = {
  vocabId: string
  promptZh: string
  targetWords?: string[]
  suggestedAnswer?: string
  hint?: string
}

type PracticeItem = {
  id: string
  type: string
  label: string
  topicTitle: string
  render: () => React.ReactNode
}

// ── 工具函数 ──
function pickOne<T>(items: T[] | undefined): [T, number] | null {
  if (!items?.length) return null
  const idx = Math.floor(Math.random() * items.length)
  return [items[idx], idx]
}

function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
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
    label: '词汇造句',
    icon: BookText,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  pattern_drill: {
    label: '句型操练',
    icon: MessageSquareText,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  sentence_decomposition: {
    label: '句子拆解',
    icon: BookOpen,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
}

// ── 组件 ──
export function TodayTaskPage() {
  const dailyGoal = usePreferencesStore((s) => s.dailyGoal)
  const warmupStore = useWarmupSessionStore()

  // 数据
  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 练习状态
  const [currentIdx, setCurrentIdx] = useState(0)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [runSeed, setRunSeed] = useState(() => Math.random())

  // 每次重新生成题目时重置
  useEffect(() => {
    warmupStore.clearSession()
    setDoneIds(new Set())
  }, [runSeed])

  const markDone = useCallback((stepId: string, _score: WarmupScore = 'strong') => {
    setDoneIds((prev) => {
      const next = new Set(prev)
      next.add(stepId)
      return next
    })
  }, [])

  const handleReshuffle = useCallback(() => {
    warmupStore.clearSession()
    setDoneIds(new Set())
    setCurrentIdx(0)
    setDrawerOpen(false)
    setRunSeed(Math.random())
  }, [warmupStore])

  // ── 加载数据 ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      learningPackService.listInstalled(),
      learningRepository.getCachedMyUnits().catch(() => [] as MyUnit[]),
    ])
      .then(async ([packs, units]) => {
        if (cancelled) return

        const installedPacks = packs.filter((pack) => pack.status === 'installed')
        const currentPackId =
          units.find((u) => installedPacks.some((pack) => pack.packId === u.id))?.id ??
          installedPacks[0]?.packId

        if (!currentPackId) return null
        return learningRepository.getCachedUnitDetail(currentPackId)
      })
      .then((detail) => {
        if (!cancelled && detail) setUnit(detail)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── 构建练习列表 ──
  const steps = useMemo<PracticeItem[]>(() => {
    if (!unit) return []

    const built: PracticeItem[] = []
    for (const topic of unit.trainingTopics ?? []) {
      const pipeline = topic.metadata?.outputTraining?.enabled
        ? (topic.metadata.outputTraining.pipeline ?? [])
        : []
      for (const item of pipeline) {
        const stepId = (suffix: string) => `today:${topic.id}:${item.id}:${suffix}`

        if (item.type === 'chunk_substitution') {
          const picked = pickOne<SimplePromptItem>((item.items ?? []) as SimplePromptItem[])
          if (!picked) continue
          const [sub, subIdx] = picked
          const sid = stepId(`${subIdx}`)
          built.push({
            id: sid,
            type: 'chunk_substitution',
            label: item.title || item.chunk || '句块替换',
            topicTitle: topic.title,
            render: () => (
              <ChunkOutputDrillCard
                chunk={{ text: item.chunk, meaning: item.chunkMeaning || '', description: null }}
                items={[sub]}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                kind={item.kind ?? 'chunk'}
                groupTitle={item.title}
                onComplete={(_idx, _passed, score) => markDone(sid, score)}
              />
            ),
          })
        } else if (item.type === 'vocab_drill') {
          const picked = pickOne<VocabPromptItem>((item.vocabs ?? []) as VocabPromptItem[])
          if (!picked) continue
          const [vocab, vocabIdx] = picked
          const sid = stepId(`${vocabIdx}`)
          built.push({
            id: sid,
            type: 'vocab_drill',
            label: item.title || vocab.targetWords?.join(', ') || '词汇输出',
            topicTitle: topic.title,
            render: () => (
              <VocabOutputCard
                title={item.title || '词汇输出'}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                vocabs={[vocab]}
                onComplete={(_idx, _passed, score) => markDone(sid, score)}
              />
            ),
          })
        } else if (item.type === 'vocab_sentence_building') {
          const pattern = pickOne<any>(item.patterns ?? [])?.[0]
          const picked = pickOne<SimplePromptItem>((pattern?.items ?? []) as SimplePromptItem[])
          if (!pattern || !picked) continue
          const [sub, subIdx] = picked
          const sid = stepId(`${pattern.chunk}:${subIdx}`)
          built.push({
            id: sid,
            type: 'vocab_sentence_building',
            label: `${item.vocabWord || '词汇'} + ${pattern.chunk}`,
            topicTitle: topic.title,
            render: () => (
              <ChunkOutputDrillCard
                chunk={{ text: pattern.chunk }}
                items={[sub]}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                groupTitle={`${item.vocabWord || '词汇'} + ${pattern.chunk}`}
                onComplete={(_idx, _passed, score) => markDone(sid, score)}
              />
            ),
          })
        } else if (item.type === 'pattern_drill') {
          const picked = pickOne<SimplePromptItem>((item.items ?? []) as SimplePromptItem[])
          if (!picked) continue
          const [sub, subIdx] = picked
          const sid = stepId(`${subIdx}`)
          built.push({
            id: sid,
            type: 'pattern_drill',
            label: item.title || item.pattern || '句型操练',
            topicTitle: topic.title,
            render: () => (
              <PatternDrillCard
                pattern={item.pattern}
                patternMeaning={item.patternMeaning}
                items={[sub]}
                stepId={sid}
                direction={item.direction ?? 'zh_to_en'}
                groupTitle={item.title}
                onComplete={(_idx, _passed, score) => markDone(sid, score)}
              />
            ),
          })
        } else if (item.type === 'sentence_decomposition') {
          const sid = stepId('decomp')
          const title = item.title || '句子拆解'
          built.push({
            id: sid,
            type: 'sentence_decomposition',
            label: title,
            topicTitle: topic.title,
            render: () => (
              <SentenceDecompositionCard
                title={title}
                levels={item.levels}
                stepId={sid}
                onComplete={(_passed, score) => markDone(sid, score)}
              />
            ),
          })
        }
      }
    }

    return shuffle(built).slice(0, Math.max(1, dailyGoal))
  }, [dailyGoal, markDone, runSeed, unit])

  // ── 进度统计 ──
  const doneCount = steps.filter((s) => doneIds.has(s.id)).length
  const donePercent = steps.length > 0 ? (doneCount / steps.length) * 100 : 0

  // ── 今日练习记录 ──
  const todayRecords = warmupStore.records

  // ── 导航 ──
  const currentStep = steps[currentIdx]
  const hasPrev = currentIdx > 0
  const hasNext = currentIdx < steps.length - 1
  const gotoPrev = useCallback(() => setCurrentIdx((p) => Math.max(0, p - 1)), [])
  const gotoNext = useCallback(() => setCurrentIdx((p) => Math.min(steps.length - 1, p + 1)), [steps.length])

  // ── 加载态 ──
  if (loading) return <MobilePageLoading rows={4} />

  // ── 空态 ──
  if (error || !unit || steps.length === 0) {
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
        <div />
        <div className="flex items-center gap-1 rounded-full bg-background/36 p-1 backdrop-blur-2xl ring-1 ring-white/45 lg:hidden">
          <button
            type="button"
            onClick={(e) => { e.currentTarget.blur(); handleReshuffle() }}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/45 hover:text-foreground"
            aria-label="换一批题目"
          >
            <RefreshCw className="size-[18px]" />
          </button>
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
      <Card className="mb-5 border-0 bg-primary/[0.07] shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <ListChecks className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  今日练习 · {doneCount}/{steps.length} 题
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  每日目标 {dailyGoal} 题
                </p>
              </div>
            </div>
            {doneCount === steps.length && <Sparkles className="size-5 text-primary" />}
          </div>
          <Progress value={donePercent} className="mt-3 h-2" />
        </CardContent>
      </Card>

      {/* ── 练习卡片列表 ── */}
      <div className="space-y-2.5">
        {steps.map((step, index) => {
          const meta = TYPE_META[step.type] ?? {
            label: '知识点',
            icon: MessageSquareText,
            color: 'bg-primary/10 text-primary',
          }
          const Icon = meta.icon
          const isDone = doneIds.has(step.id)

          return (
            <Card
              key={step.id}
              className={cn(
                'cursor-pointer border-0 bg-muted/30 shadow-none transition-all active:scale-[0.98]',
                isDone && 'opacity-60',
              )}
              onClick={() => {
                setCurrentIdx(index)
                setDrawerOpen(true)
              }}
            >
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', meta.color)}>
                  {isDone ? <CheckCircle2 className="size-5 text-green-500" /> : <Icon className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                    {meta.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {step.topicTitle} · {step.label}
                  </p>
                </div>
                <Badge variant={isDone ? 'default' : 'outline'} className="shrink-0 text-[10px]">
                  {isDone ? '✓' : index + 1}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── 今日话题快捷入口 ── */}
      {unit && (unit.trainingTopics ?? []).length > 0 && (
        <>
          <Separator className="my-6" />
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">今日话题</h2>
              <span className="text-xs text-muted-foreground">快捷练习入口</span>
            </div>
            <div className="space-y-2">
              {(unit.trainingTopics ?? []).map((topic) => (
                <Link
                  key={topic.id}
                  to={`/practice/session/${topic.id}`}
                  className="flex items-center gap-3 rounded-lg bg-muted/30 p-3.5 transition-colors hover:bg-muted/50 active:scale-[0.98]"
                >
                  <div className="relative flex aspect-square size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 text-primary dark:from-sky-950/50 dark:via-emerald-950/30 dark:to-amber-950/40">
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background/20" />
                    {(() => { const Icon = getCategoryIcon(unit.category); return <Icon className="relative size-6" /> })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{topic.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {topic.promptZh?.slice(0, 40) || '暂无描述'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{topic.difficulty}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {topic.activeChunks?.length ?? 0} 表达 · {topic.suggestedDurationSec}s
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── 练习 Drawer ── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} shouldScaleBackground={false}>
        <DrawerContent className="h-[88dvh] rounded-t-[28px] border-border/20 bg-background">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
            <div className="min-w-0">
              <DrawerTitle className="truncate text-base">{currentMeta.label}</DrawerTitle>
              <p className="truncate text-xs text-muted-foreground">
                {currentStep?.label} · {currentIdx + 1}/{steps.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-6 pt-4">
            <div key={currentStep?.id}>
              {currentStep?.render()}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3">
            <Button variant="outline" size="sm" onClick={gotoPrev} disabled={!hasPrev}>
              <ChevronLeft className="size-4" />
              <span className="ml-1">上一题</span>
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentIdx + 1} / {steps.length}
            </span>
            <Button variant="outline" size="sm" onClick={gotoNext} disabled={!hasNext}>
              <span className="mr-1">下一题</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── 练习记录 Drawer ── */}
      <Drawer open={recordsOpen} onOpenChange={setRecordsOpen}>
        <DrawerContent className="h-[82dvh] rounded-t-2xl">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <DrawerTitle className="text-lg">今日练习记录</DrawerTitle>
            <button
              type="button"
              onClick={() => setRecordsOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-4 pb-8">
            {todayRecords.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <ClipboardList className="size-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">暂无练习记录</p>
                <p className="text-xs text-muted-foreground/60">完成题目提交后会自动记录</p>
              </div>
            ) : (
              <div className="space-y-2 pt-4">
                {todayRecords.map((record, idx) => {
                  const stepMeta = TYPE_META[record.stepType] ?? {
                    label: '知识点',
                    color: 'bg-primary/10 text-primary',
                  }
                  const stepIndex = steps.findIndex((s) => s.id === record.stepId)
                  return (
                    <div key={record.stepId || idx} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          record.passed
                            ? 'bg-green-500/15 text-green-600'
                            : 'bg-red-500/15 text-red-500',
                        )}>
                          {record.passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{stepMeta.label}</Badge>
                            {record.groupTitle && (
                              <span className="truncate text-xs font-medium text-foreground">{record.groupTitle}</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-foreground">{record.zh}</p>
                          {record.answer && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {record.answer}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Clock3 className="size-3" />
                            <span>第 {stepIndex >= 0 ? stepIndex + 1 : '?'} 题</span>
                            {record.score && (
                              <>
                                <span>·</span>
                                <span className={cn(
                                  record.score === 'strong' && 'text-green-600',
                                  record.score === 'ok' && 'text-blue-600',
                                  record.score === 'weak' && 'text-amber-600',
                                  record.score === 'miss' && 'text-red-500',
                                )}>
                                  {record.score === 'strong' ? '熟练' : record.score === 'ok' ? '通过' : record.score === 'weak' ? '待稳' : '复练'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (stepIndex >= 0) {
                              setCurrentIdx(stepIndex)
                              setRecordsOpen(false)
                              setDrawerOpen(true)
                            }
                          }}
                          className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="回放此题"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
